# Summary: ENG-366 - File Workspace: establish schema, contracts, access spine, and audit contracts

- Source issue: https://linear.app/fairlend/issue/ENG-366/file-workspace-establish-schema-contracts-access-spine-and-audit
- Primary plan: https://www.notion.so/350fc1b440248150ab74eb3525528a25
- Supporting docs:
- https://www.notion.so/350fc1b4402480efa2f0c395b89fa1d6

## Scope
- Add a standalone File Workspace domain foundation: schema tables, validators, local TypeScript contracts, central access capability matrix, activity/security event envelopes, safe error constants, and seed/test helpers.
- Modify `convex/schema.ts` only for File Workspace table additions and indexes.
- Create `convex/fileWorkspace/validators.ts`, `types.ts`, `access.ts`, `activity.ts`, `securityEvents.ts`, and `testUtils.ts`.
- Add focused tests for validators, access capabilities, schema smoke insertion, and fixture helpers.
- Out of scope: scanner implementation, box CRUD mutations, participant/link backend operations, upload/file operations, routes, UI, public pages, archive research, and E2E journeys.

## Constraints
- File Workspace must be standalone. Do not add foreign keys from boxes, nodes, versions, tags, comments, activity, or security events to deals, mortgages, CRM, listings, origination, or document-engine rows.
- Boxes are the top-level permission and policy boundary.
- WorkOS AuthKit remains canonical. Consume `Viewer` from `convex/fluent.ts`; do not reshape it or shared auth middleware.
- `admin:access` grants platform oversight but must not create persistent box participant rows for admins.
- Link tokens are stored hashed only. Raw tokens are a downstream creation-time concern.
- Version rows are immutable except scan/release transition fields.
- Authorization must be centralized in File Workspace access helpers, not duplicated ad hoc in future handlers.
- Existing CRM attachment and document-engine upload/storage contracts are references only and must remain untouched.
- Exported Convex functions, if added later, must use fluent-convex and end in `.public()` or `.internal()`.
- No `any` unless an opaque API makes it unavoidable and the comment explains why.

## Open questions
- none
