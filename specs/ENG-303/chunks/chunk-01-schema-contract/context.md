# Chunk Context: chunk-01-schema-contract

## Goal
- Define the minimal schema and validator contract for approved v1 landing copy without opening CMS, theming, or arbitrary block scope.

## Relevant plan excerpts
- "Add only the smallest additive content fields required for launch-time copy, trust-strip items, CTA labels, and financing-strip labels."
- "Keep pre-approval nested under the financing side instead of a third top-level peer."
- "Document which fields are structural runtime dependencies versus optional presentation copy."

## Implementation notes
- `portals` already owns structural runtime identity: slug, type, hosts, broker link, public teaser flags, default post-auth path, landingPageId, pricing policy.
- `brokers` already owns live identity/licensing: brokerageName, licenseId, licenseProvince.
- Add optional presentation fields to the existing `portalLandingPages` attachment row; keep the row thin and portal-scoped.
- Prefer a single nested object field for optional copy so future copy additions do not require many top-level schema columns, but keep the object validator explicit and v1-shaped.

## Existing code touchpoints
- `convex/schema.ts`: `portalLandingPages`, `portals`, `brokers`.
- `convex/portals/validators.ts`: public portal validators and exported types.
- GitNexus impact analysis required before editing `schema`, `portalLandingPages`, and portal validator symbols.

## Validation
- `python3 /Users/connor/.codex/skills/linear-implement-v2/scripts/validate_execution_artifacts.py ENG-303 --repo-root "/Users/connor/.codex/worktrees/48fb/fairlendapp" --stage ready-to-edit`
- targeted tests added in chunk 04.
