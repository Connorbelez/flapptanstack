# Spec Audit: ENG-366 - File Workspace: establish schema, contracts, access spine, and audit contracts

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against working tree base
- Last run: 2026-04-30T15:45:15Z
- Verdict: ready

## Findings
- No blocking findings remain.

## Resolved items
- Scope exception accepted by the human: `src/components/ui/tree-view.tsx`, `package.json`, and `bun.lock` stay in this branch for follow-on File Workspace UI work.
- `src/components/ui/tree-view.tsx` no longer uses `any`; node payloads are generic and default to `unknown`.
- Full-suite blockers are fixed and `bun run test` now passes.

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | schema | Add File Workspace tables and indexes for boxes, participants, nodes, versions, links, comments, tags, activity, and security feeds. | `convex/schema.ts`; `convex/fileWorkspace/__tests__/schema.test.ts` | Schema smoke test exercises representative rows and key indexes. |
| SATISFIED | boundary | Keep File Workspace standalone with no deal, mortgage, CRM, listing, origination, or document-engine foreign keys. | File Workspace schema block scan produced no forbidden cross-domain matches. | Existing CRM/document storage modules untouched. |
| SATISFIED | contracts | Export role, principal, status, visibility, node, scan, activity, security, and policy contracts. | `convex/fileWorkspace/types.ts`; `convex/fileWorkspace/validators.ts` | Downstream modules can import without generated table dependencies. |
| SATISFIED | access | Define viewer/editor/manager, platform-admin, public-link, and magic-link capability contracts centrally. | `convex/fileWorkspace/access.ts`; `convex/fileWorkspace/__tests__/access.test.ts` | Link principals are view-only unless download policy explicitly allows download. |
| SATISFIED | events | Define collaboration activity and security/audit event envelopes plus safe errors. | `convex/fileWorkspace/activity.ts`; `convex/fileWorkspace/securityEvents.ts` | Security-sensitive default error is fail-closed. |
| SATISFIED | fixtures | Add seed/test helpers for admin, manager, editor, viewer, non-participant, link principals, and representative boxes. | `convex/fileWorkspace/testUtils.ts`; `convex/fileWorkspace/__tests__/testUtils.test.ts` | Helpers are test-focused and create no production endpoints. |
| SATISFIED | auth architecture cleanup | Focused auth architecture tests required by the plan pass. | `src/lib/auth.ts`; `src/routes/lender.portfolio.tsx`; `convex/authz/resourceAccess.ts`; `convex/portals/proof.ts` | Small existing offenders were corrected after targeted test surfaced them. |
| ACCEPTED | scope control | Keep implementation to schema, validators, types, access, event envelopes, fixtures, and tests. | `src/components/ui/tree-view.tsx`; `package.json`; `bun.lock` | Human explicitly accepted these additions for future work in this branch. |
| SATISFIED | validation | Required gates pass. | `bun check`; `bunx convex codegen`; `bun typecheck`; `bun run test` | Full suite passed: 278 files, 3725 tests, 30 skipped, 17 todo. Vitest still reports its existing close-timeout warning after success. |

## Next action
- Ready for review/merge from the ENG-366 spec-audit perspective.
