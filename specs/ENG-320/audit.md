# Spec Audit: ENG-320 - Broker onboarding: hand off approved application into onboardingRequest and activate canonical broker/portal

- Audit skill: `$linear-pr-spec-audit`
- Review target: current local ENG-320 change set in `/Users/connor/.codex/worktrees/f0ee/fairlendapp`
- Last run: 2026-04-24 08:54:45 EDT
- Verdict: finding addressed

## Findings

### Resolved - P2 handoff can silently link to a terminal downstream request

- Status: `SATISFIED`
- Requirement: approved `brokerOnboardingApplication` must create or link one canonical downstream `onboardingRequest`, then reuse the existing `APPROVE -> assignRole -> ASSIGN_ROLE` provisioning seam; conflict/retry cases must fail closed instead of stranding activation.
- Evidence: `convex/onboarding/brokerApplication/internal.ts:77`, `convex/onboarding/brokerApplication/internal.ts:91`, `convex/onboarding/brokerApplication/internal.ts:303`, `convex/onboarding/brokerApplication/internal.ts:1137`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:160`.
- Resolution: downstream handoff now allows only `pending_review`, `approved`, or `role_assigned` onboarding requests to continue. `rejected` and any unknown non-provisionable status fail closed before the application/request link is patched, including through the manual downstream-link helper. The regression test seeds a compatible rejected downstream request and asserts approval rejects while the application remains unlinked.

## Coverage Summary

- `SATISFIED`: application approval calls the handoff helper for both automatic verification approval and manual approval; evidence: `convex/onboarding/brokerApplication/internal.ts:888`, `convex/onboarding/brokerApplication/internal.ts:1004`.
- `SATISFIED`: new handoffs create one downstream broker `onboardingRequest` with application, portal, referral, and invited-broker provenance; evidence: `convex/onboarding/brokerApplication/internal.ts:121`, `convex/onboarding/brokerApplication/internal.ts:130`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:116`.
- `SATISFIED`: existing downstream request linking validates role, user, application, portal compatibility, and provisionable status before marking the app as linked; evidence: `convex/onboarding/brokerApplication/internal.ts:77`, `convex/onboarding/brokerApplication/internal.ts:91`, `convex/onboarding/brokerApplication/internal.ts:303`, `convex/onboarding/brokerApplication/internal.ts:1137`.
- `SATISFIED`: normal approval uses `executeTransition(... eventType: "APPROVE")` and downstream role assignment remains in the existing effect path through `ASSIGN_ROLE`; evidence: `convex/onboarding/brokerApplication/internal.ts:226`, `convex/engine/effects/onboarding.ts:187`, `convex/engine/effects/onboarding.ts:253`, `convex/engine/effects/onboarding.ts:269`.
- `SATISFIED`: activation is gated on downstream `role_assigned` and records broker, portal, home portal, request, org, and user activation outcome; evidence: `convex/onboarding/brokerApplication/internal.ts:373`, `convex/onboarding/brokerApplication/internal.ts:399`, `convex/brokers/activation.ts:240`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:160`.
- `SATISFIED`: canonical broker resolution is strongest-identifier-first and fails closed on duplicate/cross-user/cross-org conflicts while preserving existing broker `_id`; evidence: `convex/brokers/resolveOrProvision.ts:49`, `convex/brokers/resolveOrProvision.ts:101`, `convex/brokers/resolveOrProvision.ts:173`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:304`.
- `SATISFIED`: broker portal activation uses shared slug/host helpers, reserved slug checks, registry invariants, pricing setup, and reuse semantics instead of duplicate slug logic; evidence: `convex/brokers/activation.ts:114`, `convex/brokers/activation.ts:153`, `convex/brokers/activation.ts:174`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:277`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:344`.
- `SATISFIED`: `users.homePortalId` is synchronized through the shared home portal helper and verified against the activated broker portal; evidence: `convex/brokers/activation.ts:301`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:233`.
- `SATISFIED`: referral attribution is first persisted on application creation, then propagated to downstream request and broker activation records; evidence: `convex/onboarding/brokerApplication/mutations.ts:76`, `convex/onboarding/brokerApplication/mutations.ts:137`, `convex/onboarding/brokerApplication/internal.ts:136`, `convex/brokers/resolveOrProvision.ts:138`.
- `SATISFIED`: post-auth routing uses assigned `homePortalId`, and backend activation tests verify the broker portal becomes the user's home portal; evidence: `src/test/routes/portal-auth-callback.test.tsx:39`, `src/test/routes/portal-auth-callback.test.tsx:70`, `src/test/convex/onboarding/brokerApplication.handoff.test.ts:233`.

## Validation Evidence

- `bunx convex codegen`: pass on 2026-04-24 after the finding fix.
- `bun check`: pass on 2026-04-24 after the finding fix, with existing complexity warnings outside the ENG-320 diff.
- `bun typecheck`: pass on 2026-04-24 after the finding fix.
- Focused backend test: `bun run test src/test/convex/onboarding/brokerApplication.handoff.test.ts` pass on 2026-04-24, 7/7 tests including the rejected-downstream regression.
- Focused backend tests from the ENG-320 implementation run also passed, 41 tests across `brokerApplication.handoff`, `brokerApplication.aggregate`, `verification-contracts`, and `onboarding-effect`.
- Full `bun run test`: attempted during ENG-320 implementation; 21 unrelated failures remain outside the ENG-320 changed files, including listing fixture schema drift around `marketplacePropertyType`, `convex/portals/proof.ts` architecture guard, transfer reconciliation auth setup, and lender listing UI tests missing a Convex provider.

## Open Questions

- None blocking.

## Recommended Next Action

- No further ENG-320 audit action.
