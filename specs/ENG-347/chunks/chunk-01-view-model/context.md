# Chunk Context: chunk-01-view-model

## Goal
- Add pure frontend/domain helpers that make lawyer queue grouping, read-only policy, action eligibility, package blockers, signer summaries, and timeline display deterministic and testable.

## Relevant plan excerpts
- Queue groups: Needs Representation Confirmation, Needs Package Review, Awaiting Signers, Completed.
- Completed or ended-role views are read-only; active action buttons disappear or are disabled with explicit reasons.
- Signable placeholders must not be treated as live signing artifacts.

## Implementation notes
- Keep helpers independent from React and Convex so they are easy to unit test.
- Consume server-projected state; helpers should not become a second authorization layer.
- Prefer narrow types derived from the lawyer projection outputs rather than importing broad generated API types into every component.
- Helper outputs should include explicit disabled reasons for invalid action states.

## Existing code touchpoints
- New file: `src/components/lawyer/deals/lawyerDealViewModel.ts`.
- Tests: likely `src/test/lawyer/lawyerDealViewModel.test.ts` or matching local test convention.
- GitNexus impact: no existing symbol modified in this chunk unless a shared test utility is changed.

## Validation
- Targeted view-model tests.
- `bun check`.
- `bun typecheck`.
