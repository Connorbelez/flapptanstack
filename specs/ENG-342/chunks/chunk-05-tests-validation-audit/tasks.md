# Chunk: chunk-05-tests-validation-audit

- [x] T-050: Add focused backend tests for attempt creation, missing signatory config, reissue lineage, and projection token scoping.
- [x] T-051: Add focused backend tests for invalid secret, duplicate/out-of-order webhooks, rejection/void, provider mismatch, and exactly-once completion transition.
- [x] T-052: Update package surface tests for envelope state and signable placeholder download behavior.
- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted envelope/webhook/package tests.
- [ ] T-904: Run `bun run test`.
  - Blocked: full suite fails 26 tests outside ENG-342.
- [ ] T-905: Run `bun run review`.
  - Blocked: CodeRabbit refuses the 952-file branch target.
- [x] T-906: Run GitNexus change detection.
- [x] T-910: Run `$linear-pr-spec-audit`.
- [x] T-920: Persist audit verdict.
- [ ] T-930: Resolve audit findings or record blockers.
  - Blocked by T-904 and T-905.
