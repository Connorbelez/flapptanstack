# Spec Compliance Review

## Findings
- none

- Verdict: ready

## Coverage Summary
- SATISFIED: 12
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | auth | No public portfolio read accepts lender identity from the client | `convex/portfolio/queries.ts` | all portfolio reads rely on `portalLenderQuery` and only accept `portalId` plus detail ids |
| SATISFIED | capability | Command-center reads are empty-state-safe with stable section shapes | `convex/portfolio/helpers.ts`, `convex/portfolio/__tests__/queries.test.ts` | empty-state test covers zero active positions |
| SATISFIED | data model | Ownership math stays ledger-based with 10,000 units and 1,000 units per fraction | `convex/portfolio/helpers.ts` | uses `TOTAL_SUPPLY` and a fixed `POSITION_UNITS_PER_FRACTION` constant |
| SATISFIED | capability | Positions table exposes property, thumbnail, mortgage status, renewal timing, next payment, and payment amount from shared DTOs | `convex/portfolio/contracts.ts`, `convex/portfolio/helpers.ts` | no route-local recomputation required |
| SATISFIED | capability | Payment activity returns individual payment rows | `convex/portfolio/helpers.ts`, `convex/portfolio/__tests__/queries.test.ts` | obligations are mapped one row per payment and asserted in tests |
| SATISFIED | capability | Actions rail supports renewal prompts, payment exceptions, and deal actions | `convex/portfolio/contracts.ts`, `convex/portfolio/helpers.ts`, `convex/portfolio/__tests__/queries.test.ts` | sticky-rail item kinds are explicit and covered |
| SATISFIED | capability | Limits strip exposes broker-imposed constraints plus suggestion inputs | `convex/listings/lenderConstraints.ts`, `convex/portfolio/helpers.ts` | portfolio suggestions and lender portal listings share the same constraint logic |
| SATISFIED | capability | Position and payment sheet payloads exist as explicit contracts | `convex/portfolio/queries.ts`, `convex/portfolio/contracts.ts` | dedicated detail queries are implemented and tested |
| SATISFIED | capability | Suggested opportunities are ordered, server-owned, tagged, and exclude already-owned mortgages | `convex/portfolio/helpers.ts`, `convex/portfolio/__tests__/queries.test.ts` | tests assert exclusion, ordering, and explanation tags |
| SATISFIED | integration | Broker coordination context is explicit without building chat transport | `convex/portfolio/contracts.ts`, `convex/portfolio/helpers.ts` | assigned broker, CTA, prefill payloads, and optional thread id are explicit |
| SATISFIED | negative contract | The issue does not redesign payment/history export ownership beyond naming the source-of-truth seam | `convex/portfolio/helpers.ts` | ENG-310-owned historical chart and CSV export seams remain descriptive only |
| SATISFIED | validation | Required quality gates and focused regression suites ran successfully | `specs/ENG-308/chunks/chunk-03-detail-queries-and-tests/status.md` | codegen, check, typecheck, portfolio/accrual/ledger, and listing suites all passed |

## Open Questions
- `gitnexus_detect_changes` was not directly invocable in this session because the local GitNexus registry contains multiple repositories with the same `fairlendapp` name. Final scope review used a fresh `gitnexus analyze`, prior low-risk impact snapshots for the touched listing queries, and direct local diff inspection.
