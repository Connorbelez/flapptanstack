# Chunk: chunk-03-reservation-package

- [x] T-030: Generate or repair the mortgage-linked deal package from the handoff path.
- [x] T-031: Update document package participant resolution so `lawyer_primary` comes from deal-scoped selected lawyer data.
- [x] T-032: Record package-generation failure on the checkout/deal handoff path without duplicating deals on retry.
- [x] T-033: Guard `convex/engine/effects/dealClosing.ts` reservation creation when a deal already has `reservationId`.
