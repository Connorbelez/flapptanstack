# Chunk: chunk-01-contracts-and-routes

- [x] T-001: Finalize implementation task list and chunk plan.
- [x] T-002: Run GitNexus index/status and impact checks for existing symbols expected to change, recording any blind spots.
- [x] T-003: Validate execution artifacts at the `ready-to-edit` stage.
- [x] T-010: Add production public financing continuation routes outside `/borrower`: `/financing/start` and `/financing/pre-approval`.
- [x] T-011: Define and parse the minimal prefill/resume contract for `fullName`, `email`, and `amountNeeded` on the continuation routes.
- [x] T-012: Preserve resolved portal context on the continuation screens and fail closed when the root portal boundary marks the host unavailable.
- [x] T-013: Add or reuse a thin backend continuation seam only if the route needs to create or resume provisional application state in this slice.
  Not applicable for this slice; no anonymous backend record is needed before identity.
