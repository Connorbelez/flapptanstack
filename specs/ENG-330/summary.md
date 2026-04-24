# Summary: ENG-330 - Velocity package: establish schema, contract, and audit primitives

- Source issue: https://linear.app/fairlend/issue/ENG-330/velocity-package-establish-schema-contract-and-audit-primitives
- Primary plan: https://www.notion.so/34bfc1b4402481909056d465def303b0
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2

## Scope
- Create the canonical `convex/velocity/*` boundary for Velocity package constants, shared TypeScript DTOs, Convex validators, provenance helpers, idempotency helpers, and package audit helpers.
- Add dedicated Convex tables and indexes for Velocity package workspaces, snapshots, webhook events, sync attempts, activation attempts, exceptions, and package document links.
- Model v1 Velocity status semantics, readiness blockers, exception states, activation-remediation ownership, and `VelocityActivationHandoffV1`.
- Preserve package document references through existing `documentAssets` IDs and preserve audit/provenance through the existing append-only audit journal.
- Add focused tests for enums, helper builders, status semantics, exported namespace stability, and validator/schema assumptions.

## Constraints
- Velocity boundary validators are permissive for raw upstream payloads but strict for normalized/readiness contracts.
- `linkApplicationId` is the canonical upstream identity; `loanCode` is a staff locator; duplicate non-empty `linkApplicationId` workspaces are forbidden by contract.
- Only Velocity `Funded (6)` enables v1 activation; `Complete (7)` before FairLend activation routes to remediation; `Parked`, `Cancelled`, and `Declined` remain raw statuses and non-actionable without new workspace states.
- `loanType` and `lienPosition` are package-owned activation-remediation inputs because Velocity cannot supply or map them safely in v1.
- PAD evidence must point to an existing PDF `documentAssets` row; no parallel file table is allowed.
- `appendAuditJournalEntry` has critical shared blast radius and should not be reshaped; Velocity audit support must wrap it with package-specific contracts.
- Shared Convex endpoint exports, if added later, must use fluent-convex builders and explicit visibility; this issue only creates shared modules and validators, not public pseudo-endpoints.

## Open questions
- None blocking implementation.
