# Status: chunk-02-auth-completion

- Result: complete
- Last updated: 2026-04-20 16:59 EDT

## Completed tasks
- T-020: Added authenticated viewer home-portal lookup plus the post-auth completion route and decision helper.
- T-021: Added explicit wrong-portal rejection UI with continue CTA and FairLend admin bypass behavior.
- T-022: Kept the WorkOS callback flow on supported AuthKit APIs by routing completion through same-origin `returnPathname`.

## Validation
- Targeted auth completion tests: pass
- New Convex portal-assignment tests: pass
- `bun typecheck`: pass

## Notes
- Keep wrong-portal behavior explicit and same-host; never silently bounce users across portals.
- AuthKit callback redirects are same-origin, so this chunk owns the post-auth completion route and portal decision logic.
