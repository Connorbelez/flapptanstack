# Chunk Context: chunk-01-boxes

## Goal
- Deliver box create/list/get/update/archive backend behavior with box creation side effects.

## Relevant plan excerpts
- Box creation inserts `fileBoxes`, root `fileNodes` folder, creator `fileBoxParticipants` as `manager`, collaboration activity, and security/audit event.
- Admins and brokers can create boxes.
- `admin:access` grants platform oversight but must not silently add admins as participants.
- Disabled/suspended boxes must fail closed for normal participants and link visitors.

## Implementation notes
- Use `brokerMutation` or authed builder plus explicit admin/broker gate for box creation.
- Existing `Viewer` includes `authId`, `email`, `role`, `roles`, `permissions`, and `isFairLendAdmin`; consume it without modifying shape.
- Root folder should be a `fileNodes` row with `isRoot: true`, `nodeType: "folder"`, no parent id, and a stable normalized key.
- Activity/security events are first-class rows in `fileActivityEvents` and `fileSecurityEvents`.

## Existing code touchpoints
- New files: `convex/fileWorkspace/boxes.ts`, likely `convex/fileWorkspace/operations.ts`.
- Existing helpers: `convex/fileWorkspace/access.ts`, `activity.ts`, `securityEvents.ts`, `validators.ts`, `types.ts`.
- GitNexus blast radius for planned existing helper changes is LOW.

## Validation
- `bun run test -- convex/fileWorkspace`
- Later full gates: `bunx convex codegen`, `bun check`, `bun typecheck`.
