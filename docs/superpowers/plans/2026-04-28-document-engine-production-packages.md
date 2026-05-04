# Document Engine Production Packages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the existing demo document engine into the admin workspace and extend it with canonical variables, envelope-group versions, versioned deal document package standards, mortgage package application, locked-deal materialization, and published document views.

**Architecture:** Start from the existing `src/components/document-engine/*`, `src/routes/demo/document-engine/*`, and `convex/documentEngine/*` implementation. Add versioned package contracts above templates and groups, keep groups as Documenso envelope definitions, and extend existing deal package materialization so locked deals snapshot active mortgage package applications. Avoid rebuilding the editor.

**Tech Stack:** Convex, fluent-convex, React, TanStack Router, TanStack Query + Convex, Tailwind/ShadCN, Bun, Vitest, React Testing Library, Playwright, convex-test, Biome.

---

## Scope And Phasing

This spec spans multiple subsystems. Implement it in these independently testable phases:

1. Admin promotion and published-template UX.
2. Canonical/custom variable registry.
3. Document group publish/version lifecycle.
4. Package definitions and package versions.
5. Mortgage package application.
6. Deal-lock package materialization.
7. Published deal document browsing and deal detail surfaces.
8. End-to-end verification and docs cleanup.

Each phase should pass the relevant focused tests before moving on. Run the full quality gate only after a major unit of work or before handoff.

## File Structure

### Backend contracts and schema

- Modify `convex/schema.ts`: add `documentGroupVersions`, `documentPackageDefinitions`, `documentPackageVersions`, `mortgagePackageApplications`; extend `dealDocumentPackages` / `dealDocumentInstances` snapshots with package version, package item kind, and envelope boundary metadata.
- Modify `convex/documentEngine/validators.ts`: add validators for canonical variables, custom aliases, group versions, package draft items, package versions, package snapshots, and package variable availability.
- Create `convex/documentEngine/variableRegistry.ts`: pure canonical variable registry and helper functions.
- Modify `convex/documentEngine/systemVariables.ts`: merge canonical registry with stored custom aliases; enforce alias mapping.
- Modify `convex/documentEngine/templates.ts`: validate variables against canonical/custom registry and return publish metadata.
- Modify `convex/documentEngine/templateGroups.ts`: add publish/list versions and version snapshot helpers.
- Create `convex/documentEngine/packages.ts`: package definition/version CRUD and validation.
- Modify `convex/documents/dealPackages.ts`: consume active mortgage package applications and materialize grouped and standalone package items.
- Modify `convex/documents/contracts.ts`: export shared package snapshot types and variable key constants used by mortgage/deal package materialization.

### Frontend routes and components

- Modify `src/components/admin/shell/entity-registry.ts`: add Document Engine admin navigation item.
- Modify `src/components/document-engine/DocumentEngineLayout.tsx`: add Packages, Published Templates, and Published Deal Documents nav items.
- Modify `src/components/document-engine/DocumentEngineVariablesPage.tsx`: show canonical variables as read-only and custom aliases as editable.
- Modify `src/components/document-engine/variable-picker.tsx`: display canonical and valid custom variables.
- Modify `src/components/document-engine/TemplateDesignerWorkspace.tsx`: show successful publish feedback.
- Modify `src/components/document-engine/DocumentEngineGroupsPage.tsx`: label groups as signing envelope groups and add publish/version controls.
- Create `src/components/document-engine/DocumentEnginePackagesPage.tsx`: package definition builder.
- Create `src/components/document-engine/PackageVariableMatrix.tsx`: package-wide variable matrix and sample preview trigger.
- Create `src/components/document-engine/PublishedTemplatesPage.tsx`: list immutable template versions.
- Create `src/components/document-engine/PublishedDealDocumentsPage.tsx`: list generated/static locked-deal documents and `Open deal` links.
- Create routes:
  - `src/routes/admin.document-engine.packages.tsx`
  - `src/routes/admin.document-engine.published-templates.tsx`
  - `src/routes/admin.document-engine.published-deal-documents.tsx`
- Modify existing `src/routes/admin.document-engine*.tsx` only to wire shared components and route options.
- Modify mortgage/deal detail surfaces in `src/components/admin/shell/dedicated-detail-panels.tsx`; reuse `src/components/admin/mortgages/MortgageFilesDocumentAttachButton.tsx` as the pattern for the new package application action.

### Tests

- Create/modify Convex tests under `convex/documentEngine/__tests__/` and `src/test/convex/documents/`.
- Modify `src/test/admin/admin-shell.test.tsx`.
- Add React tests under `src/test/document-engine/`.
- Add Playwright specs under `e2e/document-engine/` and `e2e/admin/`.

---

### Task 1: Promote Document Engine Into Admin Navigation

**Files:**
- Modify: `src/components/admin/shell/entity-registry.ts`
- Modify: `src/components/document-engine/DocumentEngineLayout.tsx`
- Modify: `src/routes/admin.document-engine.tsx`
- Test: `src/test/admin/admin-shell.test.tsx`

- [ ] **Step 1: Add failing admin navigation test**

Add this assertion to the existing admin shell navigation test:

```ts
expect(screen.getByRole("link", { name: /document engine/i })).toHaveAttribute(
	"href",
	"/admin/document-engine"
);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
bun test src/test/admin/admin-shell.test.tsx --runInBand
```

Expected: FAIL because no admin sidebar link named `Document Engine` exists.

- [ ] **Step 3: Add static admin nav item**

In `src/components/admin/shell/entity-registry.ts`, add this object to `STATIC_ADMIN_NAV_ITEMS` near other system/payment operational routes:

```ts
{
	kind: "route",
	label: "Document Engine",
	route: "/admin/document-engine",
	domain: "system",
	iconName: "file-text",
},
```

If `StaticAdminRoute` narrows too tightly from `STATIC_ADMIN_NAV_ITEMS`, this addition should compile without extra union changes because it is inferred from the array.

- [ ] **Step 4: Add production tabs to layout type**

In `DocumentEngineLayoutPaths`, add optional paths:

```ts
packages?: "/admin/document-engine/packages";
publishedDealDocuments?: "/admin/document-engine/published-deal-documents";
publishedTemplates?: "/admin/document-engine/published-templates";
```

Add nav items after Groups:

```ts
...(paths.packages
	? [{ icon: PackageOpen, label: "Packages", to: paths.packages }]
	: []),
...(paths.publishedTemplates
	? [{ icon: History, label: "Published Templates", to: paths.publishedTemplates }]
	: []),
...(paths.publishedDealDocuments
	? [
			{
				icon: Files,
				label: "Published Deal Documents",
				to: paths.publishedDealDocuments,
			},
		]
	: []),
```

Import `Files`, `History`, and `PackageOpen` from `lucide-react`.

- [ ] **Step 5: Wire admin document engine paths**

In `src/routes/admin.document-engine.tsx`, pass:

```ts
packages: "/admin/document-engine/packages",
publishedDealDocuments: "/admin/document-engine/published-deal-documents",
publishedTemplates: "/admin/document-engine/published-templates",
```

- [ ] **Step 6: Run focused test**

Run:

```bash
bun test src/test/admin/admin-shell.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Record the change**

```bash
gt create -am "feat: promote document engine admin navigation"
```

---

### Task 2: Add Canonical Variable Registry

**Files:**
- Create: `convex/documentEngine/variableRegistry.ts`
- Modify: `convex/documentEngine/systemVariables.ts`
- Modify: `convex/documentEngine/templates.ts`
- Modify: `src/lib/document-engine/contracts.ts`
- Test: `convex/documentEngine/__tests__/variableRegistry.test.ts`
- Test: `src/test/document-engine/variables-page.test.tsx`

- [ ] **Step 1: Write failing registry tests**

Create `convex/documentEngine/__tests__/variableRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
	CANONICAL_DOCUMENT_VARIABLES,
	getCanonicalDocumentVariable,
	isCanonicalDocumentVariableKey,
} from "../variableRegistry";

describe("canonical document variable registry", () => {
	it("includes deal-lock lender, lawyer, fraction, and investment variables", () => {
		expect(isCanonicalDocumentVariableKey("lender_primary_full_name")).toBe(true);
		expect(isCanonicalDocumentVariableKey("lender_primary_system_id")).toBe(true);
		expect(isCanonicalDocumentVariableKey("lawyer_primary_full_name")).toBe(true);
		expect(isCanonicalDocumentVariableKey("deal_selected_fraction_units")).toBe(true);
		expect(isCanonicalDocumentVariableKey("deal_investment_amount")).toBe(true);
	});

	it("marks canonical variables read-only with source paths and availability", () => {
		const variable = getCanonicalDocumentVariable("deal_investment_amount");

		expect(variable).toMatchObject({
			key: "deal_investment_amount",
			type: "currency",
			sourcePath: "deal.fractionalShare * mortgage.principal",
			availability: "computed_at_lock",
			readOnly: true,
		});
	});

	it("does not duplicate canonical keys", () => {
		const keys = CANONICAL_DOCUMENT_VARIABLES.map((variable) => variable.key);
		expect(new Set(keys).size).toBe(keys.length);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test convex/documentEngine/__tests__/variableRegistry.test.ts --runInBand
```

Expected: FAIL because `variableRegistry.ts` does not exist.

- [ ] **Step 3: Implement registry**

Create `convex/documentEngine/variableRegistry.ts`:

```ts
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { variableTypeValidator } from "./validators";

export const canonicalVariableAvailabilityValidator = v.union(
	v.literal("guaranteed"),
	v.literal("nullable_until_lock"),
	v.literal("computed_at_lock")
);

export const canonicalDocumentVariableValidator = v.object({
	availability: canonicalVariableAvailabilityValidator,
	description: v.string(),
	key: v.string(),
	label: v.string(),
	readOnly: v.literal(true),
	sampleValue: v.string(),
	sourcePath: v.string(),
	type: variableTypeValidator,
});

export type CanonicalDocumentVariable = Infer<
	typeof canonicalDocumentVariableValidator
>;

export const CANONICAL_DOCUMENT_VARIABLES = [
	{
		key: "mortgage_principal",
		label: "Mortgage Principal",
		type: "currency",
		sourcePath: "mortgage.principal",
		availability: "guaranteed",
		description: "Full principal amount on the mortgage record.",
		sampleValue: "250000",
		readOnly: true,
	},
	{
		key: "lender_primary_full_name",
		label: "Primary Lender Full Name",
		type: "string",
		sourcePath: "deal.participants.buyer.displayName",
		availability: "guaranteed",
		description: "Name of the lender who locked the listing.",
		sampleValue: "Avery Chen",
		readOnly: true,
	},
	{
		key: "lender_primary_system_id",
		label: "Primary Lender System ID",
		type: "string",
		sourcePath: "deal.participants.buyer.userId",
		availability: "guaranteed",
		description: "Internal user id for the lender who locked the listing.",
		sampleValue: "user_01KLOCKEDLENDER",
		readOnly: true,
	},
	{
		key: "lawyer_primary_full_name",
		label: "Primary Lawyer Full Name",
		type: "string",
		sourcePath: "deal.participants.lawyer.displayName",
		availability: "nullable_until_lock",
		description: "Selected lawyer for the locked deal.",
		sampleValue: "Morgan Patel",
		readOnly: true,
	},
	{
		key: "deal_selected_fraction_units",
		label: "Selected Fraction Units",
		type: "integer",
		sourcePath: "deal.fractionalShare",
		availability: "guaranteed",
		description: "The lender selected fraction units stored on the deal.",
		sampleValue: "2500",
		readOnly: true,
	},
	{
		key: "deal_investment_amount",
		label: "Deal Investment Amount",
		type: "currency",
		sourcePath: "deal.fractionalShare * mortgage.principal",
		availability: "computed_at_lock",
		description:
			"Amount this lender is investing, computed from selected fractions and mortgage principal.",
		sampleValue: "62500",
		readOnly: true,
	},
] as const satisfies readonly CanonicalDocumentVariable[];

const CANONICAL_VARIABLES_BY_KEY = new Map(
	CANONICAL_DOCUMENT_VARIABLES.map((variable) => [variable.key, variable])
);

export function isCanonicalDocumentVariableKey(
	key: string
): key is (typeof CANONICAL_DOCUMENT_VARIABLES)[number]["key"] {
	return CANONICAL_VARIABLES_BY_KEY.has(key);
}

export function getCanonicalDocumentVariable(key: string) {
	return CANONICAL_VARIABLES_BY_KEY.get(key) ?? null;
}
```

- [ ] **Step 4: Run registry test**

Run:

```bash
bun test convex/documentEngine/__tests__/variableRegistry.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Merge canonical variables into list query**

In `convex/documentEngine/systemVariables.ts`, import registry:

```ts
import { CANONICAL_DOCUMENT_VARIABLES, isCanonicalDocumentVariableKey } from "./variableRegistry";
```

Change `list` handler to return canonical variables first and custom stored variables second:

```ts
export const list = documentQuery
	.input({})
	.handler(async (ctx) => {
		const customVariables = await ctx.db.query("systemVariables").collect();
		const customOnly = customVariables.filter(
			(variable) => !isCanonicalDocumentVariableKey(variable.key)
		);

		return [
			...CANONICAL_DOCUMENT_VARIABLES.map((variable) => ({
				_id: `canonical:${variable.key}`,
				_creationTime: 0,
				createdAt: 0,
				description: variable.description,
				key: variable.key,
				label: variable.label,
				systemPath: variable.sourcePath,
				type: variable.type,
				formatOptions: undefined,
				source: "canonical" as const,
				readOnly: true as const,
				availability: variable.availability,
				sampleValue: variable.sampleValue,
			})),
			...customOnly.map((variable) => ({
				...variable,
				source: "custom" as const,
				readOnly: false as const,
				availability: "custom_alias" as const,
				sampleValue: undefined,
			})),
		];
	})
	.public();
```

- [ ] **Step 6: Block custom variables that shadow canonical keys**

In `create`, after snake-case validation, add:

```ts
if (isCanonicalDocumentVariableKey(args.key)) {
	throw new ConvexError(`Variable key "${args.key}" is reserved by the canonical registry`);
}
```

- [ ] **Step 7: Update template publish validation to accept canonical variables**

In `convex/documentEngine/templates.ts`, when checking `interpolableKeys`, treat `isCanonicalDocumentVariableKey(key)` as found before querying `systemVariables`.

Use this condition:

```ts
if (isCanonicalDocumentVariableKey(key)) {
	continue;
}
```

- [ ] **Step 8: Add frontend test for read-only canonical variables**

Create `src/test/document-engine/variables-page.test.tsx` with a mocked `api.documentEngine.systemVariables.list` result containing one canonical and one custom variable. Assert canonical rows do not show delete actions and custom rows do.

Use the repo's existing Convex React mocking pattern from nearby component tests.

- [ ] **Step 9: Run focused frontend and backend tests**

Run:

```bash
bun test convex/documentEngine/__tests__/variableRegistry.test.ts src/test/document-engine/variables-page.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 10: Record the change**

```bash
gt modify -am "feat: add canonical document variables"
```

---

### Task 3: Add Group Publish Versions

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/documentEngine/validators.ts`
- Modify: `convex/documentEngine/templateGroups.ts`
- Modify: `src/components/document-engine/DocumentEngineGroupsPage.tsx`
- Test: `convex/documentEngine/__tests__/templateGroups.test.ts`

- [ ] **Step 1: Write failing group version tests**

Create or extend `convex/documentEngine/__tests__/templateGroups.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test/moduleMaps";

describe("document template group versions", () => {
	it("publishes an immutable group version with pinned template versions", async () => {
		const t = convexTest(schema, modules);
		const identity = {
			subject: "admin-auth",
			permissions: ["admin:access", "document:review"],
			roles: ["admin"],
			role: "admin",
			org_id: "org_01KKF56VABM4NYFFSR039RTJBM",
		};
		const asAdmin = t.withIdentity(identity);

		const groupId = await seedPublishedTemplateGroup(asAdmin);
		const version = await asAdmin.mutation(api.documentEngine.templateGroups.publish, {
			groupId,
			publishedBy: "test-admin",
		});

		expect(version).toBe(1);

		const versions = await asAdmin.query(
			api.documentEngine.templateGroups.listVersions,
			{ groupId }
		);

		expect(versions).toHaveLength(1);
		expect(versions[0]).toMatchObject({
			version: 1,
			publishedBy: "test-admin",
		});
		expect(versions[0]?.snapshot.templateRefs[0]?.pinnedVersion).toBe(1);
	});
});
```

Define `seedPublishedTemplateGroup` in the same test file using existing test helpers or direct inserts for `documentBasePdfs`, `documentTemplates`, `documentTemplateVersions`, and `documentTemplateGroups`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test convex/documentEngine/__tests__/templateGroups.test.ts --runInBand
```

Expected: FAIL because `documentGroupVersions` and publish functions do not exist.

- [ ] **Step 3: Add schema table**

In `convex/schema.ts`, add:

```ts
documentGroupVersions: defineTable({
	groupId: v.id("documentTemplateGroups"),
	version: v.number(),
	snapshot: v.object({
		description: v.optional(v.string()),
		name: v.string(),
		signatories: v.array(signatoryConfigValidator),
		templateRefs: v.array(
			v.object({
				order: v.number(),
				pinnedVersion: v.number(),
				templateId: v.id("documentTemplates"),
			})
		),
		requiredPlatformRoles: v.array(v.string()),
		requiredVariableKeys: v.array(v.string()),
	}),
	publishedAt: v.number(),
	publishedBy: v.optional(v.string()),
}).index("by_group", ["groupId", "version"]),
```

- [ ] **Step 4: Add group publish function**

In `convex/documentEngine/templateGroups.ts`, add `publish`, `listVersions`, and `getVersion`.

The publish handler must:

1. Load group.
2. Require at least one template.
3. Resolve every ref to an existing published template version.
4. Use ref `pinnedVersion` when set, otherwise latest published template version.
5. Collect required variable keys from snapshots.
6. Insert `documentGroupVersions`.
7. Return the version number.

Use this helper shape:

```ts
async function resolvePublishedTemplateRef(ctx: MutationCtx, ref: GroupRef) {
	const version =
		ref.pinnedVersion === undefined
			? await ctx.db
					.query("documentTemplateVersions")
					.withIndex("by_template", (q) => q.eq("templateId", ref.templateId))
					.order("desc")
					.first()
			: await ctx.db
					.query("documentTemplateVersions")
					.withIndex("by_template", (q) =>
						q.eq("templateId", ref.templateId).eq("version", ref.pinnedVersion)
					)
					.first();
	if (!version) {
		throw new ConvexError("Every group template must have a published version");
	}
	return { ...ref, pinnedVersion: version.version, version };
}
```

- [ ] **Step 5: Add group publish UI**

In `DocumentEngineGroupsPage`, add a `Publish` button per expanded group that calls `api.documentEngine.templateGroups.publish`. On success, call:

```ts
toast.success(`Group published v${version}`);
```

Also show a versions selector/list from `listVersions` in the expanded group.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test convex/documentEngine/__tests__/templateGroups.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Record the change**

```bash
gt modify -am "feat: version document envelope groups"
```

---

### Task 4: Add Package Definitions And Package Versions

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/documentEngine/validators.ts`
- Create: `convex/documentEngine/packages.ts`
- Create: `src/components/document-engine/DocumentEnginePackagesPage.tsx`
- Create: `src/components/document-engine/PackageVariableMatrix.tsx`
- Create: `src/routes/admin.document-engine.packages.tsx`
- Test: `convex/documentEngine/__tests__/packages.test.ts`
- Test: `src/test/document-engine/packages-page.test.tsx`

- [ ] **Step 1: Write failing package publish tests**

Create `convex/documentEngine/__tests__/packages.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import schema from "../../schema";
import { modules } from "../../test/moduleMaps";

describe("document package definitions", () => {
	it("publishes a package version that pins group versions and standalone templates", async () => {
		const t = convexTest(schema, modules);
		const asAdmin = t.withIdentity({
			subject: "admin-auth",
			permissions: ["admin:access", "document:review"],
			roles: ["admin"],
			role: "admin",
			org_id: "org_01KKF56VABM4NYFFSR039RTJBM",
		});

		const { groupVersionId, signableTemplateId, staticAssetId } =
			await seedPackageInputs(asAdmin);

		const packageId = await asAdmin.mutation(api.documentEngine.packages.create, {
			name: "Standard Closing Package",
			description: "Default package for lock-time closing documents",
		});

		await asAdmin.mutation(api.documentEngine.packages.updateDraft, {
			packageId,
			items: [
				{ kind: "group", groupVersionId, order: 0 },
				{ kind: "standalone_template", templateId: signableTemplateId, order: 1 },
				{ kind: "static_asset", assetId: staticAssetId, order: 2 },
			],
		});

		const version = await asAdmin.mutation(api.documentEngine.packages.publish, {
			packageId,
			publishedBy: "test-admin",
		});

		expect(version.version).toBe(1);
		expect(version.snapshot.items).toHaveLength(3);
		expect(version.snapshot.envelopeBoundaries).toEqual([
			{ itemIndex: 0, kind: "group" },
			{ itemIndex: 1, kind: "standalone_signable" },
		]);
	});
});
```

Define `seedPackageInputs` in the test file using direct inserts or existing helpers.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test convex/documentEngine/__tests__/packages.test.ts --runInBand
```

Expected: FAIL because package schema/functions do not exist.

- [ ] **Step 3: Add package schema tables**

In `convex/schema.ts`, add `documentPackageDefinitions` and `documentPackageVersions` with validators from `convex/documentEngine/validators.ts`.

Use these table fields:

```ts
documentPackageDefinitions: defineTable({
	name: v.string(),
	description: v.optional(v.string()),
	draft: documentPackageDraftValidator,
	currentPublishedVersion: v.optional(v.number()),
	hasDraftChanges: v.boolean(),
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_name", ["name"])
	.index("by_updated_at", ["updatedAt"]),

documentPackageVersions: defineTable({
	packageId: v.id("documentPackageDefinitions"),
	version: v.number(),
	snapshot: documentPackageSnapshotValidator,
	publishedAt: v.number(),
	publishedBy: v.optional(v.string()),
}).index("by_package", ["packageId", "version"]),
```

- [ ] **Step 4: Add package validators**

In `convex/documentEngine/validators.ts`, add:

```ts
export const documentPackageDraftItemValidator = v.union(
	v.object({
		kind: v.literal("group"),
		groupVersionId: v.id("documentGroupVersions"),
		order: v.number(),
		label: v.optional(v.string()),
	}),
	v.object({
		kind: v.literal("standalone_template"),
		templateId: v.id("documentTemplates"),
		pinnedVersion: v.optional(v.number()),
		order: v.number(),
		label: v.optional(v.string()),
	}),
	v.object({
		kind: v.literal("static_asset"),
		assetId: v.id("documentAssets"),
		order: v.number(),
		label: v.optional(v.string()),
	})
);

export const documentPackageDraftValidator = v.object({
	items: v.array(documentPackageDraftItemValidator),
});

export const documentPackageEnvelopeBoundaryValidator = v.object({
	itemIndex: v.number(),
	kind: v.union(v.literal("group"), v.literal("standalone_signable")),
});

export const documentPackageSnapshotValidator = v.object({
	description: v.optional(v.string()),
	envelopeBoundaries: v.array(documentPackageEnvelopeBoundaryValidator),
	items: v.array(v.any()),
	name: v.string(),
	requiredPlatformRoles: v.array(v.string()),
	requiredVariableKeys: v.array(v.string()),
});
```

- [ ] **Step 5: Implement Convex package functions**

Create `convex/documentEngine/packages.ts` with:

- `create`
- `get`
- `list`
- `updateDraft`
- `publish`
- `listVersions`
- `getVersion`

Use `adminMutation` for mutations and `documentQuery` for queries.

In `publish`, build envelope boundaries with this rule:

```ts
function envelopeBoundaryForItem(item: ResolvedPackageItem, itemIndex: number) {
	if (item.kind === "group") {
		return { itemIndex, kind: "group" as const };
	}
	if (item.kind === "standalone_template" && item.containsSignableFields) {
		return { itemIndex, kind: "standalone_signable" as const };
	}
	return null;
}
```

- [ ] **Step 6: Add Packages route and page**

Create `src/routes/admin.document-engine.packages.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { DocumentEnginePackagesPage } from "#/components/document-engine/DocumentEnginePackagesPage";

export const Route = createFileRoute("/admin/document-engine/packages")({
	component: PackagesPage,
});

function PackagesPage() {
	return <DocumentEnginePackagesPage />;
}
```

Create `DocumentEnginePackagesPage` with:

- package list
- create package dialog
- item picker for published groups, published standalone templates, and static assets
- publish button
- version badge
- `PackageVariableMatrix`

- [ ] **Step 7: Run focused tests**

Run:

```bash
bun test convex/documentEngine/__tests__/packages.test.ts src/test/document-engine/packages-page.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 8: Record the change**

```bash
gt modify -am "feat: add versioned document packages"
```

---

### Task 5: Add Mortgage Package Application

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/documents/mortgagePackages.ts`
- Modify: `src/components/admin/mortgages/*` or `src/components/admin/shell/dedicated-detail-panels.tsx`
- Test: `src/test/convex/documents/mortgagePackages.test.ts`
- Test: `src/test/admin/mortgage-document-package-application.test.tsx`

- [ ] **Step 1: Write failing Convex test**

Create `src/test/convex/documents/mortgagePackages.test.ts`:

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { modules } from "../../../convex/test/moduleMaps";

describe("mortgage package applications", () => {
	it("applies a published package version future-only and archives prior active applications", async () => {
		const t = convexTest(schema, modules);
		const asAdmin = t.withIdentity(adminIdentity());
		const { mortgageId, firstPackageVersionId, secondPackageVersionId } =
			await seedMortgagePackageScenario(t);

		await asAdmin.mutation(api.documents.mortgagePackages.applyPackageVersion, {
			mortgageId,
			packageVersionId: firstPackageVersionId,
		});
		await asAdmin.mutation(api.documents.mortgagePackages.applyPackageVersion, {
			mortgageId,
			packageVersionId: secondPackageVersionId,
		});

		const applications = await asAdmin.query(
			api.documents.mortgagePackages.listApplications,
			{ mortgageId, includeArchived: true }
		);

		expect(applications).toHaveLength(2);
		expect(applications.filter((row) => row.status === "active")).toHaveLength(1);
		expect(applications.find((row) => row.packageVersionId === firstPackageVersionId)?.status).toBe("archived");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test src/test/convex/documents/mortgagePackages.test.ts --runInBand
```

Expected: FAIL because application schema/functions do not exist.

- [ ] **Step 3: Add schema table**

Add to `convex/schema.ts`:

```ts
mortgagePackageApplications: defineTable({
	mortgageId: v.id("mortgages"),
	packageVersionId: v.id("documentPackageVersions"),
	status: v.union(v.literal("active"), v.literal("archived")),
	createdAt: v.number(),
	createdByUserId: v.optional(v.id("users")),
	archivedAt: v.optional(v.number()),
	archivedByUserId: v.optional(v.id("users")),
})
	.index("by_mortgage_status", ["mortgageId", "status", "createdAt"])
	.index("by_package_version", ["packageVersionId", "createdAt"]),
```

- [ ] **Step 4: Implement mortgage package functions**

Create `convex/documents/mortgagePackages.ts` with:

- `listApplications`
- `getActiveApplicationInternal`
- `applyPackageVersion`
- `archiveApplication`

`applyPackageVersion` must:

1. Verify mortgage exists.
2. Verify package version exists.
3. Archive existing active applications for the mortgage.
4. Insert the new active application.
5. Return the new application id.

- [ ] **Step 5: Add mortgage UI action**

In the mortgage Files/Documents panel, add `Apply package`.

The dialog should:

- list published package versions
- show selected package contents
- state "Applies only to future deal locks"
- call `api.documents.mortgagePackages.applyPackageVersion`
- show success toast `Package applied for future deal locks`

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test src/test/convex/documents/mortgagePackages.test.ts src/test/admin/mortgage-document-package-application.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Record the change**

```bash
gt modify -am "feat: apply document packages to mortgages"
```

---

### Task 6: Materialize Package Applications At Deal Lock

**Files:**
- Modify: `convex/documents/dealPackages.ts`
- Modify: `convex/documents/contracts.ts`
- Modify: `src/lib/document-engine/contracts.ts`
- Test: `src/test/convex/documents/dealPackages.test.ts`
- Test: `convex/documents/__tests__/mortgageBlueprintMappings.test.ts`

- [ ] **Step 1: Run GitNexus impact analysis before editing**

Run:

```bash
npx gitnexus impact --repo nt1n --direction upstream buildDealVariableBag
npx gitnexus impact --repo nt1n --direction upstream prepareDealPackageRuntime
npx gitnexus impact --repo nt1n --direction upstream createDocumentPackageForDeal
```

Report direct callers, affected processes, and risk level in the implementation notes. If risk is HIGH or CRITICAL, stop and ask for approval before editing.

- [ ] **Step 2: Add failing package materialization tests**

Extend `src/test/convex/documents/dealPackages.test.ts` with:

```ts
it("materializes active mortgage package applications into grouped and standalone deal documents", async () => {
	const { asAdmin, dealId } = await seedLockedDealWithAppliedPackage();

	const result = await asAdmin.action(
		api.documents.dealPackages.retryPackageGeneration,
		{ dealId }
	);

	expect(result.status).toBe("ready");

	const surface = await asAdmin.query(api.documents.dealPackages.getPortalDocumentPackage, {
		dealId,
	});

	expect(surface.package?.status).toBe("ready");
	expect(surface.instances).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ kind: "generated", packageKey: "group:lender-envelope" }),
			expect.objectContaining({ kind: "generated", packageKey: "standalone:funding-agreement" }),
			expect.objectContaining({ kind: "static_reference", packageKey: "static:risk-disclosure" }),
		])
	);
});
```

- [ ] **Step 3: Add deal investment variables to runtime bag**

In `buildDealVariableBag`, add:

```ts
const selectedFractionUnits = snapshot.dealParticipants.fractionalShareUnits;
const investmentAmount = Math.round(
	(snapshot.mortgage.principal * selectedFractionUnits) / 10_000
);
```

Return:

```ts
deal_investment_amount: String(investmentAmount),
deal_selected_fraction_units: String(selectedFractionUnits),
lender_primary_system_id: snapshot.dealParticipants.buyer.userId ?? "",
```

- [ ] **Step 4: Resolve active package application before legacy blueprints**

In `prepareDealPackageRuntime`, query active `mortgagePackageApplications` for `snapshot.mortgage._id`. If an active application exists and no existing package snapshot exists, convert its package version snapshot into `blueprintSnapshots` / package work items.

Keep existing mortgage blueprint behavior as fallback when no package application exists.

- [ ] **Step 5: Preserve envelope boundaries in snapshots**

Extend deal package snapshot types so each item records:

```ts
packageVersionId?: Id<"documentPackageVersions">;
packageItemKind?: "group" | "standalone_template" | "static_asset";
envelopeBoundaryKey?: string;
```

For groups, use `group:${groupVersionId}`. For standalone signable templates, use `standalone:${templateId}:${templateVersion}`.

- [ ] **Step 6: Materialize grouped envelopes and standalone envelopes**

Use existing generation paths for generated documents.

For group items:

- generate each group template
- attach the same `envelopeBoundaryKey` to each generated instance
- create one Documenso envelope for that boundary when signable fields exist

For standalone signable templates:

- generate one document
- create one Documenso envelope for that document

For non-signable and static items:

- do not create an envelope boundary

- [ ] **Step 7: Run package materialization tests**

Run:

```bash
bun test src/test/convex/documents/dealPackages.test.ts --runInBand
```

Expected: PASS.

- [ ] **Step 8: Record the change**

```bash
gt modify -am "feat: materialize applied document packages"
```

---

### Task 7: Published Views And Deal Detail Links

**Files:**
- Create: `src/components/document-engine/PublishedTemplatesPage.tsx`
- Create: `src/components/document-engine/PublishedDealDocumentsPage.tsx`
- Create: `src/routes/admin.document-engine.published-templates.tsx`
- Create: `src/routes/admin.document-engine.published-deal-documents.tsx`
- Modify: `convex/documentEngine/templateVersions.ts`
- Modify: `convex/documents/dealPackages.ts`
- Test: `src/test/document-engine/published-templates-page.test.tsx`
- Test: `src/test/document-engine/published-deal-documents-page.test.tsx`

- [ ] **Step 1: Add published template list query**

In `convex/documentEngine/templateVersions.ts`, add:

```ts
export const listAll = documentQuery
	.input({})
	.handler(async (ctx) => {
		const versions = await ctx.db
			.query("documentTemplateVersions")
			.order("desc")
			.collect();
		return Promise.all(
			versions.map(async (version) => {
				const template = await ctx.db.get(version.templateId);
				return {
					...version,
					templateName: template?.name ?? "Deleted template",
				};
			})
		);
	})
	.public();
```

- [ ] **Step 2: Add published deal documents query**

In `convex/documents/dealPackages.ts`, add an admin query `listPublishedDealDocuments` that returns active `dealDocumentInstances` joined to generated document, deal, mortgage, and package row.

Return rows with:

```ts
{
	dealId,
	dealHref: `/admin/deals/${String(dealId)}`,
	displayName,
	documentUrl,
	generatedDocumentId,
	instanceId,
	mortgageId,
	packageId,
	packageStatus,
	signingStatus,
	status,
	templateVersion,
}
```

- [ ] **Step 3: Implement PublishedTemplatesPage**

Render a table with template name, version, field count, signatory count, published by, and published at.

- [ ] **Step 4: Implement PublishedDealDocumentsPage**

Render a table with document name, package status, deal, mortgage, document status, signing status, document link, and `Open deal`.

Use TanStack Router `Link`:

```tsx
<Link
	params={{ entitytype: "deals", recordid: row.dealId }}
	to="/admin/$entitytype/$recordid"
>
	<Button size="sm" variant="outline">Open deal</Button>
</Link>
```

Adjust route target if the current deal detail route expects `/admin/deals/$recordid`.

- [ ] **Step 5: Add routes**

Create both admin routes and render their pages.

- [ ] **Step 6: Run focused tests**

Run:

```bash
bun test src/test/document-engine/published-templates-page.test.tsx src/test/document-engine/published-deal-documents-page.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Record the change**

```bash
gt modify -am "feat: add published document views"
```

---

### Task 8: End-To-End Verification

**Files:**
- Modify: `e2e/document-engine/navigation.spec.ts`
- Modify: `e2e/document-engine/workflow.spec.ts`
- Create: `e2e/document-engine/packages.spec.ts`
- Create: `e2e/admin/deal-document-packages.spec.ts`
- Modify: `e2e/helpers/document-engine.ts`

- [ ] **Step 1: Add Playwright helper for package setup**

In `e2e/helpers/document-engine.ts`, add helpers:

```ts
export async function createPublishedDocumentPackage(convex: ConvexClient, args: {
	name: string;
	groupVersionId?: string;
	standaloneTemplateId?: string;
	staticAssetId?: string;
}) {
	const packageId = await convex.mutation(api.documentEngine.packages.create, {
		name: args.name,
	});
	await convex.mutation(api.documentEngine.packages.updateDraft, {
		packageId,
		items: [
			...(args.groupVersionId
				? [{ kind: "group" as const, groupVersionId: args.groupVersionId, order: 0 }]
				: []),
			...(args.standaloneTemplateId
				? [{ kind: "standalone_template" as const, templateId: args.standaloneTemplateId, order: 1 }]
				: []),
			...(args.staticAssetId
				? [{ kind: "static_asset" as const, assetId: args.staticAssetId, order: 2 }]
				: []),
		],
	});
	return convex.mutation(api.documentEngine.packages.publish, {
		packageId,
		publishedBy: "e2e",
	});
}
```

- [ ] **Step 2: Add navigation E2E assertions**

Assert `/admin/document-engine/packages`, `/admin/document-engine/published-templates`, and `/admin/document-engine/published-deal-documents` are reachable from the document engine tabs.

- [ ] **Step 3: Add package authoring E2E**

Create `e2e/document-engine/packages.spec.ts`:

- create package
- add published group
- add standalone template
- open variable matrix
- publish package
- assert `Published v1`

- [ ] **Step 4: Add locked-deal document browsing E2E**

Create `e2e/admin/deal-document-packages.spec.ts`:

- seed published package
- apply package to mortgage
- lock or seed locked deal
- trigger package materialization
- visit `/admin/document-engine/published-deal-documents`
- click `Open deal`
- assert deal detail route opens

- [ ] **Step 5: Run E2E specs**

Run:

```bash
bun run test:e2e -- e2e/document-engine/navigation.spec.ts e2e/document-engine/packages.spec.ts e2e/admin/deal-document-packages.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Run repo quality gate**

Run:

```bash
bun check
bun typecheck
bunx convex codegen
```

Expected: all pass.

- [ ] **Step 7: Run GitNexus final scope review before handoff**

Run:

```bash
npx gitnexus status
npx gitnexus query --repo nt1n "document engine admin authoring document package definitions mortgage package application deal package materialization" --limit 5
git diff --stat
git diff --name-only
```

Expected: the GitNexus index is current, the query remains centered on document engine/package flows, and the diff only includes planned document engine, package, mortgage application, deal materialization, test, and docs files.

If the implementation session has MCP access to `gitnexus_detect_changes`, run it before committing and confirm the affected symbols and execution flows are limited to document engine admin authoring, document package definitions/versions, mortgage package application, and deal document package materialization.

- [ ] **Step 8: Record final change**

```bash
gt modify -am "test: verify document package workflow"
```

---

## Final Verification Checklist

- [ ] `bun check` passes.
- [ ] `bun typecheck` passes.
- [ ] `bunx convex codegen` passes.
- [ ] Focused Convex tests pass.
- [ ] Focused React tests pass.
- [ ] Focused Playwright specs pass.
- [ ] GitNexus impact analysis was run before editing deal package symbols.
- [ ] GitNexus final scope review was run before handoff; if MCP `gitnexus_detect_changes` is available in the implementation session, it was run before committing.
- [ ] Existing demo document engine remains functional or is intentionally routed to the promoted shared implementation.
- [ ] No existing locked deal package is mutated by package publish or mortgage application.
- [ ] Published deal document rows link to deal detail.
