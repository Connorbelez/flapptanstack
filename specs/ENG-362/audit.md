# Spec Audit: ENG-362 - Legal representation: implement guest invitations and WorkOS identity resolution

- Audit skill: `$linear-pr-spec-audit`
- Review target: current branch diff against real base
- Last run: 2026-04-30T16:25:42Z
- Verdict: needs manual validation

## Findings
- No material implementation gaps found after adding resend/revoke backend coverage.

## Unresolved items
- Live WorkOS AuthKit browser callback remains manual-only. Local automation covers the Convex invitation lifecycle, resource-check compatibility, and route redirect/fail-closed helpers, but cannot complete hosted WorkOS sign-in/sign-up state in this checkout.

## Coverage Summary
- SATISFIED: 18
- PARTIAL: 0
- MISSING: 0
- CONTRADICTED: 0
- UNVERIFIED: 1

## Requirement Ledger
| Status | Bucket | Requirement | Evidence | Notes |
|---|---|---|---|---|
| SATISFIED | token security | Tokens are cryptographically random, single-use, scoped, expiring, and stored hash-only. | `convex/legalRepresentation/tokenUtils.ts`; `convex/legalRepresentation/invitations.ts`; token/invitation tests | Raw token is returned only to the creator/resend caller for delivery/dev retrieval. |
| SATISFIED | lifecycle | Create, resend, revoke, status, and accept functions are explicit fluent-convex public endpoints. | `convex/legalRepresentation/invitations.ts` | Admin functions use existing admin middleware; accept uses authed middleware. |
| SATISFIED | WorkOS/RBAC | Acceptance requires a synced WorkOS viewer with canonical lawyer role/permission semantics. | `acceptGuestInvitation`; `src/routes/lawyer/verify.$token.tsx` | No WorkOS `guest_lawyer` role was introduced. |
| SATISFIED | identity resolution | Existing lawyer profile is resolved by auth ID, normalized email, and bar/jurisdiction before creation. | `resolveOrProvisionGuestLawyerProfile`; invitation tests | Conflicting identity matches fail closed via `ConvexError`. |
| SATISFIED | access migration | Provisional email `guest_lawyer` access is revoked after auth ID access is granted idempotently. | `grantDealAccess`; `revokeProvisionalEmailAccess`; invitation tests | Existing resource-check compatibility remains unchanged until migration. |
| SATISFIED | evidence | Successful and permanent-failure paths create lawyer verification evidence before final status. | `recordInvitationVerification`; `recordInvitationFailure`; invitation tests | Verified invitations are linked to evidence IDs. |
| SATISFIED | failure behavior | Expired, revoked, already-used, tampered, restricted, and email-mismatched cases fail closed without auth ID deal access. | invitation tests; route helper tests | Permanent failures expose remediation-oriented status/copy for ENG-364. |
| SATISFIED | route | `/lawyer/verify/$token` supports invitation status lookup, AuthKit sign-in/sign-up redirect preservation, authenticated accept, and terminal states. | `src/routes/lawyer/verify.$token.tsx`; `src/routeTree.gen.ts`; route helper tests | Route is registered under the existing lawyer layout. |
| SATISFIED | generated bindings | Convex API and TanStack route bindings include the new functions and route. | `convex/_generated/api.d.ts`; `convex/test/moduleMaps.ts`; `src/routeTree.gen.ts` | Codegen was rerun successfully. |
| SATISFIED | validation | Required local validation passed. | `bunx convex codegen`; `bun check`; `bun typecheck`; targeted tests | `bun check` exits 0 with pre-existing warning-level complexity findings. |
| UNVERIFIED | manual checkpoint | New guest lawyer completes hosted WorkOS browser sign-up/callback and sees only the invited deal. | Not locally automated | Requires live WorkOS browser login and hosted redirect state. |

## Audit Notes
- Linear ENG-362 is the primary contract. Linked Notion pages align except REQ-15 says `LAWYER_VERIFIED` emission on success, while ENG-362 narrows this slice to preparing ENG-363 to emit it. The higher-priority Linear scope was followed; no stale `GUEST_LAWYER_VERIFIED` event was added.
- GitNexus MCP `detect_changes` was unavailable; CLI status was used as the available fallback and showed the index up to date.
