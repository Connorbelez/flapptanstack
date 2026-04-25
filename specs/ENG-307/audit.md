# Spec Audit: ENG-307 - Broker landing page: add borrower and mortgage-applicant portal-attribution handoff

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against implementation base
- Last run: 2026-04-25T19:45:12Z
- Verdict: needs manual validation

## Findings
- All review findings from the aggregate audit have been addressed in code.

## Unresolved items
- Full `bun run test` has unrelated pre-existing failures outside the ENG-307 route handoff scope.

## Next action
- Merge after maintainers accept the unrelated full-suite residuals or fix them on their owning branches.

## Requirement Trace
- Dedicated public financing-start routes outside `/borrower`: satisfied by `src/routes/financing.start.tsx` and `src/routes/financing.pre-approval.tsx`.
- Top-level borrower CTA, nested pre-approval CTA, and inline financing strip route into the same family: satisfied by landing contract defaults and `portal-home-route` regression coverage.
- Landing remains lightweight: satisfied; the landing page only emits links/form GET params and does not hold full application state.
- Explicit portal attribution: satisfied by root portal context, portal-only host policy, auth redirect to `/borrower/financing/*`, and the existing ENG-302 borrower `portalId` contract.
- Downstream application reuse: satisfied by not inventing a landing-page-only persistence model; no backend record is created before identity.
- Host-aware auth: satisfied by keeping financing routes public and using `/sign-up?redirect=/borrower/financing/...` only when the user continues, preserving the portal host.
- Fail-closed portal hosts: satisfied by route host policy and active portal assertions.
- No demo mortgage app/Zustand: satisfied; no demo mortgage application imports are present in the production handoff.
- Real borrower/mortgage-applicant continuation: satisfied by authenticated `/borrower/financing/start` and `/borrower/financing/pre-approval` route branches.
- Production host display: satisfied by rendering the resolved canonical/requested host instead of `portal.localHost`.
- Prefill-preserving alternate links: satisfied by building public route-family toggles with `buildFinancingReturnPath`.

## Validation Evidence
- `bunx convex codegen`: passed
- `bun check`: passed with existing warnings
- `bun typecheck`: passed
- `bun run test src/test/routes/borrower-financing-application.test.tsx src/test/routes/portal-financing-continuation.test.tsx src/test/routes/portal-home-route.test.tsx src/test/routes/route-host-policy.test.ts`: passed, 15 tests
- `bun run test`: attempted; failed on unrelated existing suites documented in `status.md`
