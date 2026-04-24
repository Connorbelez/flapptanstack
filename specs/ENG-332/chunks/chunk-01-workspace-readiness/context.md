# Chunk Context: chunk-01-workspace-readiness

## Goal
- Deliver staff-facing Velocity package board/detail queries and FairLend-owned enrichment/remediation updates.

## Relevant plan excerpts
- "Expose package board rows that distinguish current Velocity stage, FairLend action state, readiness, and exception visibility."
- "Expose package detail payloads that clearly separate Velocity-owned immutable fields from FairLend-owned mutable enrichment and remediation data."
- "Readiness must be derived from current normalized data plus FairLend-owned inputs; do not introduce a hand-edited staff readiness field."

## Implementation notes
- Existing tables, validators, contracts, audit helper, full-deal sync, and `computeVelocityReadiness` exist under `convex/velocity`.
- Use `adminQuery`/`adminMutation` so the workspace backend is FairLend staff-only.
- Mutations may patch `fairlendEnrichment` only; do not patch `normalizedCore` except via sync code from `ENG-331`.
- Reuse `computeVelocityReadiness` and a shared workspace-state resolver.

## Existing code touchpoints
- `convex/velocity/sync.ts`: `computeVelocityReadiness`, `resolveWorkspaceState`.
- `convex/velocity/contracts.ts`: DTO contracts for workspace, enrichment, readiness, documents, and final review.
- `convex/velocity/audit.ts`: package audit append helper.
- `convex/admin/origination/cases.ts`: analogous board/detail query and patch flow.

## GitNexus findings
- `computeVelocityReadiness`: LOW risk, 1 direct caller, no affected processes.
- `resolveWorkspaceState`: LOW risk, 1 direct caller, no affected processes.

## Validation
- Targeted Velocity Convex tests.
- `bunx convex codegen`, `bun check`, `bun typecheck`.
