# Marketplace Listing PDF Viewer Design

Date: 2026-04-21
Status: Approved in brainstorming, pending user review of written spec
Primary surface: `/listings/$listingId`

## Goal

Replace the mock document preview in the marketplace listing detail page with a real, production-grade document viewer that:

- keeps the existing listing detail layout intact
- pulls real public documents attached to the listing's mortgage
- renders PDFs inline in the listing detail experience
- works reliably on mobile, with phone UX optimized for a native-reader style experience
- uses only local worker assets from the codebase or installed packages
- avoids PDF.js API/worker version drift

## Non-goals

- redesigning the overall listing detail page layout
- introducing a generic multi-file viewer framework for unrelated surfaces
- adding annotation, search, rotation, or print controls in the first pass
- auto-handing PDFs off to the system/browser viewer on render failure
- changing which documents are considered public beyond the existing public blueprint contract

## Current State

The production marketplace detail route already uses the real backend listing detail query:

- [src/routes/listings.$listingId.tsx](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/routes/listings.$listingId.tsx:1)
- [src/components/listings/MarketplaceListingDetailPage.tsx](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/MarketplaceListingDetailPage.tsx:1)
- [convex/listings/marketplace.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/convex/listings/marketplace.ts:297)

The document list is already real:

- `getMarketplaceListingDetail` calls `readListingPublicDocuments`
- `readListingPublicDocuments` resolves active `public_static` mortgage blueprint assets and returns signed storage URLs
- the listing detail adapter maps that backend payload into `listing.documents`

Relevant seams:

- [convex/listings/publicDocuments.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/convex/listings/publicDocuments.ts:1)
- [convex/documents/mortgageBlueprints.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/convex/documents/mortgageBlueprints.ts:64)
- [src/components/listings/marketplace-detail-adapter.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/marketplace-detail-adapter.ts:299)
- [src/components/listings/ListingDetailPage.tsx](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/ListingDetailPage.tsx:971)

The gap is purely productization of the viewer surface. The desktop and mobile listing detail UIs still render placeholder preview states and demo copy rather than a real document viewer.

## Product Decisions

### Viewer behavior

- Phone UX is optimized for a native-reader style experience.
- Mobile PDF rendering is single-page only.
- Mobile controls are explicit and persistent: previous page, current page count, next page.
- Desktop keeps the existing split layout with document list on the left and preview pane on the right.
- The sidebar lists all public documents attached to the mortgage/listing, not only PDFs.
- PDFs render inline.
- Non-PDF documents remain in the sidebar and open in a new tab.
- PDF inline rendering is mandatory for PDFs. If rendering fails, the page stays in place and shows an inline error state with retry.
- If a signed document URL expires, the viewer should automatically refetch a fresh URL and retry before surfacing an error.

### Content boundaries

- The listing detail page remains read-only.
- Public document exposure continues to be defined by active `public_static` mortgage document blueprints.
- The shared listings UI under `src/components/listings` remains the source of truth for production marketplace detail rendering.

## Architecture

### Backend responsibilities

Keep `convex/listings/publicDocuments.ts` as the authoritative source for marketplace-visible document metadata. Extend the returned payload so the frontend does not have to infer too much from a signed URL.

Proposed payload additions per document:

- `assetId`
- `displayName`
- `description`
- `class`
- `url`
- `fileName` if available
- `contentType` if available
- derived `kind` if backend derivation is simpler than exposing raw file metadata

Add a focused query for just-in-time access refresh for a selected public document. The detail page should not need to refetch the entire listing snapshot to recover from an expired document URL.

Proposed query shape:

- input: `listingId`, `assetId`
- output: refreshed access URL and render metadata for that one public document
- authorization: same listing visibility rule as `getMarketplaceListingDetail`

### Frontend responsibilities

Keep selection state and page layout inside `ListingDetailPage`, but extract document rendering behavior into dedicated viewer components.

Proposed frontend structure under `src/components/listings`:

- `ListingDocumentSidebar.tsx`
- `ListingDocumentViewer.tsx`
- `ListingPdfViewer.tsx`
- `listing-document-utils.ts`

Hook rule:

- keep state colocated inside the extracted viewer components by default
- only introduce dedicated hooks such as `useListingDocumentAccess` or `useListingPdfState` if implementation reveals duplicated logic across desktop and mobile paths

`ListingDetailPage` remains responsible for:

- selected document ID
- desktop vs mobile composition
- passing the selected document into the viewer boundary

The viewer subsystem becomes responsible for:

- PDF vs non-PDF branching
- URL refresh and retry behavior
- container measurement
- page navigation
- loading and error states

### Data model updates

Extend [src/components/listings/listing-detail-types.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/listing-detail-types.ts:61) so a `ListingDocumentItem` can support production rendering decisions without stringly-typed UI checks.

Recommended additions:

- `assetId?: string`
- `kind: "pdf" | "other"`
- `contentType?: string | null`
- `fileName?: string | null`

The adapter in [src/components/listings/marketplace-detail-adapter.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/marketplace-detail-adapter.ts:299) should derive `kind` from backend metadata, not from client-side URL parsing where avoidable.

## UX Contract

### Desktop

- Keep the existing left-sidebar and right-preview layout.
- Selecting a PDF renders an inline preview in the existing preview pane.
- The PDF view defaults to fit-to-width.
- Render only the selected page by default.
- Show page controls in the preview pane:
  - previous page
  - page X of Y
  - next page
- Keep loading, empty, non-PDF, and error states inside the preview pane so the surrounding page does not reflow.
- For non-PDF docs, render a production external-open state in the preview pane with:
  - document name
  - document type/metadata
  - primary `Open document` action

### Mobile

- Keep the current mobile document section layout.
- Replace the placeholder preview card with a native-reader style shell.
- Render exactly one PDF page at a time.
- Always fit the page to the viewer card width.
- Keep explicit controls visible for page navigation.
- Do not use continuous vertical multi-page rendering on phones.
- For non-PDF docs, show an in-place external-open state instead of attempting inline render.
- On PDF failure, remain in place and show a retryable error state. Do not auto-open the document elsewhere.

### Viewer states

- `empty`: no public documents available
- `loading`: selected document or selected page is loading
- `pdf-ready`: inline PDF page rendered
- `pdf-error`: PDF failed after recovery attempt
- `non-pdf`: document is public but not PDF-renderable in this surface
- `stale-url-retrying`: access URL refresh in progress

The production empty-state copy must remove demo language from the current UI.

## Technical Approach

### Rendering library

Use `react-pdf` as the rendering layer and keep the UX shell custom.

Why:

- smaller implementation surface than raw PDF.js
- supports local worker setup
- lets us own mobile-native paging behavior instead of inheriting a generic viewer UI
- fits the existing shared React component model already used by the listings surface

### Worker strategy

Use a worker from installed packages, not a remote CDN.

Worker setup should live in the same module that renders the `react-pdf` `Document` and `Page` components:

```ts
import { pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url
).toString();
```

This follows the official React-PDF guidance and avoids module execution ordering issues that can reset `workerSrc` when configured elsewhere.

### Version safety

Worker/API version drift is a real production risk and must be treated as a hard constraint.

Current upstream pairing observed during design:

- `react-pdf@10.4.1`
- bundled dependency `pdfjs-dist@5.4.296`

Design rule:

- do not independently upgrade `pdfjs-dist` to a different version than the one `react-pdf` expects
- either let `react-pdf` own the transitive `pdfjs-dist` version, or pin an explicitly matching pair if the package manager layout requires it
- verify the installed pair during implementation and keep the worker path sourced from that installed package

### Rendering discipline for mobile stability

The mobile reliability plan is:

- current-page-only rendering
- fit-to-width layout
- explicit page navigation
- no pre-render of all pages
- no continuous phone scroll mode
- avoid unnecessary rerender churn when switching documents rapidly

This is the primary mitigation for mobile Safari and lower-memory phone failures.

### Client-only boundary

The PDF viewer should be treated as a client-only rendering concern. The route and shared page can continue to SSR normally, but the actual PDF rendering boundary should not execute in a server context.

### URL refresh flow

1. Listing detail query returns document metadata and a current signed URL.
2. Selecting a document passes that access data into the viewer.
3. If PDF load fails due to stale access, the viewer requests a refreshed URL for the selected public document.
4. The viewer retries once automatically with the new URL.
5. Only after that retry fails should the user see the inline PDF error state.

## Rollout Plan

### 1. Harden backend document payload

Files:

- [convex/listings/publicDocuments.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/convex/listings/publicDocuments.ts:1)
- [convex/listings/marketplace.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/convex/listings/marketplace.ts:297)

Work:

- extend public document payload with render metadata
- add single-document access refresh query
- preserve current listing visibility and public blueprint rules

### 2. Extend shared listing document model

Files:

- [src/components/listings/listing-detail-types.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/listing-detail-types.ts:61)
- [src/components/listings/marketplace-detail-adapter.ts](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/marketplace-detail-adapter.ts:299)

Work:

- enrich `ListingDocumentItem`
- map backend metadata to frontend render decisions
- remove demo-oriented assumptions from empty and placeholder states

### 3. Extract viewer subsystem

Files:

- [src/components/listings/ListingDetailPage.tsx](/Users/connor/.t3/worktrees/fairlendapp/t3code-6b6975d3/src/components/listings/ListingDetailPage.tsx:971)
- new `src/components/listings/ListingDocumentViewer*` components

Work:

- split sidebar from viewer logic
- preserve existing page layout and selection state
- reuse the viewer boundary across desktop and mobile shells

### 4. Add inline PDF rendering

Work:

- add `react-pdf`
- configure local worker in the PDF rendering module
- implement container-width fit logic
- implement page navigation controls
- keep mobile strictly single-page

### 5. Add non-PDF handling

Work:

- branch before rendering into React-PDF
- show external-open state for non-PDF docs
- keep these documents visible in the sidebar

### 6. Add recovery and error states

Work:

- stale URL refresh
- one automatic retry
- explicit inline error UI for PDFs that still fail
- no automatic PDF handoff to browser/system viewer on failure

### 7. Verify

Work:

- unit tests for adapter and document-kind derivation
- component tests for desktop and mobile viewer states
- browser-level test for phone paging behavior
- repo validation:
  - `bun check`
  - `bun typecheck`
  - `bunx convex codegen`

## Acceptance Criteria

- `/listings/$listingId` uses the real public document list for the document sidebar
- document names in the sidebar come from attached public mortgage/listing documents, not mock data
- PDFs render inline in the listing detail experience
- mobile PDF UX is native-reader style: one page at a time with explicit controls
- non-PDF public documents stay visible and open in a new tab
- stale signed URLs refresh automatically and retry in place
- no remote worker is used
- worker setup is local and version-safe
- desktop and mobile layouts remain recognizable and consistent with the current page design
- demo copy is removed from the production listing detail document section

## Risks and Mitigations

### Large PDFs on mobile

Risk:

- mobile Safari or low-memory devices may struggle with large PDFs

Mitigation:

- single-page render only
- fit-to-width only by default
- no pre-render of all pages
- limit first-pass controls to essentials

### Worker/API mismatch

Risk:

- `pdfjs-dist` version drift can break rendering at runtime

Mitigation:

- keep worker sourced from installed local package
- align `react-pdf` and `pdfjs-dist` versions exactly
- verify the installed pair during implementation

### Overloading the route query

Risk:

- refetching the full listing detail payload to recover one stale document URL adds unnecessary churn

Mitigation:

- provide a narrow selected-document access refresh query

## Notes from Source Review

- React-PDF worker setup guidance and same-module warning were taken from the official React-PDF docs: https://github.com/wojtekmaj/react-pdf
- Package version pairing was checked against current package metadata during design and should be re-verified at implementation time before locking dependencies
