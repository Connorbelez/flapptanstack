# Chunk: chunk-01-route-contracts

- [x] T-001: Finalize implementation task list and chunk plan from Linear, Notion, repo reads, and GitNexus impact analysis.
- [x] T-002: Validate execution artifacts at the `ready-to-edit` stage before implementation edits.
- [x] T-010: Replace `src/routes/onboard/route.tsx` hard auth gate with a public route shell.
- [x] T-011: Create `src/routes/onboard/index.tsx` route entry that branches between public intro, authenticated start/resume, wizard, status, corrections, approved, and activated states.
- [x] T-012: Add route-local referral helpers that sanitize and preserve referral context through auth redirect and `startOrResume`.
- [x] T-013: Add server-backed portal slug preview or availability query in `convex/portals/queries.ts` using shared portal contracts and registry lookups.
- [x] T-014: Add route-local view-model helpers for chapter progress, status mapping, correction metadata, submitted details, and portal teaser state.
