# Chunk Context: chunk-04-urls-collaboration

## Goal
- Deliver preview/download URL issuance, file comments, box-scoped tags, and collaboration/security event coverage.

## Relevant plan excerpts
- "Return preview/download URLs only for `clean` or `released_by_admin` versions and only when role/link policy permits."
- "Comments are file-scoped only; folder and box comments are out of scope."
- "Tags are box-scoped labels assignable to files and folders."
- "Public/magic-link read returns permitted listing/preview/download data only and writes access/denial events."

## Implementation notes
- Revalidate bearer links at URL issuance, not only at listing.
- `fileComments`, `fileTags`, and `fileNodeTags` tables already exist.
- Use existing `insertFileWorkspaceActivity` and `insertFileWorkspaceSecurityEvent`; extend those helpers if node/link metadata is needed.

## Existing code touchpoints
- `convex/fileWorkspace/access.ts`: bearer principal resolution and link capability sets.
- `convex/fileWorkspace/shareLinks.ts`: `resolveBearerLink` pattern.
- `convex/fileWorkspace/activity.ts` and `securityEvents.ts`: event envelope helpers.
- New expected modules: `convex/fileWorkspace/comments.ts`, `convex/fileWorkspace/tags.ts`; URL queries may live in `versions.ts` or `readModels.ts`.
- GitNexus impact pending after index completes.

## Validation
- Convex tests for clean/released URL issuance, pending/rejected/deleted denial, expired link denial, download-disabled denial, comment/tag operations, and event writes.
