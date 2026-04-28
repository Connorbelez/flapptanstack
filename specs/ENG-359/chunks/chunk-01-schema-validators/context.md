# Chunk Context: chunk-01-schema-validators

## Goal
- Add legal representation schema contracts and validators while preserving existing checkout/dealAccess behavior.

## Relevant plan excerpts
- Produced contract requires `lsoLawyers`, `lawyerProfiles`, `lawyerVerifications`, `lawyerInvitations`, `representationEngagements`, and `LawyerVerificationProvider`.
- `dealAccess` must remain adjacent and unchanged: `grantedBy` stays string, and indexes by_user_and_deal, by_deal, by_user stay in place.
- Existing selectedLawyer snapshots must accept current platform/manual guest shapes and support optional LSO metadata.

## Implementation notes
- Primary edits expected in `convex/schema.ts`, `convex/checkout/validators.ts`, and new `convex/legalRepresentation/validators.ts`.
- Use Convex validators and exported TypeScript types inferred from validators where possible.
- Keep provider payload snapshots structured enough for tests and downstream contracts without provider-specific schema lock-in.

## Existing code touchpoints
- `convex/checkout/validators.ts`: `selectedLawyerSnapshotValidator`, `parseSelectedLawyerSnapshot`, platform and guest snapshot interfaces.
- `convex/schema.ts`: `checkoutSessions.selectedLawyer`, `deals.selectedLawyer`, existing `dealAccess` table.
- Local call sites from `rg`: `convex/checkout/mutations.ts`, `convex/checkout/types.ts`, `convex/checkout/dealHandoff.ts`, `convex/checkout/__tests__/validators.test.ts`, `convex/schema.ts`.
- GitNexus: `grantDealAccess` LOW, `createDealAccess` LOW, `canAccessDeal` LOW, `dealMachine` LOW. Selected-lawyer exports were not indexed targets.

## Validation
- `python3 scripts/validate_execution_artifacts.py ENG-359 --repo-root "/Users/connor/.codex/worktrees/7a77/fairlendapp" --stage ready-to-edit` before implementation.
- Targeted tests after implementation: `bun test convex/checkout/__tests__/validators.test.ts` and new legalRepresentation tests.
