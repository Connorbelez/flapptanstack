# Spec Audit: ENG-361 - Legal representation: manage platform lawyer profiles and eligibility

- Audit skill: `$linear-pr-spec-audit`
- Review target: current worktree diff against HEAD
- Last run: 2026-04-30T15:40:00Z
- Verdict: ready

## Findings
- None. The two P1 review findings are resolved.

## Unresolved items
- None for ENG-361 spec compliance.

## Coverage Summary
- SATISFIED: 14
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0
- OUT_OF_SCOPE: 4

## Requirement Ledger

| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | capability | Admin can create/designate platform lawyer profiles | `convex/legalRepresentation/platformLawyers.ts` `createOrDesignatePlatformLawyer` | Uses fluent `adminMutation`.
| SATISFIED | capability | Admin can activate, suspend, and offboard platform lawyer profiles | `activatePlatformLawyer`, `suspendPlatformLawyer`, `offboardPlatformLawyer` | Status changes are persisted on `lawyerProfiles.platformStatus`.
| SATISFIED | auth | Platform lawyer management requires FairLend admin authorization | `adminMutation`/`adminQuery`; `platformLawyers.test.ts` rejects external admin | Uses `requireFairLendAdmin` chain.
| SATISFIED | WorkOS identity contract | Active platform profiles must refer to a canonical WorkOS lawyer identity | `assertCanonicalWorkosLawyerIdentity` resolves `users.authId`, matches profile email, and requires an active `organizationMemberships` roleSlug/roleSlugs entry containing `lawyer` or `platform_lawyer` before active creation, activation, listing, or checkout | `platform_lawyer` is accepted per the latest WorkOS-dashboard direction; `guest_lawyer` is not accepted for platform selectability.
| SATISFIED | RBAC role contract | Platform lawyer selectability is tied to canonical WorkOS lawyer role state | Active profile creation, activation, listing, and checkout all re-read current synced WorkOS user/membership state | `guest_lawyer` remains a manual checkout snapshot type, not a platform lawyer role.
| SATISFIED | data model | Store platform-vs-guest distinction in FairLend domain fields | `lawyerProfiles.profileKind`; existing `dealAccess.role` unchanged | Upserts merge guest profiles to `both` instead of new WorkOS role.
| SATISFIED | eligibility | Only active eligible platform lawyers are selectable for checkout | `prepareMarketplaceCheckout` calls `assertCheckoutLawyerSelectable`, which re-reads the managed profile through `assertPlatformLawyerAuthSelectableForCheckout` and canonicalizes the stored snapshot from server-side profile evidence and current WorkOS role state | Direct checkout calls fail closed for suspended, offboarded, expired, restricted, stale, missing, or WorkOS-role-drifted platform lawyer profiles.
| SATISFIED | admin visibility | Suspended/offboarded profiles remain visible to admins | `listPlatformLawyersForAdmin`; platform lawyer test verifies suspended visibility | Checkout query filters them out.
| SATISFIED | auditability | Status changes create immutable evidence rows | `recordPlatformStatusEvidence` writes `lawyerVerifications` manual_admin rows and updates `latestVerificationId` | Active eligible manual evidence now requires canonical WorkOS lawyer identity first.
| SATISFIED | seed path | Deterministic admin seed path covers two active, one suspended, one requires-review lawyer | `seedPlatformLawyerRoster`; tests assert visible/hidden roster behavior | Uses deterministic test identities and evidence.
| SATISFIED | checkout integration | Marketplace listing detail consumes managed profile source | `convex/listings/marketplace.ts` now calls `listPlatformLawyerOptions` | Removes stale mortgage closing-team option source for displayed platform options.
| SATISFIED | payload compatibility | Existing selected platform lawyer payload remains compatible | `ListingDetailPage.tsx` keeps `lawyerId`, `name`, `email`, optional `firm`; optional `lso` is already validator-supported | No dealAccess/lawyer workspace mutation changed.
| SATISFIED | tests | Tests cover admin authorization, duplicate auth ID behavior, status projection, checkout filtering, WorkOS role drift, direct checkout stale-profile rejection, direct checkout role-drift rejection, and canonical server snapshot replay | `platformLawyers.test.ts`; `marketplace.test.ts`; `checkout/start.test.ts`; listing detail checkout test run | Changed backend suites pass unfiltered.
| SATISFIED | validation | Required quality gates pass | `bunx convex codegen`, `bun check`, `bun typecheck`, targeted tests | `bun check` emits existing warning-only complexity diagnostics.
| SATISFIED | dependency contract | ENG-359 profile/verification contracts are consumed rather than duplicated | Uses existing `lawyerProfiles`, `lawyerVerifications`, verification helpers | Checkout submission now consumes the managed profile eligibility helper before persisting platform lawyer selection.
| OUT_OF_SCOPE | UI | Full admin management UI | Notion open question; issue scope allows backend/admin seed path | No UI added.
| OUT_OF_SCOPE | invitations | Guest invitation tokens and WorkOS invite flow | Explicitly out of scope | No implementation added.
| OUT_OF_SCOPE | SLA/availability | Availability calendar/SLA/recheck timers | Explicitly downstream ENG-365 | No implementation added.
| OUT_OF_SCOPE | engagement signing | Representation engagement signing UI | Explicitly out of scope | No implementation added.

## Next action
- No ENG-361 spec-audit follow-up remains.

## Validation
- `bun check` passed with existing warning-only diagnostics.
- `bunx convex codegen` passed.
- `bun typecheck` passed.
- `bun run test convex/legalRepresentation/__tests__/platformLawyers.test.ts convex/listings/__tests__/marketplace.test.ts convex/checkout/__tests__/start.test.ts -- -t "platform lawyer|lawyer snapshots|stale platform lawyer|WorkOS role sync|different lawyer|different LSO|prepares a reservation"` passed: 3 files, 72 tests.
- `bun run test convex/legalRepresentation/__tests__/platformLawyers.test.ts convex/listings/__tests__/marketplace.test.ts convex/checkout/__tests__/start.test.ts` passed: 3 files, 72 tests.
- `bun run test src/test/listings/listing-detail-checkout.test.tsx -- -t "platform lawyer"` passed: 1 file, 16 tests.
- Full `bun run test` was not rerun after the final role-drift patch; the changed backend suites now pass unfiltered.
