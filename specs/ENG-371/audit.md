# Spec Compliance Review: ENG-371 - File Workspace E2E Fixtures

- Audit skill: `$linear-pr-spec-audit`
- Review target: local branch diff for ENG-371
- Last updated: 2026-05-02T20:35:00-04:00
- Verdict: needs manual validation

## Findings

- [High] Required validation evidence is still incomplete. The ENG-371 DoD requires all validation commands to pass, but the local checklist still has open validation items: `bun check` fails on repo-wide complexity diagnostics, `bun run test:e2e -- e2e/file-workspace` was skipped, and full `bun run test` has not passed in this branch. The E2E specs now cover the requested scenarios on paper, but skipped browser execution means the browser DoD remains unverified. Evidence: `specs/ENG-371/execution-checklist.md:19`, `specs/ENG-371/execution-checklist.md:38`, `specs/ENG-371/execution-checklist.md:42`.

## Findings addressed

- [x] The browser E2E suite no longer asserts non-admin scan release with the default WorkOS account. Platform-admin success and non-admin denial remain covered by deterministic Convex integration tests in `convex/fileWorkspace/__tests__/scanMutations.test.ts`.
- [x] Screenshot attachments in `e2e/file-workspace/workspace.spec.ts` are now awaited.

## Coverage Summary

- SATISFIED: 11
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 2
- OUT_OF_SCOPE: 1

## Requirement Ledger

| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | fixtures | Seed deterministic boxes, users, links, nested tree, suspended box, and file states | `convex/test/fileWorkspaceE2e.ts`, `e2e/helpers/file-workspace.ts` | Fixture API is gated by E2E env flags. |
| SATISFIED | authenticated E2E | Add box creation and workspace navigation specs | `e2e/file-workspace/workspace.spec.ts` | Covers UI box creation and seeded navigation. |
| SATISFIED | upload E2E | Browser-driven folder creation and upload showing pending scan quarantine | `e2e/file-workspace/workspace.spec.ts:20` | Code exists; execution skipped. |
| SATISFIED | participant E2E | Manager invite, role change, removal controls | `src/components/file-workspace/ShareSettings.tsx`, `e2e/file-workspace/security-and-retention.spec.ts:13` | Browser controls added. |
| SATISFIED | security E2E | Denied viewer/editor management attempts | `e2e/file-workspace/security-and-retention.spec.ts` | Browser coverage no longer depends on default account admin status. |
| SATISFIED | public links | View-only public/magic links and hidden authenticated surfaces | `e2e/file-workspace/public-links.spec.ts` | Covers public, magic, expired, revoked, tampered. |
| SATISFIED | versioning | Replacement creates new pending version while old clean remains visible | `e2e/file-workspace/workspace.spec.ts:117` | Uses Convex client for replacement, then verifies UI versions. |
| SATISFIED | retention | Retention-blocked permanent delete and audit evidence | `e2e/file-workspace/security-and-retention.spec.ts:82` | Uses backend operation plus UI policy evidence. |
| SATISFIED | scan release | Platform admin can release scan_error with reason and non-admin cannot | `convex/fileWorkspace/__tests__/scanMutations.test.ts` | Integration coverage satisfies the “E2E or integration test” wording. |
| SATISFIED | docs | Local fixture setup and deterministic host caveat documented | `docs/architecture/file-workspace-e2e-fixtures.md` | High-port caveat corrected. |
| SATISFIED | screenshot evidence | Attach desktop/mobile screenshots | `e2e/file-workspace/workspace.spec.ts` | Attachment promises are awaited. |
| UNVERIFIED | validation | Browser E2E suite passes | `specs/ENG-371/execution-checklist.md` | Skipped per user instruction. |
| UNVERIFIED | validation | All required repo gates pass | `specs/ENG-371/execution-checklist.md` | `bun check` and full `bun run test` remain open. |
| OUT_OF_SCOPE | Storybook | Add Storybook stories | `specs/ENG-371/execution-checklist.md` | Issue adds browser journeys/docs, not reusable UI components. |

## Verdict

`needs manual validation`. The branch contains code/spec/doc changes for all previously identified implementation gaps, but it is not `ready` until the File Workspace browser suite is executed successfully and the validation-command gap is accepted or resolved.
