# Chunk: chunk-06-validation-audit

- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check` before manual lint/format fixes.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted tests for checkout, Stripe webhook, listing detail, deal effects, and locking-fee behavior.
- [x] T-904: Run `bun run test`.
  - Blocked: full suite fails in unrelated existing areas recorded in `audit.md`; ENG-341 targeted tests pass.
- [x] T-905: Run `bun run test:e2e` or record why no e2e flow was introduced.
  - Not run: no mocked browser Stripe return flow was introduced; Convex webhook/session and component tests cover this change.
- [x] T-906: Run `bun run review`.
- [x] T-907: Run GitNexus detect changes before finalizing.
  - Local CLI has no `detect_changes`; used `npx gitnexus status`, `git diff --stat`, and pre-edit impact checks as fallback.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-341 against the current branch diff and persist the verdict in `audit.md`.
- [x] T-920: Resolve audit findings or record explicit blockers, then rerun artifact final validation.
