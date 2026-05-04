# Spec Audit: ENG-304 - Broker landing page: add broker customization and theming after v1 launch

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff against current base (`HEAD`, detached worktree)
- Last run: 2026-04-25 12:17:03 EDT
- Verdict: ready

## Findings
- none

## Unresolved items
- none

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | contract | Extend landing-page contract with constrained customization fields on top of fixed IA | `convex/portals/validators.ts` adds `brand` and `theme`; `convex/portals/queries.ts` projects defaults and overrides | Additive to `v1LandingContent`; no parallel contract |
| SATISFIED | renderer | Keep shared renderer; customization changes tokens/copy/imagery/trust content, not layout composition | `src/components/portal/landing/PortalLandingPage.tsx` still renders the same six sections and consumes CSS variables/logo only | No renderer fork or block composition |
| SATISFIED | CTA hierarchy | Preserve lender vs borrower/mortgage-applicant top-level split and nested pre-approval | Existing `switchboard` shape unchanged; route test verifies lender, borrower, and nested pre-approval links | No third peer CTA introduced |
| SATISFIED | listings | Preserve product-like featured-listing presentation | Featured listings component/card structure unchanged; tests still verify three-card teaser and continuation | No persona-marketing module added |
| SATISFIED | management path | Prefer staff-managed configuration before broker self-serve | `convex/portals/landingMutations.ts` adds FairLend-admin-only upsert mutation | Tests verify FairLend admin succeeds and external admin is forbidden |
| SATISFIED | schema size | Keep customization smaller than CMS/block editor/freeform theming | Validators allow copy slots, logo URL/alt, and eight hex color tokens only | Docs record fixed fields and out-of-scope boundaries |
| SATISFIED | documentation | Document safe customizable fields and fixed fields | `docs/architecture/broker-landing-page-contract.md` updated | Includes href, logo URL, color token constraints |
| SATISFIED | validation | Add tests for fallback tokens, override application, safety, and preserved IA | `convex/portals/__tests__/landing.test.ts`; `src/test/routes/portal-home-route.test.tsx` | Targeted tests passed |

## Validation Evidence
- `bunx convex codegen`: passed
- `bun check`: passed with unrelated warning-level diagnostics
- `bun typecheck`: passed
- `bun run test src/test/routes/portal-home-route.test.tsx convex/portals/__tests__/landing.test.ts`: passed, 18 tests

## Next action
- none
