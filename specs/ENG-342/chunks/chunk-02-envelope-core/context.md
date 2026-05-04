# Chunk Context: chunk-02-envelope-core

## Goal
- Implement the server-owned envelope attempt operations and pure helpers that create, update, reissue, and project attempt state.

## Relevant plan excerpts
- "Implement attempt creation from signable package members: validate package readiness, generated document/provider config, signatory mapping, recipient roster, and provider configuration before send."
- "Reissue must supersede old attempts and create a new provider document/envelope."

## Implementation notes
- New exported endpoints must use fluent-convex and explicit `.public()` / `.internal()`.
- Attempt creation starts from signable `dealDocumentInstances` and participant projection from ENG-338.
- Reminders are operational actions and must not advance the deal lifecycle.

## Existing code touchpoints
- New `convex/deals/envelopes.ts`.
- `convex/deals/participantProjection.ts`: consumes buyer/seller/lawyer mapping.
- `convex/documents/dealPackages.ts`: internal package/instance helpers may be extended.

## Validation
- Focused backend tests for pure helpers and mutation behavior.
