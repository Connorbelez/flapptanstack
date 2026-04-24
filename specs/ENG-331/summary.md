# Summary: ENG-331 - Velocity package: build webhook ingestion and full-deal sync spine

- Source issue: https://linear.app/fairlend/issue/ENG-331/velocity-package-build-webhook-ingestion-and-full-deal-sync-spine
- Primary plan: https://www.notion.so/34bfc1b4402481d2bdc3d0a2282f48b5
- Supporting docs:
  - https://www.notion.so/34bfc1b4402481e1a669db246c6a5869
  - https://www.notion.so/34bfc1b4402481038512d36fe9d3b2a2

## Scope
- Register `POST /api/velocity/webhook` in `convex/http.ts` and implement the authenticated Velocity webhook handler.
- Persist every accepted raw webhook event before business mutation, including webhook agent identity and connector credential context.
- Fetch the full Velocity deal by `loanCode` using Deals Out, with opaque `deal` href fallback when the webhook supplies it.
- Normalize the full deal into the shared Velocity core DTO, validate `linkApplicationId`, recompute readiness, open exceptions, create/update the workspace, and snapshot upstream core changes through one reusable sync path.
- Expose a manual `Sync now` backend surface that runs the same fetch, normalize, upsert, readiness, exception, and audit path as webhook processing.
- Add backend tests covering duplicate webhooks, duplicate full-deal hashes, missing/colliding identity, snapshot creation, and manual-sync convergence.

## Constraints
- Webhook payloads are notification-only. Workspace state must never be patched from webhook payload fields alone.
- Boundary validators must be permissive for upstream Velocity payloads and strict only at normalized/readiness boundaries.
- Idempotency is required for webhook-event keys and full-deal sync keys so duplicate delivery cannot duplicate workspaces, snapshots, or activation work.
- `linkApplicationId` is the canonical upstream identity. Missing or colliding identity must become explicit package exceptions.
- v1 status semantics must be preserved: only `Funded (6)` can enable activation, `Complete (7)` before FairLend activation routes to remediation, and `Parked` / `Cancelled` / `Declined` remain non-actionable without new workspace states.
- Sync-side audit entries must use the existing Velocity package audit helper and preserve webhook-agent plus connector credential provenance.
- Exported Convex queries, mutations, and actions must use fluent-convex and end in explicit `.public()` or `.internal()`.
- ENG-330 primitives are present in this worktree: `convex/velocity/{constants,contracts,validators,provenance,audit}.ts` and Velocity tables in `convex/schema.ts`.

## Open questions
- None blocking implementation. The v1 webhook authentication contract is FairLend-controlled shared secret, endpoint token, or equivalent deployment secret because Velocity docs do not define a signature scheme.
