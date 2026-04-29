# Spec Audit: ENG-319 - Broker onboarding: implement verification pipeline and abuse controls

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against the ENG-319 Linear issue and linked Notion specs
- Last run: 2026-04-23 21:15 EDT
- Verdict: ready

## Findings
- none unresolved

## Resolved During Audit
- Stale regulator evidence initially produced a separate `stale_regulator_data` recommendation. The Linear and Notion acceptance criteria require stale evidence to route to reviewer attention, so it now returns `review_needed` with the `stale_regulator_data` reason code and has updated test coverage.
- Invalid callback signatures initially persisted body-derived application/session linkage and could prevent a later valid retry for the same provider event from processing. Invalid callbacks now fail closed without trusted linkage, valid retries can re-open invalid-signature failed events for processing, and loose callback application IDs are normalized before lookup.

## Requirement Coverage
- `SATISFIED`: verified-email gate before IDV start and callback trust, sourced from WorkOS-backed authenticated state persisted onto the application.
- `SATISFIED`: regulator lookups run through the provider registry/imported FSRA provider bindings instead of scattered direct table reads.
- `SATISFIED`: IDV callbacks are signature-verified, persisted in a broker-onboarding-specific callback table, normalized through provider contracts, and processed idempotently.
- `SATISFIED`: three-way Jaro-Winkler scoring uses normalized self-reported, regulator, and IDV names with the minimum pairwise score as the effective score.
- `SATISFIED`: recommendation mapping covers auto-approval, review-needed, stale/incomplete evidence, low-score rejection, inactive/not-found regulator rejection, IDV rejection, and fraud hard-fail behavior.
- `SATISFIED`: verification snapshots persist recommendation, reason codes, evidence references, provider state, score metadata, and reverification-invalidated state on `brokerOnboardingApplication`.
- `SATISFIED`: status changes remain aggregate-owned; callback handlers persist evidence and invoke aggregate/internal recommendation application instead of directly patching top-level status.
- `SATISFIED`: abuse controls use the existing Convex rate-limiter component in production paths with a deterministic test fallback for `convex-test`.
- `SATISFIED`: deterministic mock provider flows are executable locally and covered by focused tests.

## Validation Evidence
- `bunx convex codegen`: passed on 2026-04-23 21:14 EDT.
- `bun check`: passed on 2026-04-23 21:14 EDT with existing repo-wide cognitive-complexity warnings outside ENG-319.
- `bun typecheck`: passed on 2026-04-23 21:14 EDT.
- Focused onboarding suite passed on 2026-04-23 21:14 EDT: 7 test files, 34 tests.
- Full `bun run test -- --reporter=dot --silent` was rerun on 2026-04-23 21:15 EDT and still fails in unrelated non-onboarding areas: 9 failed files / 22 failed tests, with 3,590 tests passing and no ENG-319-specific failures.

## Unresolved items
- none for ENG-319

## Next action
- Ready for human review. Full-suite unrelated failures should be handled outside this ENG-319 implementation.
