# Chunk: chunk-02-route-wiring

- [x] T-020: Add a public `/start-lending` route outside auth-gated trees that resolves active root portal context, records the handoff, and redirects through host-aware sign-up with `/listings` as the safe return path.
- [x] T-021: Wire landing switchboard lender CTA, featured listing cards, and `View All` to canonical `/start-lending` URLs.
- [x] T-022: Preserve listing intent in the handoff URL for teaser-card clicks while keeping post-auth runtime on `/listings`.
- [x] T-023: Add or update route/component tests for the canonical handoff URLs and no demo path imports.
