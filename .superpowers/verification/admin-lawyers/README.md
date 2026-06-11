# Admin Lawyers Browser Verification

Attempted URL: http://admin.localhost:3000/admin/lawyers

Result:
- Dev server started at http://127.0.0.1:3000
- http://127.0.0.1:3000/admin/lawyers failed closed with `Portal not found` because that host is not an admin host
- http://admin.localhost:3000/admin/lawyers redirected to WorkOS AuthKit sign-in

Browser access to the authenticated admin shell was blocked by the live WorkOS sign-in requirement in this local session, so the roster interactions could not be manually exercised in-browser.

Automated verification completed instead:
- `bun test convex/legalRepresentation/__tests__/adminLawyers.test.ts` passed: 10 tests
- `bun test src/test/admin/admin-lawyers-page.test.tsx` passed: 10 tests
- `bun test src/test/admin/admin-shell.test.ts` passed: 26 tests
- `bun typecheck` passed
- `bunx convex codegen` passed
- `bun check` still fails on unrelated existing lint errors in `convex/payments/scheduleReplacement/drafts.ts` and `convex/payments/scheduleReplacement/readModel.ts`, plus repo-wide pre-existing complexity warnings
