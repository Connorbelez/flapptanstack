# Document Engine and Documenso Integration Footguns

Date: 2026-05-01

This report captures the failure modes encountered while wiring the deal closing demo through FairLend document packages, template interpolation, signatory mapping, Documenso envelope creation, embedded signing, and reset/regeneration. The goal is to turn the debugging pain into implementation constraints for the production document engine.

## Executive Summary

The hardest issues were not isolated Documenso API mistakes. They came from contract drift between four layers:

1. Template designer concepts: template variables, template signatory roles, signable fields.
2. Mortgage/deal package concepts: deal variables, deal participants, blueprint mappings.
3. Lifecycle gates: locked lawyer onboarding vs document signing open.
4. Provider concepts: Documenso recipients, fields, signing order, envelope cleanup, embedded signing sessions.

The main lesson: document generation must have a typed, preflighted contract before provider calls. If a template requires a variable or signer role, the package should know whether it is resolvable before generation. If a signer exists, the provider payload must prove that signer has at least one signature-capable field before envelope creation.

## What Went Wrong

### 1. Template signatory roles drifted from deal signatory roles

Observed failures:

- `Signatory mapping validation failed: missing mappings for: fairlend_broker`
- Later, `fairlend_broker` mapped to a recipient but had no signature field.

Root cause:

- The template designer used legacy/demo roles such as `fairlend_broker`, `lender`, and `borrower`.
- Mortgage document packages used production deal roles such as `broker_of_record`, `lender_primary`, `borrower_primary`, and `lawyer_primary`.
- We initially treated role mapping as a loose runtime convenience rather than a first-class package contract.

Footgun:

- It is possible for a signatory role to map to a recipient while the fields are attached to a different equivalent role. That creates a Documenso signer with zero signature fields.

Recommended implementation:

- Introduce a single `DocumentRoleMappingContract` module that owns:
  - canonical production roles,
  - legacy/demo role aliases,
  - template-role-to-deal-role overrides,
  - field-role equivalence rules,
  - UI labels/colors for those roles.
- Make package publish fail if a signatory role can resolve but its required signer fields cannot.
- Validate this invariant at template publish and package publish:
  - every `snapshot.signatories[].platformRole` has a deal participant mapping or explicit override,
  - every `signatory` with role `signatory` has at least one signature-capable field after role alias expansion,
  - every signable field role either appears in `snapshot.signatories` or is covered by a declared alias.

### 2. Variable interpolation had no single source of truth

Observed failures:

- Missing variables such as `test_str_n72b_pv2`.
- Confusion between system variables catalogued in the document engine and variables available during deal creation.
- Legacy variables and demo variables were mixed into templates without guaranteed package-side materialization.

Root cause:

- Template variables were authored independently from the deal package variable resolver.
- Package generation learned about missing variables late, during PDF generation, not at package publication or selection time.

Footgun:

- A template can be published with variables that are legal in the designer but impossible to resolve for a deal package.

Recommended implementation:

- Treat variables as a typed registry, not arbitrary strings.
- Separate variable classes:
  - `system`: canonical variables always owned by code, such as `borrower_primary_email`.
  - `mapped`: template variables mapped to canonical deal variables.
  - `custom`: intentionally provided by a workflow or admin form.
  - `legacy_alias`: accepted only through explicit migration/alias metadata.
- Add a package preflight query returning:
  - required template variables,
  - resolved deal variables,
  - missing variables,
  - alias substitutions,
  - variable source provenance.
- Store a generation-time interpolation snapshot on each generated document:
  - template version,
  - variable keys used,
  - variable values or redacted value hashes for sensitive fields,
  - source table/entity for each variable.
- Block signing-envelope creation when interpolation is incomplete. Non-signing preview documents may be generated only if the product explicitly allows partial placeholders.

### 3. Documenso payload shape was easy to get subtly wrong

Observed failures:

- `Invalid literal value, expected "signature"` at `payload.recipients[...].fields[...].fieldMeta.type`.
- `The following recipients are missing required fields... Signers must have at least one signature field.`

Documenso references:

- Envelope creation uses `POST /api/v2/envelope/create` with multipart form data and a JSON `payload`.
- Recipients are supplied in `payload.recipients`, with role and optional signing order.
- Fields are nested under each recipient as `fields`.
- Field `type` uses uppercase values such as `SIGNATURE`.
- `fieldMeta` has its own type metadata and Documenso validation expects lowercase literal values such as `signature`.
- Distribution happens after creation with `POST /api/v2/envelope/distribute`.

Sources:

- https://documenso.com/blog/how-to-create-and-send-envelopes-with-documenso
- https://docs.documenso.com/docs/developers/api/recipients

Footguns:

- `field.type` and `fieldMeta.type` are not the same shape.
- Documenso allows creating envelopes in stages, but distribution will reject signers without required signature fields.
- Provider responses may not echo signing order exactly as submitted. Matching recipients only on signing order can lose `providerRecipientId`.

Recommended implementation:

- Keep all Documenso-specific shape conversion inside one provider adapter.
- Define provider-facing schema tests with captured expected payloads:
  - uppercase `field.type`,
  - lowercase `fieldMeta.type`,
  - percent-based positions,
  - 1-based page numbers,
  - stable `identifier` for multi-document envelopes.
- Add provider preflight before `createEnvelope`:
  - every `SIGNER` has at least one `SIGNATURE` or `FREE_SIGNATURE` field,
  - every field has valid page and percent bounds,
  - every recipient has name, email, provider role, and deterministic signing order,
  - no signer is only receiving text/date/name fields.
- Match returned recipients by stable attributes in this order:
  - provider id if known,
  - email + platform role if preserved locally,
  - email + provider role + submitted signing order,
  - email + provider role fallback.
- Persist response bodies on provider failures. A status code without the body is not enough for debugging.

### 4. Signing lifecycle gates were mixed with package generation state

Observed failures:

- Locked state still attempted signing envelope generation.
- After admin approval, the UI moved but backend state did not.
- Reset/regenerate left the demo in Documents instead of returning to Locked.

Root cause:

- Package generation and signing creation were coupled too loosely to the deal state machine.
- The demo reset path reused an existing deal graph without resetting lifecycle state.

Footgun:

- If generation sees `documentReview.pending`, it creates live signing envelopes. If reset forgets to move the deal back to `lawyerOnboarding.pending`, a reset accidentally becomes an unlock-and-sign operation.

Recommended implementation:

- Treat lifecycle gates as hard provider boundaries:
  - `lawyerOnboarding.pending` and `lawyerOnboarding.verified`: generate review/preview documents only; do not create or distribute signing envelopes.
  - `documentReview.pending`: signing-envelope creation is allowed.
  - later states: only sync/archive existing signing artifacts unless a governed reissue transition says otherwise.
- Use governed transitions for real state changes wherever possible. If demo-only reset must patch state directly, journal that patch and keep it isolated to demo functions.
- Add a single helper such as `canStartSigningForDealStatus(status)` and use it in:
  - package generation,
  - embedded signing session creation,
  - UI launch eligibility,
  - tests.

### 5. Reset cleanup left stale local state visible

Observed failures:

- Reset/regenerate doubled or multiplied package/document groups.
- Stale rows remained visible as `Signature Sent / Provider Error`.
- Documenso cleanup returned `not_deletable`, but the local active instance still appeared.

Root cause:

- Remote cleanup and local cleanup were treated as one operation.
- If Documenso could not delete an old envelope, local rows were marked provider error but not always archived from the active package instance list.

Footgun:

- A provider cleanup failure should not leave obsolete local rows active. Remote not-deletable means "cannot delete provider artifact", not "keep this as the current document instance."

Recommended implementation:

- Split reset cleanup into two phases:
  - remote cleanup best effort: delete/void provider envelope where possible,
  - local reset authoritative: archive obsolete local instances and clear active generated document provider references.
- Keep remote cleanup result as audit metadata, not as active UI state.
- Active package surfaces should exclude archived rows by default and expose an explicit "history/attempts" view for debugging.
- Reset should be idempotent:
  - repeated reset should not increase active instance count,
  - stale provider envelopes should not block local reset,
  - generated replacement rows should be deterministic for the same package version.

### 6. Embedded signing eligibility was too portal-centric

Observed failures:

- Admin saw a Documents tab without a signing interface.
- The portal signing rules required current viewer identity to match a recipient, which is correct for real portals but wrong for this admin demo surface.

Root cause:

- The demo admin page reused portal recipient eligibility.

Footgun:

- Admin launch and recipient launch are different capabilities. Sharing one boolean hides valid admin workflows or weakens portal auth.

Recommended implementation:

- Keep separate APIs and predicates:
  - `canRecipientLaunchEmbeddedSigning`: strict current viewer is recipient, previous signing orders complete.
  - `canAdminLaunchDemoEmbeddedSigning`: admin/demo boundary, select next pending recipient, still honor deal status and signing order.
- Never use the demo admin launcher in production portal routes.
- Embedded signing session actions should verify:
  - deal id belongs to the expected surface,
  - instance belongs to that deal,
  - deal state permits signing,
  - envelope is `sent` or `partially_signed`,
  - next recipient has `providerRecipientId`,
  - previous recipients are signed.

### 7. Error surfaces were too shallow early on

Observed failures:

- Terminal logs only showed `Documenso POST /envelope/create failed with status 400`.
- The actual useful detail was in the response body.

Root cause:

- Provider adapter errors did not include enough response body context.

Recommended implementation:

- Provider errors should include:
  - provider,
  - method/path,
  - status code,
  - truncated response body,
  - envelope id if known,
  - local package id/generated document id if known.
- Store these in:
  - action logs,
  - `signatureEnvelopes.lastError`,
  - `dealDocumentInstances.lastError`,
  - audit/provider event rows where appropriate.
- Add an admin-only diagnostics panel that shows:
  - generation attempts,
  - provider attempts,
  - cleanup results,
  - mapping preflight output.

## Suggested Feature Implementations

### A. Variable Interpolation Contract

Implement a versioned interpolation contract:

```ts
type DocumentVariableSource =
  | "deal"
  | "mortgage"
  | "property"
  | "borrower"
  | "lender"
  | "broker"
  | "lawyer"
  | "custom"
  | "legacy_alias";

interface ResolvedDocumentVariable {
  key: string;
  value: string;
  source: DocumentVariableSource;
  sourceId?: string;
  redaction: "none" | "pii" | "financial";
}

interface InterpolationPreflightResult {
  templateId: string;
  templateVersion: number;
  requiredKeys: string[];
  resolved: ResolvedDocumentVariable[];
  missing: string[];
  aliasesApplied: Array<{ from: string; to: string }>;
}
```

Implementation rules:

- Preflight must run before package publish and before deal generation.
- Missing variables produce deterministic configuration errors.
- Runtime values should be snapshotted with the generated document so regenerated documents are auditable.
- Legacy aliases should be visible in preflight output and should have a deprecation owner/date.

### B. Signatory Mapping Contract

Implement a versioned signatory mapping contract:

```ts
interface TemplateSignatoryRequirement {
  templatePlatformRole: string;
  role: "signatory" | "approver" | "viewer";
  requiredSignatureFieldCount: number;
}

interface SignatoryMappingResolution {
  templatePlatformRole: string;
  dealParticipantRole: string;
  participantName: string;
  participantEmail: string;
  aliasesApplied: string[];
  signatureFieldCount: number;
}
```

Implementation rules:

- A `signatory` with `signatureFieldCount === 0` is invalid.
- A `viewer` or `approver` may have zero signature fields, but should not be sent as `SIGNER`.
- Field role aliases must be applied before counting signature fields.
- Designer UI should warn immediately when a signatory exists without fields.

### C. Documenso Envelope Generation

Recommended flow:

1. Resolve package blueprint snapshot.
2. Run interpolation preflight.
3. Run signatory mapping preflight.
4. Generate PDF.
5. If deal is locked, persist document as `available` with `signingStatus: draft` or `not_applicable`; do not call Documenso.
6. If deal permits signing, build provider payload.
7. Validate provider payload locally.
8. `POST /api/v2/envelope/create`.
9. Persist provider envelope and provider recipient ids.
10. `POST /api/v2/envelope/distribute`.
11. Sync envelope state and recipients.

Implementation rules:

- Never call distribute if any signer has no signature-capable fields.
- Never create provider envelopes from a locked state.
- Create/distribute should be idempotent around local generated document id and provider envelope id.
- If persistence fails after provider create, attempt remote cleanup, then archive local failed attempt and store cleanup result.

### D. Legacy Variable and Role Mapping

Legacy mappings should be explicit, test-covered, and migratable.

Current examples:

- `fairlend_broker` -> `broker_of_record`
- `borrower` -> `borrower_primary`
- `lender` -> `lender_primary`
- `lender_lawyer`, `borrower_lawyer`, `seller_lawyer` -> `lawyer_primary` where appropriate for the current mortgage package context.

Recommended implementation:

- Add `documentEngine/legacyMappings.ts` as the only source of legacy aliases.
- Add migration tooling:
  - list templates using legacy variables/roles,
  - propose canonical replacements,
  - optionally rewrite draft templates,
  - never silently rewrite published versions.
- Package publish should include a legacy mapping report so operators can see when compatibility mode is being used.

### E. Admin Approval Gate

The locked state needs a real gate, not just hidden buttons.

Recommended UI:

- Locked state page shows:
  - selected package,
  - generated preview/review documents,
  - selected lawyer,
  - borrower/lender/broker participants,
  - unresolved mappings or missing fields,
  - approval button.
- Approval button calls a single backend action that:
  - verifies demo/admin eligibility,
  - advances the governed state to `documentReview.pending`,
  - retries package generation with signing enabled,
  - returns package generation status and diagnostics.

### F. Observability and Diagnostics

Add a first-class diagnostics object:

```ts
interface DocumentGenerationDiagnostics {
  packageId: string;
  dealId: string;
  dealStatus: string;
  templateResults: Array<{
    templateId: string;
    templateVersion: number;
    interpolation: InterpolationPreflightResult;
    signatories: SignatoryMappingResolution[];
    providerPayloadStatus: "not_applicable" | "valid" | "invalid";
    providerError?: string;
  }>;
}
```

Use it in:

- admin document package screens,
- demo pages,
- tests,
- support/debug logs.

## Required Tests Going Forward

Every document package/provider change should include tests for:

- missing variable fails before provider call,
- legacy role alias maps recipient and fields together,
- signer with no signature field fails locally before provider call,
- locked state generates no Documenso envelope,
- approval unlocks signing and creates/distributes envelopes,
- reset returns deal to locked state,
- reset archives stale local rows even when provider cleanup is not deletable,
- Documenso payload shape matches documented API,
- provider recipient ids persist when signing order echo differs,
- embedded signing refuses locked state and lower-order incomplete recipients.

## Production Readiness Checklist

- Centralize variable registry and legacy aliases.
- Centralize signatory role aliases and field equivalence.
- Add package/template preflight before publish.
- Add deal generation preflight before PDF generation.
- Keep Documenso payload construction isolated in provider adapter.
- Persist provider response bodies on errors.
- Make reset idempotent and locally authoritative.
- Keep lifecycle gates separate from provider state.
- Separate admin demo embedded signing from real recipient portal signing.
- Add diagnostics surfaces for mappings, variables, provider payloads, and cleanup.

