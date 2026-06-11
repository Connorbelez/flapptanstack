# Lawyer Deal Portal Access Bug Report

This is a real architectural RBAC bug, not just a bad redirect.

The system currently has two different authorization models for the same lawyer/deal relationship:

1. `/lawyer/*` is protected by global WorkOS-style island RBAC. `/lawyer` requires `lawyer:access` via [src/routes/lawyer/route.tsx](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/routes/lawyer/route.tsx:7) and `guardRouteAccess` in [src/lib/auth.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/lib/auth.ts:323).
2. `/deals/$dealId` only requires authentication at the route level in [src/routes/deals/$dealId.tsx](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/routes/deals/$dealId.tsx:18), then relies on `getDealPortalWorkspace`, which is an `authedQuery`, not a `dealQuery`, in [convex/deals/portalQueries.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/deals/portalQueries.ts:460).
3. `canAccessDeal` allows an invited guest lawyer through by matching their verified email against provisional `dealAccess.userId` rows in [convex/auth/resourceChecks.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/auth/resourceChecks.ts:196).

That is why the same user can fail `/lawyer/deals/[id]` but pass `/deals/[id]`: the lawyer route checks global `lawyer:access`, while the deal portal accepts provisional email-based deal access. The redirect route at [src/routes/lawyer/deals.$dealId.tsx](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/routes/lawyer/deals.$dealId.tsx:3) never gets to be a useful compatibility bridge because the parent `/lawyer` guard runs first.

**Onboarding Bug**

The dead-end “Complete legal onboarding” state is also encoded in the current design, not accidental.

`getDealPortalWorkspace` can classify a viewer as `selected_lawyer_onboarding_required`, but it only reads an existing onboarding session. If no session exists, it returns `nextRoute: null` in [convex/deals/portalQueries.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/deals/portalQueries.ts:527). The UI only renders the onboarding link when `nextRoute` exists in [src/components/deals/portal/DealPortalShell.tsx](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/components/deals/portal/DealPortalShell.tsx:137).

There is even a test that expects this dead-end state: “fails closed for selected-lawyer email match without onboarding session” in [convex/deals/__tests__/portalQueries.test.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/deals/__tests__/portalQueries.test.ts:490), including `nextRoute: null` at [convex/deals/__tests__/portalQueries.test.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/deals/__tests__/portalQueries.test.ts:516).

There is a second, deeper problem: the onboarding page route itself only requires authentication in [src/routes/lawyer/onboarding.$sessionId.tsx](/Users/connor/.codex/worktrees/eb17/fairlendapp/src/routes/lawyer/onboarding.$sessionId.tsx:21), but the backend onboarding query and checkpoint mutations require `lawyer:access` through `lawyerQuery` / `lawyerMutation` in [convex/legalRepresentation/onboarding.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/legalRepresentation/onboarding.ts:778) and [convex/legalRepresentation/onboarding.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/legalRepresentation/onboarding.ts:805). That means the flow can require the lawyer permission before the lawyer has completed the process that should establish usable lawyer access.

**Spec Drift**

Against the Notion orchestration spec and Linear ENG-362/363/364, the landed code only partially matches the intended model.

ENG-362 and the Notion onboarding orchestrator require WorkOS invitation acceptance to create/resume a local onboarding session and converge all lawyer entry points into `/lawyer/onboarding/$sessionId`. The code has `startOrResumeForDeal` in [convex/legalRepresentation/onboarding.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/legalRepresentation/onboarding.ts:698), but `/deals/$dealId` does not invoke it, so direct deal access can land in a constrained portal with no way forward.

ENG-363’s governed gates are mostly present for representation actions, but portal access is a separate authorization surface. The system blocks lawyer actions while still admitting an incomplete lawyer to the generic deal portal shell. If the requirement is “absolutely blocked until onboarding is complete,” the current constrained portal state is not compliant.

ENG-364 appears especially risky from a merge/process standpoint: the GitHub PR metadata for the related branch was not a proper implementation summary and contained unrelated runtime-error text. The current branch also includes a deep stack of open lawyer/legal representation work plus unrelated admin/fee/dispersal changes, so this area should be treated as merge-fragile.

**Similar Risks**

The biggest similar issue is that `canAccessDeal` is shared by other resource checks. GitNexus impact analysis showed `canAccessDeal` feeds document and transfer access paths through `canAccessDocument` / `canAccessTransferRequest` in [convex/auth/resourceChecks.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/auth/resourceChecks.ts:386) and [convex/auth/resourceChecks.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/auth/resourceChecks.ts:568). The provisional guest-lawyer email bridge should not live inside general-purpose deal access.

Also, `lawyerQuery` globally requires `lawyer:access` in [convex/fluent.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/fluent.ts:641), while normal deal queries can require `deal:view` in [convex/fluent.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/fluent.ts:842). `getDealPortalWorkspace` bypasses both and uses plain `authedQuery` from [convex/fluent.ts](/Users/connor/.codex/worktrees/eb17/fairlendapp/convex/fluent.ts:606), then implements its own persona rules. That is the architectural smell: route guards, Convex builders, portal personas, and dealAccess rows are not one policy.

**Recommended Refactor**

The fix should not be a broader boolean `canAccessDeal` helper. That name is part of the current problem: it hides several different questions behind one answer.

The new primitive should be an authoritative deal access policy resolver that returns a typed decision:

- who the viewer is;
- how the viewer is related to the deal;
- what readiness gates still block them;
- what data scope they may see;
- what capabilities they may execute;
- where the UI should send them next.

Frontend code may reuse the decision type and pure interpretation helpers, but frontend code must not be the source of authorization. Convex remains authoritative.

**Critical Vocabulary Defect**

There is a separate domain bug underneath the lawyer access bug: the code currently treats `seller` as if it can map to `borrower` in participant workspaces. That is wrong for this product.

In FairLend deals, the seller is the lender selling the mortgage position. The buyer is the lender purchasing the position. The borrower is the borrower on the underlying mortgage. A seller is never the borrower.

Concrete examples:

1. `src/routes/lender.deals.tsx` requests `{ persona: "buyer" }`.
2. `src/routes/borrower.deals.tsx` requests `{ persona: "seller" }`.
3. `convex/deals/queries.ts` maps `buyer -> lender` and `seller -> borrower`.
4. `convex/deals/participantProjection.ts` allows seller projections to resolve through borrower records.
5. Document roles still use broad roles such as `lender_primary`, `borrower_primary`, and `lawyer_primary`.

This can cause workspace access, signable document recipient resolution, template variables, and deal portal projections to disagree about the legal party represented by the same deal relationship. That is a high-severity correctness issue.

The refactor must unify vocabulary across deal access, deal projections, participant workspaces, document templates, signing recipients, and template variables. Do not add another local persona vocabulary.

**Target Model**

Create a shared access-policy module with two layers:

1. A backend resolver that loads authenticated identity, deal rows, dealAccess rows, invitations, onboarding sessions, legal verification, engagements, and role/membership state.
2. A pure decision classifier that receives normalized facts and returns a `DealAccessDecision`.

The shared pure layer can be imported by frontend tests, route helpers, and backend tests. The database-backed resolver must live server-side.

Suggested canonical persona shape:

```ts
type DealPersona =
	| "fairlend_admin"
	| "selling_lender"
	| "purchasing_lender"
	| "participating_lender"
	| "primary_borrower"
	| "co_borrower_1"
	| "co_borrower_2"
	| "broker_of_record"
	| "assigned_broker"
	| "primary_lawyer"
	| "closing_team_member";

type DealPersonaReadiness =
	| "active"
	| "invited"
	| "onboarding_required"
	| "onboarding_in_progress"
	| "verification_required"
	| "engagement_required"
	| "suspended"
	| "revoked";

type DealAccessIntent =
	| "deal.portal.view"
	| "lawyer.onboarding.bootstrap"
	| "lawyer.onboarding.resume"
	| "lawyer.representation.confirm"
	| "lawyer.document.review"
	| "deal.document.view"
	| "deal.transfer.view"
	| "admin.deal.manage";

type DealAccessDecision =
	| {
			allowed: true;
			persona: DealPersona;
			readiness: DealPersonaReadiness;
			scope: "full_deal" | "party_limited" | "onboarding_only";
			capabilities: readonly DealAccessIntent[];
			redirectTo: null;
			reasons: readonly string[];
	  }
	| {
			allowed: false;
			persona: DealPersona | null;
			readiness: DealPersonaReadiness | null;
			scope: "none";
			capabilities: readonly [];
			redirectTo: string | null;
			reasons: readonly string[];
	  };
```

This should replace the current split-brain model where route guards, Convex builders, `canAccessDeal`, portal persona logic, and lawyer onboarding gates each answer slightly different authorization questions.

`DealPersona` is not a WorkOS role and should not mirror WorkOS-managed roles. WorkOS roles remain coarse authenticated identity and organization-level authorization, such as `admin`, `lender`, `broker`, and `lawyer`. `DealPersona` is the canonical per-deal party/persona vocabulary shared by access policy, portal projections, participant workspaces, document templates, signing recipients, and template variables.

The lender-facing names should avoid `buyer` and `seller` because both sides of the marketplace transaction are lenders. The current code often uses `buyer` / `seller` as implementation shorthand, but the policy model should use `purchasing_lender` and `selling_lender` so access decisions match the actual domain. In most cases the `selling_lender` may be the FairLend MIC, but the persona still describes that party's deal position rather than a WorkOS role.

Lawyer invitation/onboarding states should not be separate personas. A guest lawyer target, an onboarding lawyer, and an active lawyer are all `primary_lawyer` with different `readiness` values. This prevents another split-brain vocabulary where access says `guest_lawyer_onboarding` while documents need `lawyer_primary`.

**Single Vocabulary Contract**

There should be one canonical deal persona vocabulary and explicit boundary adapters where they are genuinely needed. Do not let access personas, document signatory roles, participant workspace personas, and storage roles drift independently.

Current vocabularies include:

1. WorkOS roles and permissions: `admin`, `lender`, `broker`, `lawyer`.
2. `dealAccess` storage roles: currently includes values like `lender`, `borrower`, `platform_lawyer`, `guest_lawyer`, `broker_of_record`, and `assigned_broker`.
3. Deal portal personas: currently includes values like `lender`, `seller`, `selected_lawyer`, and `selected_lawyer_onboarding_required`.
4. Participant workspace personas: currently `buyer` and `seller`, with `buyer -> lender` and `seller -> borrower` mappings.
5. Document signatory platform roles: currently values like `lender_primary`, `borrower_primary`, `broker_of_record`, `assigned_broker`, and `lawyer_primary`.

The refactor should introduce `DealPersona` as the single canonical union, then make every internal surface speak that vocabulary. Adapters are acceptable only at real boundaries, not as a way to keep multiple internal vocabularies alive.

Valid adapter cases:

1. External systems or APIs use their own vocabulary, such as WorkOS org roles or Documenso recipient roles.
2. Contextual role refinement is required, such as a broad WorkOS `lender` becoming `purchasing_lender` only after the viewer locks or participates in a specific deal.
3. Existing persisted data or published document templates need a temporary compatibility shim during migration.

Invalid adapter cases:

1. New internal code wants to keep using `buyer`, `seller`, `selected_lawyer`, or `borrower` as deal personas.
2. A translation layer exists only to avoid renaming incorrect domain concepts.
3. A compatibility function has no deletion condition, no migration path, or starts being used by new features.

Boundary adapters should therefore be explicit, narrow, tested, and either permanent because they cross an external/context boundary or temporary because they have a defined migration exit.

Example boundary functions:

```ts
function dealPersonaToDocumentSignatoryRole(persona: DealPersona): DocumentSignatoryRole | null;
function dealPersonaToTemplateVariablePrefix(persona: DealPersona): string | null;
function dealPersonaToLegacyStorageRole(persona: DealPersona): DealAccessStorageRole | null;
function legacyStorageRoleToDealPersona(args: {
	role: DealAccessStorageRole;
	dealPosition?: "selling" | "purchasing";
}): DealPersona | null;
```

This lets existing storage and templates keep temporary compatibility names while all new code talks in the canonical union. For example, `purchasing_lender` may temporarily map to `lender_primary` in existing templates, but that mapping must be named, tested, and either justified as a stable template contract or scheduled for migration. `selling_lender` must never map to `borrower_primary`.

Every temporary compatibility adapter should document:

1. the legacy values it accepts;
2. the canonical `DealPersona` it emits;
3. which table, route, or template surface still requires it;
4. the migration that removes it;
5. a test proving no new internal API returns the legacy value.

**Adapter Decision Matrix**

Initial inventory shows substantial legacy vocabulary debt. A rough code search found:

1. 119 files containing the main competing deal vocabulary tokens, including `buyer`, `seller`, `selected_lawyer`, `lender_primary`, and `borrower_primary`.
2. 43 core deal/checkout/payment/test files containing `buyer` / `seller`.
3. 25 document-engine/document-package files containing document platform-role vocabulary such as `lender_primary`, `borrower_primary`, `lawyer_primary`, or `platformRole`.
4. 38 lawyer/deal portal files containing `selected_lawyer`, `selected_lawyer_onboarding_required`, `platform_lawyer`, or `guest_lawyer`.

These counts include tests and fixtures, so they overstate production blast radius, but they correctly show that this is not a one-file naming cleanup.

| System | Current vocabulary | Verdict | Decision |
| --- | --- | --- | --- |
| WorkOS roles and permissions | `admin`, `lender`, `broker`, `lawyer`, `borrower` | Valid boundary adapter | Keep WorkOS coarse roles. Convert to `DealPersona` only with deal context. A WorkOS `lender` is not `purchasing_lender` or `selling_lender` until a specific deal relationship is known. |
| Route islands | `/lender`, `/borrower`, `/lawyer` | Mixed | `/lender` and `/lawyer` can stay as portal roots. `/borrower/deals` using `{ persona: "seller" }` is debt and should be removed or redirected. A selling lender must not enter through a borrower route. |
| Deal storage fields | `deals.buyerId`, `deals.sellerId` | Temporary migration shim | Persistent schema should migrate to `purchasingLenderAuthId` and `sellingLenderAuthId`. Until then, all reads must convert through a narrow legacy field shim. |
| Checkout/deal lock storage | `buyerAuthId`, `sellerAuthId`, `buyerAccountId`, `sellerAccountId` | Temporary migration shim | These describe lender transaction sides. Migrate to `purchasingLenderAuthId`, `sellingLenderAuthId`, `purchasingLenderAccountId`, and `sellingLenderAccountId`. |
| Ledger reservation/account field names | `buyerAccountId`, `sellerAccountId` | Temporary migration shim | Accounting can use transaction-side language, but names should still align with `purchasing_lender` / `selling_lender`. Keep only if ledger domain explicitly defines buyer/seller as settlement legs and exposes canonical persona metadata elsewhere. |
| `dealAccess.role` | `lender`, `borrower`, `platform_lawyer`, `guest_lawyer`, broker roles | Refactor debt | Replace with canonical deal persona or add a canonical persona field. `borrower` must not represent deal seller. `platform_lawyer` / `guest_lawyer` are lawyer source/kind, not personas. |
| Participant workspace persona | `buyer`, `seller` | Refactor debt | Replace with `DealPersona`. Current `seller -> borrower` mapping is wrong-party behavior, not acceptable adapter debt. |
| Deal portal persona | `lender`, `seller`, `selected_lawyer`, `selected_lawyer_onboarding_required` | Refactor debt | Replace with `DealPersona + readiness + capabilities`. `selected_lawyer_onboarding_required` is readiness state, not persona. |
| Deal participant projection | `buyer`, `seller`, `lawyer`, separate `borrower` involved party | Refactor debt | Projection should expose `purchasing_lender`, `selling_lender`, `primary_borrower`, and `primary_lawyer` as distinct parties. Seller cannot fall back to borrower. |
| Document signatory roles | `lender_primary`, `borrower_primary`, `lawyer_primary` | Refactor debt with same-PR compatibility aliases | The refactor must introduce canonical `DealPersona` signatory roles and update authoring, validation, mapping, generation, and recipient resolution in the same PR. Published-template aliases are acceptable only as compatibility support, not as a deferred migration. `selling_lender` must never resolve to `borrower_primary`. |
| Document system variables | `lender_primary_*`, `borrower_primary_*`, `lawyer_primary_*` | Refactor debt with same-PR compatibility aliases | The refactor must add canonical variables such as `purchasing_lender_*`, `selling_lender_*`, `primary_borrower_*`, and `primary_lawyer_*` and update variable registry, validation, generation, and UI authoring in the same PR. Old variables may remain as aliases for existing templates only. |
| Document authoring UI persona surface | Variable picker and signatory role controls expose legacy/broad roles | Refactor debt | The UI must surface canonical `DealPersona` roles for both interpolation variables and signatory assignment. Authors should be able to select `purchasing_lender`, `selling_lender`, `primary_borrower`, `primary_lawyer`, broker personas, and any supported co-borrower personas without relying on legacy labels. |
| Document generation role equivalents | `lender <-> lender_primary`, `borrower <-> borrower_primary`, lawyer aliases | Refactor debt | This normalizes broad legacy roles and can hide wrong-party mappings. Replace with canonical persona-based signatory resolution in the same PR as the signatory role migration. |
| Envelope recipient resolution | `lender_primary -> participants.buyer`, `borrower_primary -> participants.seller` | Critical refactor debt | This can route borrower signatures to the selling lender. Replace with canonical persona resolution in the same PR as the document role and variable migration. |
| Payment proof submitter role | `lender`, `guest_lawyer`, `platform_lawyer`, `admin` | Refactor debt | Replace `lender` with the exact allowed deal persona, likely `purchasing_lender`, plus `primary_lawyer` and `fairlend_admin`. Lawyer source/kind should not be submitter persona. |
| Payment/transfer counterparty type | `borrower`, `lender`, `investor`, `trust` | Valid domain boundary adapter | This is a payments-domain vocabulary, not necessarily a deal persona. Keep if transfer logic is about banking counterparties, but deal-linked metadata should carry canonical `DealPersona` where applicable. |
| Legal representation selected-lawyer kind | `platform_lawyer`, `guest_lawyer` | Valid subtype, not persona | Keep as lawyer source/kind if renamed or scoped clearly. It should feed `primary_lawyer` readiness and provisioning logic, not become a public persona. |
| Broker roles | `broker_of_record`, `assigned_broker` | Mostly clean | These already describe deal-specific personas and can be part of `DealPersona`. WorkOS `broker` still needs contextual refinement. |
| Borrower domain | WorkOS/app `borrower`, mortgage borrower records | Valid domain, wrong when used for seller | Borrower remains valid for mortgage obligations and borrower-facing flows. It must not be used as a deal-sale seller persona. |

Planning conclusion: the clean implementation is not “lots of adapters.” It is one canonical internal vocabulary plus a small number of explicit boundary adapters. Most current adapters would be temporary migration shims or outright refactors, not permanent architecture.

**Quarantine Vs Migration**

Quarantine means the vocabulary is allowed to keep existing, but only inside a named boundary. It must not leak into deal access policy, deal portal projections, document recipient resolution, or new internal APIs.

Migration means the vocabulary is wrong for the FairLend deal domain and should be replaced with `DealPersona` or deal-position-specific fields. Temporary shims may exist only to read old rows or published templates during the migration.

Permanent boundary quarantine:

1. WorkOS roles and permissions: `admin`, `lender`, `broker`, `lawyer`, and any remaining `borrower` role stay in auth/organization context only. They are inputs to policy resolution, not deal personas.
2. Documenso/provider roles: `SIGNER`, `APPROVER`, `VIEWER`, provider recipient IDs, and provider envelope states stay in the signature-provider boundary.
3. Payment counterparty types: `borrower`, `lender`, `investor`, `trust` can stay in payments if they describe banking counterparties. Any deal-linked payment metadata should also carry canonical `DealPersona`.
4. Mortgage borrower domain: borrower records and borrower-facing obligation/payment flows stay valid for the underlying mortgage. They must not be used to represent the deal seller.
5. Lawyer source/kind: `platform_lawyer` and `guest_lawyer` may stay as legal representation provisioning/source kind. They must resolve to `primary_lawyer` plus readiness in deal policy.

Temporary migration quarantine:

1. `deals.buyerId` and `deals.sellerId`: read through a compatibility shim, migrate to `purchasingLenderAuthId` and `sellingLenderAuthId`.
2. `dealLockCheckoutSessions.buyerAuthId` / `sellerAuthId`: migrate to `purchasingLenderAuthId` / `sellingLenderAuthId`.
3. `buyerAccountId` / `sellerAccountId` in checkout and reservations: migrate to `purchasingLenderAccountId` / `sellingLenderAccountId`, unless accounting deliberately defines buyer/seller as settlement-leg terminology and never exposes it as deal persona.
4. Existing tests/stories/fixtures using `buyer`, `seller`, `selected_lawyer`, or broad document roles: update as production APIs migrate; do not use them as source-of-truth examples.

Direct migration/refactor:

1. Participant workspace persona `buyer | seller`: replace with `DealPersona`; remove `seller -> borrower`.
2. `/borrower/deals` as seller workspace: remove, redirect, or replace with a true borrower mortgage/obligation workspace. A selling lender belongs under lender/deal surfaces.
3. Deal portal persona `lender | seller | selected_lawyer | selected_lawyer_onboarding_required`: replace with `DealPersona + readiness + capabilities`.
4. `dealAccess.role` values as authorization personas: replace or augment with canonical `DealPersona`. `borrower` must not grant seller access; `platform_lawyer` and `guest_lawyer` must not be public personas.
5. Deal participant projection `buyer` / `seller`: replace with `purchasing_lender` / `selling_lender`, and expose `primary_borrower` separately from the mortgage graph.
6. Envelope recipient resolution `borrower_primary -> participants.seller`: replace immediately. Borrower recipients must come from mortgage borrower records only.
7. Document generation role equivalents that normalize `borrower` to `borrower_primary` or `lender` to `lender_primary`: replace with canonical persona resolution.
8. Payment proof submitter role `lender` / `guest_lawyer` / `platform_lawyer`: replace with exact deal personas and lawyer readiness/source fields.
9. Document signatory roles `lender_primary`, `borrower_primary`, and `lawyer_primary`: migrate to canonical `DealPersona` roles in authoring, validation, generation, and recipient resolution. Legacy role aliases may remain only for existing published templates and must land in the same PR.
10. Document system variables `lender_primary_*`, `borrower_primary_*`, and `lawyer_primary_*`: add canonical variables and migrate registry, validation, generation, and UI authoring in the same PR. Legacy variable aliases may remain only for existing published templates.
11. Document authoring UI variable and signatory controls: surface canonical `DealPersona` options directly. Legacy names may be shown only as compatibility aliases on old templates, not as default authoring choices.

Longer term, the document engine should likely move away from broad names like `lender_primary` toward deal-position-aware variables such as:

- `purchasing_lender_primary_email`
- `purchasing_lender_primary_full_name`
- `selling_lender_primary_email`
- `selling_lender_primary_full_name`
- `primary_borrower_email`
- `primary_lawyer_email`

These canonical variables must be registered as system variables, exposed in the document authoring UI variable picker, validated by template publication checks, and resolved by generation from the same `DealPersona` participant graph used for signatory resolution. Signatory assignment controls must use the same canonical persona list so interpolation and signing cannot drift.

**Order Of Operations**

The correct order is not “role first, then deal access.” Guest lawyer onboarding proves why: the invited lawyer may not yet have canonical `lawyer:access`, but they still need a safe path into onboarding.

Use this order instead:

1. Require authentication.
2. Load the minimal deal and relationship facts needed to classify the viewer.
3. Determine the viewer's candidate relationship to the deal.
4. Choose a deterministic persona for the requested intent.
5. Apply persona-specific readiness gates.
6. Return an explicit allow, deny, or redirect decision.

Deal relationship must be evaluated before final role readiness, because invitation-target matching is a relationship fact, not a capability grant. A matching guest lawyer email should prove only “this authenticated user may start or resume onboarding for this deal.” It should not prove “this user may access the deal.”

For lawyers, the policy should distinguish these states:

1. `primary_lawyer` + `invited`: authenticated viewer matches selected lawyer email or invitation target, but no completed onboarding exists. Allowed capabilities: onboarding bootstrap only. Deal portal scope: none.
2. `primary_lawyer` + `onboarding_in_progress`: viewer owns an active onboarding session. Allowed capabilities: onboarding resume and checkpoint submission. Deal portal scope: onboarding only.
3. `primary_lawyer` + `verification_required` or `engagement_required`: viewer is known to the deal but has not satisfied all lawyer readiness gates. Allowed capabilities: only the next required onboarding/engagement action.
4. `primary_lawyer` + `active`: viewer has completed onboarding, has active auth-ID `dealAccess`, has current lawyer verification, and has accepted representation engagement. Allowed capabilities: lawyer deal portal and lawyer actions.

An active auth-ID `guest_lawyer` `dealAccess` row should not be enough to grant full lawyer capabilities. It is a relationship record, not proof that identity, LSO, onboarding, and engagement gates are satisfied.

**Backend Contract**

Add a backend policy entry point with intent-aware helpers. The exact file names can shift during implementation, but the boundary should be explicit:

- `convex/deals/accessPolicy/types.ts`: decision types, personas, reasons, data scopes, capability names.
- `convex/deals/accessPolicy/classify.ts`: pure classifier from normalized facts to `DealAccessDecision`.
- `convex/deals/accessPolicy/resolve.ts`: Convex resolver that loads facts and calls the classifier.
- `convex/deals/accessPolicy/assert.ts`: thin assertion wrappers for mutations and queries.

Example backend API:

```ts
export async function resolveDealAccessDecision(
	ctx: QueryCtx | MutationCtx,
	args: {
		dealId: Id<"deals">;
		intent: DealAccessIntent;
	},
): Promise<DealAccessDecision>;

export async function assertDealAccessForIntent(
	ctx: QueryCtx | MutationCtx,
	args: {
		dealId: Id<"deals">;
		intent: DealAccessIntent;
	},
): Promise<Extract<DealAccessDecision, { allowed: true }>>;
```

Existing generic helpers should become compatibility wrappers around this policy, not independent policy sources. For example, `canAccessDeal` should eventually become equivalent to “does the viewer have `deal.portal.view` with non-onboarding scope?” It should not contain guest-email fallback logic.

**Frontend Contract**

Frontend routes should not independently infer whether a user can access a deal. They should ask Convex for a policy decision or a workspace projection that already embeds the policy decision.

Recommended route behavior:

1. `/lawyer/deals/$dealId`: authenticated bootstrap route, not protected by the `/lawyer` parent `lawyer:access` guard. It calls the onboarding bootstrap mutation/query and redirects to either `/lawyer/onboarding/$sessionId` or `/deals/$dealId`.
2. `/lawyer/onboarding/$sessionId`: authenticated route whose backend query/mutations authorize by session ownership or lawyer role. It must not require global `lawyer:access` before onboarding is complete.
3. `/deals/$dealId`: calls `resolveDealAccessDecision` for `deal.portal.view`. If the decision redirects to onboarding, the route redirects before rendering the deal portal shell. If denied, it renders forbidden/not found. If allowed, it renders only the scoped workspace projection returned by the backend.

The deal portal should not render parties, documents, lender controls, or representation screens for `primary_lawyer` decisions whose readiness is `invited`, `onboarding_required`, or `onboarding_in_progress`. Those readiness states allow onboarding only, not deal portal access.

**Convex Builder Changes**

The current `lawyerQuery` / `lawyerMutation` builders are too coarse for onboarding because they require `lawyer:access`, which is not a valid precondition for guest onboarding.

Introduce onboarding-specific builders:

```ts
export const lawyerOnboardingQuery = authedQuery.use(requireLawyerOnboardingAccess);
export const lawyerOnboardingMutation = authedMutation.use(requireLawyerOnboardingAccess);
```

`requireLawyerOnboardingAccess` should allow either:

1. canonical `lawyer:access`; or
2. ownership of a valid onboarding session/invitation for the requested session/deal.

This keeps normal lawyer workspace functions strict while allowing the onboarding process to create the conditions required for full lawyer access.

**Data Migration / Model Cleanup**

Guest lawyer provisional email access should be moved out of general `dealAccess`.

Preferred model:

- `lawyerInvitations`: invitation target, selected lawyer email, deal, status, token/WorkOS delivery metadata.
- `lawyerOnboardingSessions`: authenticated session owner, invitation/deal linkage, checkpoint state, next route.
- `dealAccess`: durable post-onboarding access by canonical auth ID only.

Under this model:

1. Invitation email match can bootstrap onboarding.
2. Onboarding completion grants auth-ID `dealAccess`.
3. Onboarding completion revokes or closes provisional invitation state.
4. General deal access never checks normalized email.

If keeping provisional `dealAccess` temporarily for migration safety, mark it as an onboarding-only access mode and exclude it from `deal.portal.view`, document access, transfer access, and lawyer action authorization.

**Test Plan**

Add regression coverage before implementation:

1. Invited guest lawyer without `lawyer:access` opening `/lawyer/deals/$dealId` is redirected to onboarding, not `/unauthorized`.
2. Invited guest lawyer without completed onboarding opening `/deals/$dealId` is redirected to onboarding or receives onboarding-only projection; the full deal portal shell is not rendered.
3. Guest lawyer with matching email but no onboarding session receives a valid bootstrap path; no `nextRoute: null` dead-end is allowed.
4. `/lawyer/onboarding/$sessionId` query and checkpoint mutations work for the session owner without global `lawyer:access`.
5. Active auth-ID `guest_lawyer` `dealAccess` without completed onboarding does not grant `primary_lawyer` deal portal capabilities.
6. Provisional email invitation state cannot access document queries, transfer queries, or generic `assertDealAccess`.
7. Completed guest onboarding grants canonical auth-ID `dealAccess`, revokes provisional email access, and allows full lawyer portal capabilities.
8. Platform lawyer access resolves to `primary_lawyer` and requires canonical lawyer role, assignment, verification, and engagement gates.
9. `selling_lender` never maps to `primary_borrower`, `borrower_primary`, or a borrower workspace route.
10. `purchasing_lender` and `selling_lender` both resolve to lender-domain records for access and document recipient attribution.
11. Borrower document roles are resolved only from mortgage borrower records, never from deal seller fields.
12. New document templates can be authored with canonical `DealPersona` signatory roles without using `lender_primary`, `borrower_primary`, or `lawyer_primary`.
13. New document templates can be authored with canonical variables such as `purchasing_lender_*`, `selling_lender_*`, `primary_borrower_*`, and `primary_lawyer_*`.
14. The document authoring UI surfaces the same canonical persona set for variable interpolation and signatory assignment.
15. Existing published templates using legacy signatory roles or variables still generate through explicit same-PR compatibility aliases.

**Implementation Sequence**

1. Add failing policy tests for guest lawyer invitation, onboarding, active lawyer, `selling_lender`, `purchasing_lender`, admin, broker, and closing-team cases.
2. Add canonical `DealPersona` types and boundary adapter tests for WorkOS roles, existing storage roles, legacy portal personas, legacy participant workspace personas, and document signatory roles.
3. Build the pure access classifier and normalize existing persona/capability names through it.
4. Add the Convex resolver that loads deal, access, invitation, onboarding, verification, engagement, and membership facts.
5. Replace `getDealPortalWorkspace` persona logic with the access-policy resolver.
6. Remove the guest-email fallback from general `canAccessDeal`; introduce explicit onboarding bootstrap checks.
7. Add onboarding-specific Convex builders and move onboarding session query/mutations off `lawyerQuery` / `lawyerMutation`.
8. Replace `/lawyer/deals/$dealId` with a bootstrap route that is not trapped behind the `/lawyer` island guard.
9. Update `/deals/$dealId` to redirect incomplete lawyers before rendering the portal.
10. Add document and transfer regression tests proving provisional invitation state does not grant general deal access.
11. Migrate document signatory authoring, validation, generation, and envelope recipient resolution to canonical `DealPersona` roles, with same-PR aliases for existing published templates.
12. Migrate document system variable registry, validation, generation, and UI authoring to canonical variable keys, with same-PR aliases for existing published templates.
13. Update document authoring UI controls so the variable picker and signatory assignment controls both use the canonical `DealPersona` source.
14. Add document mapping regression tests proving all document roles derive from canonical `DealPersona` or an explicitly documented provider boundary.
15. Add document variable regression tests proving new templates use canonical variables and legacy variables are alias-only.
16. Add UI tests proving canonical personas appear in variable/signatory authoring controls and legacy roles are not default new-template choices.
17. Add a legacy-vocabulary guard test proving new internal API outputs do not return `buyer`, `seller`, or `selected_lawyer` as deal personas.
18. Run `bun check`, `bun typecheck`, `bunx convex codegen`, and the targeted portal/onboarding/document tests.

**Initial Validation**

No application code was changed during the original investigation. The targeted tests around this area were run:

`bun run test convex/deals/__tests__/portalQueries.test.ts src/test/deals/deal-portal-page.test.tsx src/test/lawyer/lawyerVerifyRoute.test.tsx`

Result: 3 files passed, 25 tests passed. That confirms the current behavior is internally consistent with the existing tests, but the tests are validating the wrong architecture for the requirements.

**Definition Of Done**

This bug class is considered fully addressed only when every item below is complete. Completing a subset is not sufficient because the failure mode is architectural: authorization, deal personas, document roles, and route behavior must all converge on one model.

Canonical vocabulary:

- [ ] A single canonical `DealPersona` union exists in a shared module used by backend policy, portal projections, participant workspaces, document generation, and document authoring UI.
- [ ] `DealPersona` includes, at minimum, `fairlend_admin`, `purchasing_lender`, `selling_lender`, `participating_lender`, `primary_borrower`, supported co-borrower personas, `broker_of_record`, `assigned_broker`, `primary_lawyer`, and `closing_team_member`.
- [ ] A separate readiness/status type exists for persona state, including lawyer states such as `invited`, `onboarding_required`, `onboarding_in_progress`, `verification_required`, `engagement_required`, `active`, `suspended`, and `revoked`.
- [ ] Lawyer invitation/onboarding states are not modeled as personas. Guest/platform lawyer source is represented as lawyer kind/source metadata that resolves to `primary_lawyer` plus readiness.
- [ ] WorkOS roles are not used as deal personas. WorkOS `lender`, `lawyer`, `broker`, and `admin` roles are treated only as identity/org-level inputs to policy resolution.
- [ ] No new internal API, Convex return shape, route search param, or UI prop emits `buyer`, `seller`, `selected_lawyer`, `selected_lawyer_onboarding_required`, `platform_lawyer`, or `guest_lawyer` as a deal persona.

Boundary adapters and migration shims:

- [ ] Every remaining adapter is classified as one of: external boundary adapter, contextual role refinement, or temporary migration shim.
- [ ] Each temporary migration shim documents the legacy values accepted, canonical value emitted, dependent table/route/template surface, removal migration, and tests guarding against new usage.
- [ ] WorkOS role-to-persona logic requires deal context before converting a broad role such as `lender` into `purchasing_lender` or `selling_lender`.
- [ ] Documenso/provider roles remain quarantined to provider integration code and do not become internal deal personas.
- [ ] Payment counterparty types remain quarantined to payment/banking flows and deal-linked payment metadata carries canonical `DealPersona` where relevant.
- [ ] Mortgage borrower records remain valid for borrower/obligation flows but cannot represent deal seller access, signer routing, or seller portal behavior.

Schema and persisted data:

- [ ] `deals.buyerId` and `deals.sellerId` are migrated or compatibility-wrapped behind canonical fields such as `purchasingLenderAuthId` and `sellingLenderAuthId`.
- [ ] `dealLockCheckoutSessions.buyerAuthId` and `sellerAuthId` are migrated or compatibility-wrapped behind `purchasingLenderAuthId` and `sellingLenderAuthId`.
- [ ] Checkout/reservation `buyerAccountId` and `sellerAccountId` are migrated or explicitly quarantined as settlement-leg terminology, with canonical deal persona metadata available at deal boundaries.
- [ ] `dealAccess.role` no longer acts as the canonical authorization persona. It is replaced by, or augmented with, canonical `DealPersona`.
- [ ] `dealAccess.role = "borrower"` cannot grant access to a selling lender or seller workspace.
- [ ] `platform_lawyer` and `guest_lawyer` are not public authorization personas; they are lawyer kind/source metadata only.
- [ ] Provisional email-based guest lawyer access is removed from general `canAccessDeal` and exists only in onboarding bootstrap policy, if it exists at all.
- [ ] Completion of guest lawyer onboarding grants canonical auth-ID access, revokes/closes provisional invitation state, and records the transition through the governed/audited flow.

Access policy:

- [ ] A central policy resolver exists, for example `resolveDealAccessDecision`, that returns `DealPersona`, readiness, scope, capabilities, denial reasons, and redirect target.
- [ ] Access policy is intent-aware, with intents for deal portal view, onboarding bootstrap/resume, representation confirmation, document review/signing, payment proof actions, transfer/document access, and admin management.
- [ ] Existing generic helpers such as `canAccessDeal` and `assertDealAccess` delegate to the central policy or are replaced by intent-specific assertions.
- [ ] `canAccessDeal` no longer contains guest-lawyer email fallback logic.
- [ ] Direct document and transfer access checks cannot be satisfied by provisional guest lawyer email invitation state.
- [ ] Active `dealAccess` alone is insufficient for full lawyer capabilities; lawyer access also requires required readiness gates.
- [ ] Selling lender and purchasing lender access are distinct and both resolve to lender-domain records.
- [ ] Borrower access is resolved from mortgage borrower records, never from deal seller fields.

Route behavior:

- [ ] `/lawyer/deals/$dealId` is an authenticated bootstrap route that is not blocked by the `/lawyer` global `lawyer:access` parent guard before onboarding can start.
- [ ] Invited guest lawyers opening `/lawyer/deals/$dealId` are redirected to onboarding, not `/unauthorized`.
- [ ] Invited guest lawyers opening `/deals/$dealId` before onboarding are redirected to onboarding or receive onboarding-only projection before any deal portal shell renders.
- [ ] `/deals/$dealId` does not render parties, documents, payment controls, lender controls, or representation screens for `primary_lawyer` readiness states that are not allowed deal portal states.
- [ ] `/lawyer/onboarding/$sessionId` query and mutations authorize by session/invitation ownership or canonical lawyer access, not by global `lawyer:access` alone.
- [ ] `/borrower/deals` is removed, redirected, or changed into a true borrower mortgage/obligation workspace. It is no longer used as a selling-lender deal workspace.
- [ ] `/lender/deals` and lender deal routes use `DealPersona` values such as `purchasing_lender` and `selling_lender`, not `buyer` / `seller`.
- [ ] Route loaders consume backend policy decisions and do not duplicate authorization logic client-side.

Lawyer onboarding:

- [ ] Every lawyer entry point converges into a server-side start/resume onboarding decision.
- [ ] Missing onboarding session for a valid invited lawyer creates or returns a valid bootstrap path. `nextRoute: null` dead-ends are not allowed.
- [ ] Onboarding query/mutations use onboarding-specific builders or policy assertions, not `lawyerQuery` / `lawyerMutation` when that would require `lawyer:access` before onboarding completion.
- [ ] Identity, LSO/verification, IDV/mock IDV, representation engagement, and completion checkpoints advance through governed transitions.
- [ ] Representation confirmation and lawyer document actions require `primary_lawyer + active` readiness.
- [ ] Platform lawyers and guest lawyers both resolve into `primary_lawyer`, with source-specific provisioning/invitation details kept out of the public persona.

Deal projections and workspaces:

- [ ] Deal participant projections expose `purchasing_lender`, `selling_lender`, `primary_borrower`, `primary_lawyer`, broker personas, and supported co-borrower personas as distinct parties.
- [ ] `participants.seller` no longer exists as a source for borrower identity or borrower documents in new projections.
- [ ] Any legacy projection fields such as `buyer`, `seller`, or `lawyer` are compatibility-only and not used by new internal code.
- [ ] Participant deal queues/workspaces consume canonical `DealPersona`.
- [ ] Seller/purchasing-lender/selling-lender display copy uses domain-correct labels.
- [ ] Existing UI surfaces that used buyer/seller shorthand are updated or intentionally hidden behind compatibility paths.

Document engine signatory roles:

- [ ] Canonical `DealPersona` signatory roles are supported in document authoring, validation, template snapshots, package snapshots, generation, and envelope recipient creation.
- [ ] New templates can be authored with canonical signatory roles such as `purchasing_lender`, `selling_lender`, `primary_borrower`, `primary_lawyer`, broker personas, and supported co-borrower personas.
- [ ] New templates do not require `lender_primary`, `borrower_primary`, or `lawyer_primary`.
- [ ] Existing published templates using `lender_primary`, `borrower_primary`, or `lawyer_primary` continue to generate only through explicit same-PR compatibility aliases.
- [ ] `selling_lender` never maps to `borrower_primary`.
- [ ] Borrower signatory roles resolve only from mortgage borrower records.
- [ ] Document generation role-equivalent maps no longer normalize broad `lender` / `borrower` roles into signatory identities in a way that can hide wrong-party mappings.
- [ ] Template validation rejects unsupported legacy/broad roles for new templates unless they are explicitly marked as compatibility aliases for existing published versions.

Document system variables:

- [ ] Canonical system variables exist for each supported `DealPersona`, including `purchasing_lender_*`, `selling_lender_*`, `primary_borrower_*`, `primary_lawyer_*`, broker persona variables, and supported co-borrower variables.
- [ ] Canonical variable source paths resolve from the same canonical participant graph used for access policy and signatory resolution.
- [ ] `borrower_primary_*` variables resolve from mortgage borrower records, not deal seller fields.
- [ ] `lender_primary_*`, `borrower_primary_*`, and `lawyer_primary_*` remain only as explicit aliases for existing published templates.
- [ ] New templates cannot accidentally depend on legacy variable keys as default choices.
- [ ] Variable registry, validation, generation, package snapshotting, and preview/mapping UI all support canonical variables.
- [ ] Missing canonical variable data produces clear validation/remediation output rather than silently falling back to another party.

Document authoring UI:

- [ ] Variable picker surfaces canonical persona variables grouped by canonical `DealPersona`.
- [ ] Signatory role controls surface the same canonical persona set as the variable picker.
- [ ] UI labels distinguish `Purchasing Lender`, `Selling Lender`, and `Primary Borrower`.
- [ ] Legacy roles/variables are not default choices for new templates.
- [ ] Existing published templates using legacy roles/variables display compatibility metadata clearly enough for admins to understand why aliases are present.
- [ ] Package mapping/remediation UI maps template roles/variables to canonical personas, not buyer/seller shorthands.

Envelope and signing:

- [ ] Envelope recipient resolution uses canonical `DealPersona` and never routes `borrower_primary` to deal seller.
- [ ] `purchasing_lender` and `selling_lender` recipients both resolve to lender-domain records.
- [ ] `primary_borrower` and co-borrower recipients resolve from mortgage borrower graph.
- [ ] `primary_lawyer` recipients resolve only when lawyer readiness permits signing/approval.
- [ ] Embedded signing token lookup uses canonical recipient/persona data.
- [ ] Provider sync maps recipients back to canonical personas or canonical participant IDs, not legacy/broad role strings alone.

Payment and transfer behavior:

- [ ] Payment proof submitter roles use canonical deal personas and readiness/source metadata, not broad `lender`, `guest_lawyer`, or `platform_lawyer` personas.
- [ ] Upload/review/approve/reject capabilities are derived from central policy.
- [ ] Payment/transfer queries do not grant access through provisional lawyer invitation state.
- [ ] Deal-linked payment metadata includes canonical persona where needed to disambiguate selling vs purchasing lender.
- [ ] Existing cash ledger/payment counterparty vocabulary remains quarantined to payments and does not leak into deal portal persona decisions.

Tests:

- [ ] Policy tests cover admin, purchasing lender, selling lender, participating lender, primary borrower, brokers, closing team, invited lawyer, onboarding lawyer, active lawyer, suspended/revoked lawyer, and unauthorized viewers.
- [ ] Route tests cover `/lawyer/deals/$dealId`, `/lawyer/onboarding/$sessionId`, `/deals/$dealId`, `/lender/deals`, and removal/redirect/repurpose of `/borrower/deals`.
- [ ] Regression tests prove `seller -> borrower` no longer exists.
- [ ] Regression tests prove `selling_lender` never maps to `primary_borrower`, `borrower_primary`, or borrower route/workspace.
- [ ] Regression tests prove provisional guest lawyer email invitation state cannot access deal portal, documents, transfers, or payment proof resources.
- [ ] Regression tests prove missing lawyer onboarding session yields a valid bootstrap path, not `nextRoute: null`.
- [ ] Document tests prove new templates can use canonical signatory roles and canonical variables.
- [ ] Document tests prove existing legacy published templates generate through explicit aliases.
- [ ] Document tests prove borrower recipients and variables resolve only from mortgage borrower records.
- [ ] UI tests prove variable picker and signatory controls expose canonical personas and do not default to legacy roles.
- [ ] Legacy-vocabulary guard tests fail if new internal APIs return `buyer`, `seller`, `selected_lawyer`, `selected_lawyer_onboarding_required`, `lender_primary`, or `borrower_primary` as canonical values.

Migration and compatibility:

- [ ] Migration/backfill strategy exists for persisted deal, checkout, access, package, template, and variable data touched by the refactor.
- [ ] All compatibility aliases are named, tested, and documented with removal criteria.
- [ ] Existing published templates continue to generate after the migration.
- [ ] Existing in-flight deals either backfill cleanly or are handled by explicit compatibility code.
- [ ] No compatibility shim is used by new authoring flows or new API outputs.
- [ ] Any schema changes are reflected in validators, generated Convex types, seed data, and fixtures.

Validation gates:

- [ ] `bun check` passes.
- [ ] `bun typecheck` passes.
- [ ] `bunx convex codegen` passes with no unexpected generated drift.
- [ ] Relevant unit and Convex tests pass, including deal access, portal, participant workspace, lawyer onboarding, document engine, document packages, envelopes, payment proofs, transfers, and checkout handoff tests.
- [ ] Frontend tests for document authoring and portal routing pass.
- [ ] If routes or UI flows changed materially, Playwright or equivalent browser verification covers the lawyer onboarding redirect, blocked deal portal, lender deal workspace, and document authoring controls.
- [ ] GitNexus impact/change detection confirms affected symbols and flows match the intended refactor scope.
- [ ] The final implementation report lists every remaining quarantined legacy vocabulary and confirms none are used as canonical deal personas.
