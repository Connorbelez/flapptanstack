# Summary: ENG-336 - Velocity package: deliver board, workspace, and remediation UI

- Source issue: https://linear.app/fairlend/issue/ENG-336/velocity-package-deliver-board-workspace-and-remediation-ui
- Primary plan: https://www.notion.so/34bfc1b4402481699745c1582a13a17b
- Supporting docs:
- https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2
- https://www.notion.so/34bfc1b4402481e1a669db246c6a5869

## Scope
- Add staff-facing admin navigation, guarded list route, and guarded detail route for Velocity package workspaces.
- Render board rows from `api.velocity.workspaces.listVelocityPackageWorkspaces` with separate Velocity stage, FairLend action state, readiness, and exception visibility.
- Render a workspace from `api.velocity.workspaces.getVelocityPackageWorkspace` with immutable Velocity-owned facts separated from editable FairLend-owned enrichment.
- Wire FairLend-owned field edits through `api.velocity.workspaces.updateVelocityPackageFairLendFields`.
- Wire PAD/supporting document upload through `uploadDocumentAsset`, `api.documents.assets.*`, and `api.velocity.documents.linkVelocityPackageDocument`.
- Wire `Sync now` through `api.velocity.sync.syncVelocityPackageNow`.
- Surface blockers, warnings, exceptions, snapshots, and downstream activation handoff without adding activation actions.

## Constraints
- Do not compute readiness/remediation rules in React; render backend DTO blockers, warnings, state, and exception data.
- Velocity-owned borrower/property/loan/upstream facts must be visible and immutable.
- FairLend-owned bank input, activation remediation, staff notes, valuation/listing support fields are mutable before activation.
- PAD evidence must link to an existing PDF `documentAssets` row.
- Final review and activation CTA wiring are downstream concerns owned by ENG-334.
- Admin auth must follow existing structural route guard patterns; authenticated suspense layout rules apply if suspense queries are introduced.
- Backend dependency ENG-332 is in progress but its workspace/document/sync surfaces are present locally.

## Open questions
- none
