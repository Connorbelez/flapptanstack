# Chunk Context: chunk-02-dev-endpoints

## Goal
- Add dev/test endpoint surfaces that create scenarios, deliver mock webhooks, serve mock Velocity full-deal fetch/search responses, and patch stored mock deals.

## Relevant plan excerpts
- Required endpoints: `POST /api/dev/velocity/scenarios`, `POST /api/dev/velocity/webhook`, `GET /api/dev/mock-velocity/v1/deals?loancode=...`, `POST /api/dev/mock-velocity/v1/deals/search`, `PATCH /api/dev/mock-velocity/deals/:loanCode`.
- Scenario creation should store a mock Velocity deal, then fire a realistic webhook.
- FairLend should receive the webhook, fetch the mock full deal through the mock GET/search endpoint, and run the production ingestion path.

## Implementation notes
- `convex/http.ts` is the real HTTP route registry.
- Existing production webhook route is `POST /api/velocity/webhook` via `convex/velocity/webhook.ts`.
- Existing full-deal fetch path is `fetchVelocityFullDealByLoanCode` in `convex/velocity/client.ts`, which reads `VELOCITY_API_BASE_URL` and `VELOCITY_API_KEY`.
- Prefer dev/test gating through environment flags or existing test-only conventions so these endpoints cannot be mistaken for production business APIs.

## Existing code touchpoints
- Expected new files: `convex/velocity/mock.ts`, possibly `convex/test/velocityE2e.ts`.
- Existing files likely touched: `convex/http.ts`, `convex/test/moduleMaps.ts`, `convex/velocity/index.ts`.
- GitNexus impact checks are tracked in `specs/ENG-337/status.md`.

## Validation
- HTTP/Convex tests should prove scenario creation triggers the real webhook/full-deal sync path and mock fetch endpoints serve stored deals.
