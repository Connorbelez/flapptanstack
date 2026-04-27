# Chunk Manifest: ENG-357

## Overview
Wire the public MIC landing page, request-offering-memorandum CTA, sign-in path, and authenticated read-only investor dashboard against the backend contracts created by ENG-353, ENG-355, and ENG-356.

## Chunks

| # | Name | Tasks | Status |
|---|------|-------|--------|
| 1 | `chunk-01-landing-page` | T-001, T-002, T-003 | pending |
| 2 | `chunk-02-routes-queries` | T-010, T-011, T-012, T-013 | pending |
| 3 | `chunk-03-dashboard-core` | T-020, T-021, T-022, T-023 | pending |
| 4 | `chunk-04-dashboard-extra` | T-030, T-031, T-032, T-033 | pending |
| 5 | `chunk-05-tests-gates` | T-040, T-041, T-042, T-900–T-903 | pending |

## Dependencies
- Chunk 1 (landing page) can run independently of chunks 2–5.
- Chunk 2 (routes/queries) must complete before chunks 3–5.
- Chunk 3 (dashboard core) must complete before chunk 4.
- Chunk 5 (tests/gates) runs last and validates everything.
