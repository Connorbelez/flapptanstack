# Chunk Context: chunk-02-board

## Goal
- Render a staff-facing Velocity package board from backend board row DTOs.

## Relevant plan excerpts
- "Present board rows that distinguish current Velocity stage from FairLend action state and exception status."
- "Do not invent readiness or remediation rules locally; render backend DTOs from ENG-332."

## Implementation notes
- Use `api.velocity.workspaces.listVelocityPackageWorkspaces`.
- Board row DTO includes `currentVelocityStage`, `fairlendActionState`, `readiness.blockerCount`, `readiness.blockers`, `readiness.warnings`, `exception`, borrower, property, principal, and updated timestamp.
- Search can filter by borrower, address, loan code, lender reference, and link application id.
- Exception/remediation lane should be visible at board level.

## Existing code touchpoints
- `src/components/admin/velocity/VelocityPackagesIndexPage.tsx`: create.
- `src/components/admin/origination/OriginationCasesIndexPage.tsx`: nearby table/search pattern.
- GitNexus impact is not required for new component symbols before creation; imported backend references remain consumed, not modified.

## Validation
- component tests for board row/status/exception rendering
- `bun check`
- `bun typecheck`
