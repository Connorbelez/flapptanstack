# Demo Deal Closing Documenso Signing Design

## Purpose

Replace the static `/demo/deal-closing-pipeline` signing mock with a real Documenso-backed deal portal demo. The demo must generate a known signable document package, attach it to a fixed demo deal, create live Documenso envelopes, launch embedded signing through Documenso's React signing component, and show webhook-confirmed signing activity in the audit trail.

The demo is not a parallel signing implementation. It is a route-scoped harness over the production document engine, deal package, signature provider, and audit surfaces.

## Source Context

Relevant repo context reviewed:

- `src/routes/demo/deal-closing-pipeline.tsx` currently renders a static fixture.
- `src/components/demo/deal-closing/DealClosingPipelineDemo.tsx` currently shows mocked envelope state and an iframe backed by generated `srcDoc` HTML.
- `src/components/demo/deal-closing/fixtures.ts` contains the static deal, envelope, and signing HTML fixture.
- `convex/documents/dealPackages.ts` already materializes deal document packages, generates templated PDFs, creates Documenso envelopes, stores normalized `signatureEnvelopes` and `signatureRecipients`, and builds portal-safe signing surfaces.
- `convex/documents/signature/documenso.ts` already implements the Documenso provider seam for creating, distributing, syncing, deleting, downloading, and creating embedded signing sessions.
- `convex/documents/signature/sessions.ts` already gates embedded signing session creation by deal access and current user recipient matching.
- `convex/documents/signature/webhooks.ts` exposes a manual sync action for signable document envelopes.
- `convex/deals/envelopeWebhooks.ts` contains a Documenso webhook ingestion pipeline for provider events.
- `docs/superpowers/specs/2026-04-28-document-engine-production-packages-design.md` defines packages, groups, and signable package materialization semantics.
- Documenso embedding docs: https://docs.documenso.com/docs/developers/embedding?utm_source=blog&utm_campaign=introducing-embedding.

Documenso's embedding docs distinguish direct template embedding from programmatic document signing. This demo creates documents programmatically, so it should use `EmbedSignDocument` from `@documenso/embed-react` with the recipient signing token. It should not use `EmbedDirectTemplate`, which is for direct evergreen templates.

## Fixed Demo Inputs

The demo uses a fixed package and fixed lender identity.

Package:

- title: `test full package april30`
- table: `documentPackageDefinitions`
- id: `rd7t376j110ynd5gnvtnskhzch85vnen`

Lender:

- FairLend user id: `k57ed93m3d2w0h2n3q0h8447hd81p79k`
- WorkOS auth id: `user_01KJ6BJXS10933HSV7KYJ9HXMN`
- email: `connor.belez@gmail.com`

The route should use one fixed demo deal. It should expose a visible reset/regenerate control that recreates the signing package for that deal.

## Decisions

- Use real Documenso mode across the demo path.
- Use the known package `test full package april30` instead of a generic package picker.
- Use a fixed demo deal for `/demo/deal-closing-pipeline`.
- Keep the route deterministic with a visible reset/regenerate package action.
- During reset cleanup, attempt Documenso envelope deletion first. If deletion is rejected because the envelope state is no longer deletable, record the cleanup result and locally supersede the prior demo artifacts.
- Keep frontend interaction portal-safe: the route never builds Documenso payloads, never chooses recipient emails, and never receives provider admin URLs.
- Use unit-level fakes only where needed to assert exact request construction, payload shape, and failure behavior. The primary demo and e2e target is live Documenso.

## Architecture

`/demo/deal-closing-pipeline` becomes a real route-scoped signing harness over production document package and signature services.

The route loads a fixed demo deal and a package surface for `test full package april30`. A demo-only Convex module should provide:

- a read query for the route's current demo state
- a reset/regenerate action
- narrow bootstrap helpers for the fixed deal and lender identity
- cleanup logic for prior demo-generated envelopes, with persisted outcomes for deleted, not-deletable, and provider-error cases

The demo module should call shared document-package/signature services rather than duplicate generation logic. If the existing materialization code does not expose a clean callable for "materialize this package definition/version for this deal", add a small shared service seam and use it from both production and demo paths.

Embedded signing must use `EmbedSignDocument` from `@documenso/embed-react`. The frontend opens the signing modal only after the backend read model reports that the current viewer can sign the selected document. Opening the modal calls the backend with only `dealId` and `dealDocumentInstanceId`; the backend derives the current WorkOS user, resolves the linked FairLend user, matches the user to a stored `signatureRecipient`, fetches the recipient signing token/session, and returns only the data needed for the embedded signing component.

Webhook confirmation should update normalized signing state and audit events. `onDocumentCompleted` from the embedded component may trigger immediate sync refresh, but webhook-confirmed state remains the source of truth.

## Components

### Demo Convex Harness

Create or extend `convex/demo/dealClosingPipeline.ts`.

Responsibilities:

- ensure the fixed demo deal exists
- ensure the fixed lender participant is attached to the demo deal
- read the package definition by fixed id and verify its title
- materialize the package for the fixed deal
- clean up or supersede prior demo-created local rows
- delete prior demo-created Documenso envelopes when the provider accepts deletion, otherwise locally supersede them and record the provider outcome
- return a portal read model for the route
- record audit events for setup, cleanup, generation, provider requests, signing sessions, webhooks, and failures

### Package Materialization Seam

Reuse `convex/documents/dealPackages.ts` for generation, variable resolution, signatory mapping, provider envelope creation, and normalized signing rows.

The seam must produce or expose validation artifacts for the demo:

- variable bag used for interpolation
- missing variables
- resolved signatories
- generated document ids
- envelope ids
- provider envelope ids
- Documenso payload summary, including title, external id, recipients, roles, signing order, and field counts

Validation artifacts should be safe to show in the demo UI and useful for confirming that interpolation and signatory assignment worked.

### Signing UI

Replace the mocked `srcDoc` iframe in `src/components/demo/deal-closing/DealClosingPipelineDemo.tsx`.

The signing modal should:

- render `EmbedSignDocument` only after a backend session is issued
- pass the recipient token to the component
- use `DOCUMENSO_APP_BASE_URL` from backend configuration when a non-default Documenso host is configured
- refresh local state on `onDocumentCompleted`
- show provider errors and unavailable states clearly

The route should show package status, document status, recipient state, current viewer eligibility, and the reset/regenerate action.

### Audit Trail

The audit rail should be backed by real events instead of fixtures.

Audit events should cover:

- demo deal ensured
- package reset started
- prior envelope cleanup attempted
- package generation started/completed/failed
- variable interpolation completed/failed
- signatory resolution completed/failed
- Documenso envelope created/distributed/failed
- embedded signing session issued/denied
- webhook received
- recipient opened/signed/declined
- envelope completed/declined/voided
- manual sync performed

Each event should include enough metadata to trace deal id, package id, package definition id, generated document id, deal document instance id, signature envelope id, provider envelope id, recipient id/email, actor, source, and error message where applicable.

## Data Flow

1. Route query loads fixed demo deal, selected package definition, package status, document instances, signing recipients, and audit events.
2. Operator clicks reset/regenerate.
3. Backend records a reset-start audit event.
4. Backend attempts to delete prior demo-created Documenso envelopes. If the provider rejects deletion, backend records the outcome and continues with local supersession.
5. Backend locally supersedes or archives previous demo package artifacts.
6. Backend materializes `test full package april30` for the fixed demo deal.
7. The document engine interpolates variables and produces generated PDFs.
8. The signature provider creates live Documenso envelopes and recipients.
9. Backend persists normalized `signatureEnvelopes` and `signatureRecipients`.
10. Route shows signable documents and current recipient state.
11. Authorized signatory opens embedded signing through backend session issuance.
12. Documenso webhook updates normalized signing state and audit events.
13. Route displays signed/completed state once webhook or sync confirms it.

## Security Rules

- The frontend must never send or choose signer email.
- The frontend must never send provider recipient id.
- The frontend must never receive a provider admin URL.
- Embedded session creation accepts only `dealId` and `instanceId`.
- Backend derives the current user from WorkOS auth.
- Backend resolves the FairLend user row by auth id.
- Backend matches the user to `signatureRecipients.userId` and, where needed, canonical normalized email.
- A request from a non-signatory must fail even if the caller manipulates client payload data.
- A caller cannot spoof another recipient because email and provider recipient id are not accepted as action inputs.
- Package generation must use canonical participant data, including the fixed lender identity, not caller-submitted participant data.
- Access still requires normal deal access before recipient matching.

## Error Handling

Missing fixed package definition:

- Show setup error.
- Disable signing.
- Record an audit event.

Missing fixed demo deal or participant:

- Attempt bootstrap through the reset action.
- Record success or failure.

Variable interpolation failure:

- Do not create a Documenso envelope.
- Persist the missing variable list.
- Show the failure on the document row and audit rail.

Signatory resolution failure:

- Do not fake recipients.
- Mark the document/package with recipient-resolution failure.
- Show unresolved roles.
- Record an audit event.

Documenso create/distribute failure:

- Persist generated PDF and local provider failure state.
- Store provider error metadata.
- Allow reset/regenerate.

Webhook not received:

- Keep local state as unconfirmed.
- Provide manual sync.
- Show that webhook confirmation has not arrived.

Reset cleanup failure:

- Continue local supersession if necessary.
- Surface which remote envelope could not be deleted or cancelled.
- Record cleanup failure metadata.

## Testing

### Unit And Integration Tests

Add or extend tests around the package/signature path:

- Package-to-Documenso payload builder produces the expected title, external id, recipients, roles, signing order, field locations, and field counts.
- Variable interpolation resolves expected fixed-demo values.
- Missing required variables block envelope creation.
- Generated document metadata records the variable bag and package provenance.
- Lender signatory resolves to `connor.belez@gmail.com` and `k57ed93m3d2w0h2n3q0h8447hd81p79k`.
- Every Documenso recipient maps to the expected platform role.
- Embedded signing session succeeds for the logged-in signatory.
- Embedded signing session fails for a non-signatory.
- Payload email spoofing is impossible because email is not accepted.
- Mismatched auth/user/email fails.
- Webhook events update normalized envelope/recipient rows.
- Webhook events append audit trail entries.
- Reset cleanup attempts provider deletion/cancellation for prior demo-created envelopes.

Unit tests may use fetch fakes to inspect exact live Documenso request construction. This is for deterministic payload-shape verification only; the demo's runtime mode remains real Documenso.

### Playwright E2E

Add a live Documenso e2e path for the demo route:

1. Sign in as the fixed lender account.
2. Open `/demo/deal-closing-pipeline`.
3. Click reset/regenerate.
4. Verify the package and live envelope rows are visible.
5. Verify variable/signatory validation artifacts are displayed.
6. Open embedded signing for the authorized lender.
7. Complete signing when the Documenso environment supports it.
8. Verify webhook-confirmed or sync-confirmed audit state.
9. Clean up created Documenso envelopes during test teardown by calling provider deletion and recording any not-deletable envelope ids in the test artifact output.

The e2e should skip or fail with a clear setup message when required Documenso credentials are missing. In configured environments, it should use real Documenso and clean up after itself.

## Out Of Scope

- Building a generic production package/deal selector for this demo route.
- Replacing the existing admin document engine.
- Replacing the existing signature provider seam.
- Using Documenso as long-term signed document storage.
- Reworking the broader deal closing portal outside the fixed demo flow.
- Supporting mocked Documenso as the default demo runtime.

## Acceptance Criteria

- `/demo/deal-closing-pipeline` no longer uses fixture-only signing HTML.
- The route uses fixed package definition `rd7t376j110ynd5gnvtnskhzch85vnen`.
- The fixed lender identity is used for signatory resolution.
- Reset/regenerate creates real generated documents and live Documenso envelopes.
- The UI can select and display the fixed signable package attached to the fixed demo deal.
- Embedded signing uses `EmbedSignDocument` from `@documenso/embed-react`.
- Signing session issuance is backend-gated by deal access and current-user recipient matching.
- A manipulated client payload cannot request signing as another email.
- Variable interpolation and signatory assignment are validated and visible.
- Documenso webhook or sync updates appear in the audit trail.
- Tests cover payload shape, interpolation, signatory assignment, authorization, webhook state, and e2e cleanup.
