# Chunk Context: chunk-02-onboarding-surfaces

## Goal
- Build the broker-facing onboarding UI states and wire them to existing server-owned query, mutation, and action contracts.

## Relevant plan excerpts
- "The flow is a chaptered hybrid wizard with progress visible throughout."
- "The post-submit surface is a rich status page, not a dead-end confirmation banner."
- "A reviewer-requested correction flow shows only reopened fields or sections plus reverification requirements."
- "The thin broker-note action appends a `broker_note` entry into the append-only review thread."

## Implementation notes
- Use local form state only for drafts before `saveDraft`; canonical status and review data must come from the read model.
- Use `useAuth` through `useAppAuth`/WorkOS client state for client branching; server auth remains Convex/WorkOS-owned.
- Use `startBrokerOnboardingIdentityVerification` for the verification step rather than hardcoding provider payloads.
- Keep components under `src/routes/onboard/-components/` because they are route-local surfaces.
- Visual treatment should be mobile-first, dense but polished, and avoid generic CRM notes or dashboard chrome.

## Existing code touchpoints
- `src/routes/demo/broker-whitelabel/onboarding.tsx` and demo components are visual inspiration only.
- `src/components/admin/shell/RecordNotesPanel.tsx` must not be reused.
- Existing ShadCN UI primitives and lucide icons are available.

## Validation
- Component tests in chunk 03 should exercise each status and action state with mocked Convex hooks.
