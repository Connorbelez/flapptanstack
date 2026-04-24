# Spec Audit: ENG-322 - Broker onboarding: ship production self-serve wizard and branded preview

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff for ENG-322
- Last run: 2026-04-24T13:34:00Z
- Verdict: ready

## Findings
- None.

## Coverage Summary
- SATISFIED: 15
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 0

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
| --- | --- | --- | --- | --- |
| SATISFIED | route | Production `/onboard` is no longer a placeholder or hard-auth-gated route. | `src/routes/onboard/route.tsx`; `src/routes/onboard/index.tsx:19` | Parent route now exposes the public shell and index route owns branching. |
| SATISFIED | frontend | Public intro exists before auth and preserves referral context into sign-up/sign-in redirects. | `src/routes/onboard/-components/OnboardingIntro.tsx`; `src/routes/onboard/-lib/referral.ts` | Route test verifies referral preservation. |
| SATISFIED | auth | Authenticated screens use WorkOS client auth and existing permission boundary rather than a second session model. | `src/routes/onboard/index.tsx:25-34`, `src/routes/onboard/index.tsx:63-77` | Convex query is skipped until authenticated and permissioned. |
| SATISFIED | persistence | Start/resume uses server-owned `brokerOnboardingApplication` state. | `src/routes/onboard/index.tsx:31-57`, `src/routes/onboard/index.tsx:79-145` | Route branches from `getCurrent` read model. |
| SATISFIED | frontend | Draft wizard saves server draft, starts IDV through action, and submits through mutation. | `src/routes/onboard/-components/OnboardingWizard.tsx` | Local form state is only an editable draft buffer; lifecycle state is server-owned. |
| SATISFIED | portal | Branded preview uses shared portal slug/host contracts and server uniqueness checks. | `convex/portals/queries.ts:200-238`, `src/routes/onboard/-components/PortalTeaserCard.tsx:38-103` | Backend registry test covers normalized, reserved, empty, and taken slugs. |
| SATISFIED | negative contract | Preview does not imply namespace claim before review/provisioning. | `src/routes/onboard/-components/PortalTeaserCard.tsx:99-102` | Copy explicitly says reservation/activation happen later. |
| SATISFIED | status | Submitted state renders submitted details, reviewer expectations, portal teaser, and note action. | `src/routes/onboard/-components/OnboardingStatusPage.tsx:42-95` | Status test covers submitted details. |
| SATISFIED | status | `changes_requested` renders reviewer note, reopened fields, reverification copy, and resubmit path. | `src/routes/onboard/-components/OnboardingCorrections.tsx:75-190` | Status test covers reopened license field and reverification copy. |
| SATISFIED | status | `approved` and `activated` are distinct UX states. | `src/routes/onboard/-components/OnboardingStatusPage.tsx:27-67` | Status test rerenders approved and activated states. |
| SATISFIED | review thread | Broker notes append to review thread and do not expose mutable CRM note behavior. | `src/routes/onboard/-components/ReviewThreadComposer.tsx:36-55`, `src/test/routes/onboard.notes.test.tsx` | Test verifies `appendBrokerNote` args and absence of edit/delete actions. |
| SATISFIED | resume | Refresh/return reloads existing application projection from server. | `src/routes/onboard/index.tsx:31-145` | Route test verifies existing draft resumes into wizard. |
| SATISFIED | tests | Route/status/note tests cover public intro, start/resume, status/corrections, portal teaser, and broker notes. | `src/test/routes/onboard.route.test.tsx`; `src/test/routes/onboard.status.test.tsx`; `src/test/routes/onboard.notes.test.tsx` | Focused test suite passes. |
| SATISFIED | tests | Portal slug query has backend registry coverage. | `convex/portals/__tests__/registry.test.ts:256-311` | Covers shared host contracts and uniqueness feedback. |
| SATISFIED | validation | Required repo gates pass. | `bunx convex codegen`; `bun check`; `bun typecheck`; focused Vitest commands | `bun check` exits 0 with pre-existing complexity warnings outside this change. |

## Unresolved items
- None.

## Manual Validation Notes
- E2E was omitted intentionally: the focused route/component tests cover production route branches and the provider edges are exercised through mocked Convex action/mutation boundaries.
- Storybook was omitted intentionally: the new UI is route-local and tied to WorkOS/Convex state rather than reusable design-system components.
