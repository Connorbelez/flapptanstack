# Legal Representation Compliance Contracts

Status: foundational contracts for ENG-359.

## Boundaries

- WorkOS AuthKit remains the canonical identity source.
- WorkOS uses the canonical `lawyer` role. Do not add WorkOS roles named `platform_lawyer` or `guest_lawyer`.
- `platform_lawyer` and `guest_lawyer` are FairLend deal-scoped roles in `dealAccess`.
- `dealAccess` remains the authorization boundary for private deal visibility. Its `grantedBy` field stays a string and its existing indexes stay in place.
- LSO records are reference and licensing evidence only. They are not users, auth sessions, or access grants.

## Tables

ENG-359 adds these tables adjacent to `dealAccess`:

- `lsoLawyers`: normalized LSO reference rows with bar number, jurisdiction, licensing status, restriction status, source snapshot, and source fetch time.
- `lawyerProfiles`: FairLend-domain lawyer profile rows layered on WorkOS identity when available.
- `lawyerVerifications`: immutable verification evidence rows. New facts create new rows; only pending provider rows may receive async provider completion fields.
- `lawyerInvitations`: deal-scoped guest invitation lifecycle rows with hashed tokens.
- `representationEngagements`: per-deal representation acceptance/signing evidence.

## Helper Modules

Downstream legal work should import these modules instead of parsing raw provider or licensing data locally:

- `convex/legalRepresentation/validators.ts`: Convex validators and inferred types.
- `convex/legalRepresentation/normalization.ts`: deterministic name, email, bar number, jurisdiction, reason code, and source snapshot normalization.
- `convex/legalRepresentation/providers.ts`: `LawyerVerificationProvider`, normalized request/result contracts, and deterministic manual/test provider helpers.
- `convex/legalRepresentation/verifications.ts`: immutable write helpers, read helpers, currentness helpers, and checkpoint decisions.
- `convex/legalRepresentation/fixtures.ts`: typed fixture builders for tests and seed paths.

Verification helpers normalize indexed email, bar number, and jurisdiction fields before writing rows. Eligible verification rows must carry an `expiresAt` value; absent expiry is reserved for non-eligible evidence that should still retain its rejection or review reason codes.

Use `listExpiringLawyerVerifications` for expiry/freshness sweeps instead of querying `lawyerVerifications` indexes locally.

## Checkpoints

Use `decideLegalCheckpoint` or `verificationBlocksCheckpoint` for checkpoint decisions:

- `selection`
- `LAWYER_VERIFIED`
- `REPRESENTATION_CONFIRMED`
- `platform_activation`

These helpers distinguish `allow`, `block`, and `requires_review`, and return typed reason codes for operator-facing flows and tests.

## Selected Lawyer Snapshots

Checkout selected-lawyer snapshots still accept the legacy platform and manual guest shapes. Downstream checkout work may add optional `lso` metadata with bar number, jurisdiction, licensing status, restriction status, source details, and `lsoLawyerId`.

Do not require LSO metadata for existing platform/manual guest snapshots until the downstream LSO-backed selection work explicitly enforces it.
