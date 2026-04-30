# Status: chunk-02-backend-lifecycle

- Result: complete
- Last updated: 2026-04-30T16:11:30Z

## Completed tasks
- T-020: Added invitation create/resend/revoke/status/accept functions with explicit fluent visibility.
- T-021: Added synced WorkOS user and lawyer-role acceptance boundary with deterministic verification provider.
- T-022: Added guest profile resolution by auth ID, normalized email, and bar/jurisdiction.
- T-023: Added immutable verification evidence for success and failure paths.
- T-024: Added idempotent auth-ID dealAccess grant and provisional email access revocation.
- T-025: Kept existing resource checks unchanged; compatibility remains until migration, then fallback row is revoked.
- T-041: Added invitation lifecycle tests.
- T-042: Added duplicate profile/access migration tests.
- T-043: Added restricted lawyer and email mismatch failure tests.

## Validation
- `bun run test convex/legalRepresentation/__tests__/invitations.test.ts convex/legalRepresentation/__tests__/tokenUtils.test.ts`: pass
- `bun run test convex/auth/__tests__/resourceChecks.test.ts`: pass
- `bunx convex codegen`: pass
- `bun check`: pass with warning-level pre-existing findings
- `bun typecheck`: pass

## Notes
- Chunk is complete.
