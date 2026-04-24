# Spec Audit: ENG-336 - Velocity package: deliver board, workspace, and remediation UI

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against repository base
- Last run: 2026-04-24T13:40:00Z
- Verdict: needs manual validation

## Findings
- No material implementation gaps found against the ENG-336 Linear requirements and linked Notion plan.
- Residual validation gap: component-level interaction tests for board/workspace rendering, FairLend field saves, upload/link, and sync-now were attempted but blocked by a local jsdom invalid-hook-call failure that reproduced even against the existing `AdminPageMetadataProvider` before Velocity component logic ran. Registry/auth tests and `bun typecheck` cover the retained automated evidence; a browser/manual pass should verify the composed admin pages.

## Unresolved items
- Manual browser validation of the composed admin board/workspace remains recommended because component interaction tests could not be retained.

## Next action
- Use seeded Velocity package workspaces from ENG-332/ENG-335 to manually verify the board, workspace edit form, PDF upload/link, and sync-now paths in-browser.

## Coverage Summary
- SATISFIED: 11
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | routing | Admin Velocity package board and workspace routes exist | `src/routes/admin/$entitytype.tsx`, `src/routes/admin/$entitytype.$recordid.tsx` | Implemented through existing typed dynamic admin routes because new physical route files were not picked up by route generation. |
| SATISFIED | auth | Velocity admin paths are structurally guarded | `src/lib/auth.ts`, `src/routes/admin/route.tsx`, `src/test/auth/route-guards.test.ts` | `/admin/velocity` and descendants require `mortgage:originate` or staff admin override. |
| SATISFIED | navigation | Velocity packages appear in admin navigation | `src/components/admin/shell/entity-registry.ts`, `src/test/admin/velocity/registry.test.ts` | Registered as payments-domain, detail-capable, non-table entity backed by `velocityPackageWorkspaces`. |
| SATISFIED | board | Board distinguishes Velocity stage, FairLend action state, readiness, and exceptions | `src/components/admin/velocity/VelocityPackagesIndexPage.tsx` | Uses `listVelocityPackageWorkspaces` DTO and renders separate columns/lanes. |
| SATISFIED | board | Board remains passive and backend-driven | `src/components/admin/velocity/VelocityPackagesIndexPage.tsx` | React renders DTO-provided readiness and exception fields without recomputing rules. |
| SATISFIED | workspace | Workspace loads backend detail DTO | `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Uses `getVelocityPackageWorkspace` with typed workspace id. |
| SATISFIED | workspace | Velocity-owned facts are immutable and visible | `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Includes identity, borrower, property, mortgage, conditions, lender conditions, notes, source/provenance, referral/solicitor, and snapshots. |
| SATISFIED | remediation | FairLend-owned fields are editable and saved through backend mutation | `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Wires bank input, activation remediation, staff notes, valuation, and listing support fields to `updateVelocityPackageFairLendFields`. |
| SATISFIED | documents | PDF upload/link uses shared document asset path | `src/components/admin/velocity/VelocityDocumentPanel.tsx` | Uses `uploadDocumentAsset`, document asset functions, and `linkVelocityPackageDocument`. |
| SATISFIED | sync | `Sync now` calls backend sync surface | `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Uses `syncVelocityPackageNow` action with loading/error/success states. |
| SATISFIED | downstream boundary | Final review/activation are not implemented in this slice | `src/components/admin/velocity/VelocityWorkspacePage.tsx` | Renders handoff copy only; no activation action wiring. |
| UNVERIFIED | tests/manual | Component interactions are automated or manually verified | local validation notes | RTL component tests were blocked by the jsdom invalid-hook-call issue; browser validation remains manual. |
