# Chunk Context: chunk-03-share-links

## Goal
- Deliver public/magic share link create/list/revoke and bearer resolution behavior.

## Relevant plan excerpts
- Link tokens must be generated with enough entropy, stored hashed only, and raw tokens returned only once at creation.
- Public and magic links are view-only by default, revocable, expirable, and download-disabled unless explicit policy enables downloads.
- Link lookup accepts only raw bearer token input, hashes it server-side, and compares against `fileShareLinks.tokenHash`.
- Expired/revoked/tampered links fail closed without leaking box metadata.

## Implementation notes
- Use Web Crypto or Node crypto in Convex-compatible code; tests should inject deterministic entropy/hash inputs where needed.
- List/read operations must omit `tokenHash` and raw token.
- Link principals get list/preview only by default; downloads require both box/link policy.
- Link opens and denials should write security events when a box/link can be safely associated.

## Existing code touchpoints
- New file: `convex/fileWorkspace/shareLinks.ts`.
- Existing schema index `by_token_hash` supports bearer lookup.
- Existing `principalForLink` and link capability helpers can be extended or consumed.

## Validation
- Share link tests in `convex/fileWorkspace/__tests__`.
- Later full gates: `bunx convex codegen`, `bun check`, `bun typecheck`.
