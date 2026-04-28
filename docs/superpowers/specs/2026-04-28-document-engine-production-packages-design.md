# Document Engine Production Packages Design

## Purpose

Productionalize the document engine that currently exists in the demo route, promote it into the admin dashboard under `/admin/document-engine`, and extend it into a governed package pipeline for locked-deal document generation.

The feature should not recreate the document engine from scratch. Implementation should start by copying/promoting the existing demo/shared document-engine surface, then refactor and adapt it to meet production requirements.

## Source Context

Relevant repo context reviewed:

- `src/routes/demo/document-engine/*` contains the current demo document-engine routes, including library, variables, templates, groups, designer, and generation.
- `src/routes/admin.document-engine*` already contains a partial admin document-engine route surface that reuses shared document-engine components.
- `src/components/document-engine/*` contains the shared authoring components for base PDFs, variables, templates, groups, designer, variable picker, and signing role configuration.
- `convex/documentEngine/*` contains current document engine functions for base PDFs, system variables, data model entities, templates, template versions, groups, timeline, and generation.
- `convex/documents/mortgageBlueprints.ts` and `convex/documents/dealPackages.ts` already implement mortgage document blueprints, deal package snapshots, variable mapping overrides, generated documents, static references, and signable document materialization.
- `docs/superpowers/specs/2026-04-27-mortgage-post-origination-document-attachments-design.md` covers the related mortgage Files-tab attachment workflow and future-only semantics.
- `src/components/admin/shell/entity-registry.ts` drives admin navigation and currently does not include Document Engine as a first-class admin nav item.

## Decisions

- Use the existing demo/shared document engine as the starting point. Promote, copy, and adapt; do not rebuild the authoring surface.
- Document Engine becomes a first-class admin workspace under `/admin/document-engine`.
- Template versions and older published template versions remain visible.
- Published locked-deal documents get a separate admin view from published template versions.
- Locked-deal document rows must link to the admin deal detail page.
- Variables use a hybrid model: canonical system variables are read-only; custom variables are allowed only when mapped to supported canonical sources.
- Package variable validation is package-wide and includes both an availability matrix and a sample locked-deal preview.
- Package definitions are versioned, and locked deals still store full immutable package snapshots.
- Document groups are not packages. Groups are Documenso signing-envelope definitions.
- Document groups need their own publish/version lifecycle so packages can pin immutable envelope definitions.
- A package contains N groups and N standalone documents.
- A selected group materializes into one Documenso envelope.
- A standalone signable document materializes into its own Documenso envelope.
- Standalone non-signable templated documents generate PDFs without envelopes.
- Static documents materialize as static references.
- Mortgage package application is future-only. It must not mutate existing locked deal packages.

## Architecture

The production document engine has four authoring concepts:

- `Variables`: canonical read-only lock-time variables plus custom aliases mapped to canonical variables.
- `Templates`: versioned PDF layouts with interpolable and signable fields.
- `Groups`: reusable Documenso envelope definitions. A group contains multiple templates that should be signed together in one envelope.
- `Packages`: versioned standard deal bundles. A package contains groups plus standalone documents and static assets.

Operationally:

1. Admin authors templates and signing envelope groups in Document Engine.
2. Admin creates a package by selecting published groups and standalone documents/assets.
3. Package publish validates pinned versions, envelope boundaries, signatory compatibility, and package-wide variables.
4. Mortgage detail applies a published package version future-only.
5. When a lender locks a listing, the newly inserted deal row plus linked mortgage graph produces the runtime variable and signatory context.
6. Deal package materialization stores an immutable package snapshot and produces generated/static document instances.

## Data Model

Add package standards above the current document-engine and mortgage blueprint objects.

### `documentGroupVersions`

Immutable published group snapshots.

The existing `documentTemplateGroups` draft table remains the editable group authoring surface. A published group version captures:

- group id
- version number
- group metadata
- ordered template refs
- pinned template versions
- signatory configuration
- required variable keys
- required platform roles
- published by/at audit fields

Packages select published group versions, not mutable group drafts.

### `documentPackageDefinitions`

Editable draft package records under `/admin/document-engine/packages`.

Fields:

- name
- description
- draft contents
- draft variable validation summary
- current published version
- has draft changes
- created/updated audit fields

Draft contents should support:

- group references
- standalone template references
- static asset references
- display order
- package item labels/categories
- package-scoped mapping metadata

### `documentPackageVersions`

Immutable published package snapshots.

Each version should capture:

- package definition id
- version number
- package metadata
- selected group versions
- selected standalone template versions
- selected static assets
- package-wide required variables
- package-wide required signatories
- envelope boundaries
- validation summary
- published by/at audit fields

### `mortgagePackageApplications`

Mortgage-scoped future-only application records.

Each row should capture:

- mortgage id
- published package version id
- status
- optional mortgage-scoped metadata or overrides
- created by/at
- archived/superseded by/at

This keeps package standards reusable while preserving mortgage-specific application state.

### Existing Tables

`documentTemplateGroups` remain editable envelope definitions and should not be repurposed as packages.

`dealDocumentPackages` should be extended to include the lock-time package version metadata and full package snapshot.

`dealDocumentInstances` should include enough package item snapshot metadata to identify whether the row came from a group item, standalone signable template, standalone non-signable template, or static asset. Rows should support navigation back to the deal detail page.

## Variable Model

Variables are a production contract for data available at deal lock.

Canonical variables are read-only and generated from a typed registry rather than manually curated demo rows. They appear in:

- `/admin/document-engine/variables`
- the document editor variable picker
- package variable availability matrix
- package publish validation

Each canonical variable includes:

- key
- label
- type
- source path
- nullability/availability
- description
- formatting metadata
- sample value

The canonical registry must cover at least:

- mortgage table fields
- linked property/listing/borrower/broker entities
- newly inserted deal row
- lender information: name, system id, email/user projection
- selected lawyer entry
- selected fractions
- computed lender investment amount, not the full mortgage principal

Custom variables are allowed only as aliases mapped to canonical sources. A custom key can provide business-friendly naming and formatting, but it must resolve back to an available canonical variable before template or package publish.

The package editor should show a variable availability matrix with:

- variable key
- label/type
- source path
- guaranteed/nullable/computed state
- sample value
- package items using it
- blocking/warning status

A sample locked-deal preview drawer should show realistic values for a representative deal context.

## Admin UX

The admin shell gets a first-class `Document Engine` navigation item.

Document Engine tabs:

- Dashboard
- Library
- Variables
- Templates
- Groups
- Packages
- Published Templates
- Published Deal Documents

`Groups` should be described as signing envelope groups so admins understand that each group materializes into one Documenso envelope.

`Packages` is the new package-standard authoring surface. It lets admins select:

- published document groups
- standalone published signable templates
- standalone published non-signable templates
- static assets

Publish feedback should apply to templates, groups, and packages:

- show a success toast
- update the visible published version badge
- add the version history row
- keep persistent state such as `Published v4 at 2:41 PM`

`Published Templates` shows immutable template versions, including older versions.

`Published Deal Documents` shows generated/static locked-deal documents with:

- document name
- package name/version
- deal id/title/reference
- mortgage id/reference
- generated/static kind
- signing/envelope status where relevant
- created/generated timestamp
- document URL
- `Open deal` link to admin deal detail

Mortgage detail gets an `Apply package` action under Files/Documents. The action applies a published package version future-only.

Deal detail gets a document package section showing:

- immutable package snapshot
- package version used
- generated/static document instances
- envelope boundaries
- row-level errors
- signing status
- document links

## Data Flow And Materialization

Implementation flow:

1. Promote/copy existing demo document-engine routes and shared components into the production admin surface.
2. Refactor shared components only where needed to support production roles, canonical variables, package authoring, and published views.
3. Add package definitions and package versions.
4. Add mortgage package applications.
5. Extend deal lock materialization to consume active mortgage package applications.
6. Store immutable lock-time snapshots and generated outputs.

Materialization rules:

- Package group item: generate the group templates into one Documenso envelope.
- Standalone signable template: generate into one dedicated Documenso envelope.
- Standalone non-signable template: generate PDF only.
- Static asset: create a static reference only.

Runtime context at deal lock must come from the deal row and linked entities, not from ad hoc manual input.

## Validation And Errors

Validation layers:

- Template publish: variable keys must exist in the canonical/custom registry, and signable fields must reference configured signatories.
- Group publish: templates must have compatible signatory sets and published versions.
- Package publish: every selected group/document must be published; every required variable must resolve; envelope boundaries must be explicit; nullable variables must be visible as warnings.
- Mortgage application: selected package version must exist and be published.
- Deal materialization: lock-time runtime context is authoritative; missing required values fail specific package rows rather than silently generating incomplete documents.

Error messages should be operational:

- `Package requires lawyer_primary_full_name, but no lawyer is selected for this deal.`
- `Standalone signable template "Funding Agreement" has no published version.`
- `Variable subscription_amount maps to deal_investment_amount, but the deal has no selected fractions.`
- `Group "Lender Envelope" cannot publish because template signatories do not match.`

## Testing

Convex tests should cover:

- canonical variable registry
- custom variable aliases and alias validation
- template publish validation and version retention
- group publish validation, group version retention, and group-as-envelope constraints
- package draft and publish
- older package version retention
- mortgage future-only package application
- deal lock snapshotting package version and package contents
- group materialization into one envelope
- standalone signable materialization into one envelope
- standalone non-signable generated PDF materialization
- static reference materialization
- row-level failure handling for missing required variables

React tests should cover:

- admin navigation includes Document Engine
- promoted document engine tabs render under admin
- all canonical variables appear on the Variables page
- variable picker includes canonical and valid custom variables
- publish success feedback appears and persists
- Published Templates includes older versions
- Published Deal Documents includes deal links
- package builder adds groups and standalone documents
- package variable matrix renders usage and blocking states
- mortgage Apply Package workflow
- deal detail package/document section

Playwright tests should cover:

- admin document engine navigation
- template publish success feedback
- package authoring and publish
- mortgage package application
- locked deal package materialization
- published locked-deal document browsing with `Open deal`

Quality gates:

- `bun check`
- `bun typecheck`
- `bunx convex codegen`

## Non-Goals

- No rebuild of the document editor from scratch.
- No replacement of document groups with packages.
- No mutation of existing locked deal packages when a package standard changes.
- No manual lock-time variable entry for production package materialization.
- No CodeRabbit/human review handling as part of the agent quality gate.
