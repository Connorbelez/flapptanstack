# Chunk: chunk-05-validation-and-audit

- [x] T-900: Run `bunx convex codegen`.
- [x] T-901: Run `bun check`.
- [x] T-902: Run `bun typecheck`.
- [x] T-903: Run targeted Stripe webhook / checkout reconciliation / transfer tests.
- [x] T-904: Run broader `bun run test` if shared payment modules were touched broadly.
  - Not run: shared transfer/payment internals were used through existing APIs; focused Convex coverage exercises the affected path.
- [x] T-910: Run `$linear-pr-spec-audit` for ENG-344 against the branch diff.
- [x] T-920: Resolve audit findings or record blockers and rerun audit if needed.
  - Resolved: PaymentIntent failure payload handling now keeps `stripeCheckoutSessionId` optional and preserves the attached Checkout Session ID.
- [x] T-930: Run final artifact validation with audit and all tasks/checklist closed.
