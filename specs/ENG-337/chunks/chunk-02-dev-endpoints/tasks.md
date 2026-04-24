# Chunk: chunk-02-dev-endpoints

- [x] T-020: Add Convex/dev helper functions for mock deal storage, scenario creation, webhook emission, mock full-deal fetch/search, and patching.
- [x] T-021: Register HTTP routes for `POST /api/dev/velocity/scenarios`, `POST /api/dev/velocity/webhook`, `GET /api/dev/mock-velocity/v1/deals`, `POST /api/dev/mock-velocity/v1/deals/search`, and `PATCH /api/dev/mock-velocity/deals/:loanCode`.
- [x] T-022: Ensure scenario delivery calls the real Velocity webhook/full-deal processing path rather than direct workspace mutation.
