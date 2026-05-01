# Demo Deal Closing Documenso Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/demo/deal-closing-pipeline` fixture signing with a fixed-deal, fixed-package, live Documenso embedded signing demo with reset/regenerate, signer-only access, webhook/sync confirmation, and audit visibility.

**Architecture:** Add a demo-scoped Convex harness that uses the existing document package, signature provider, and portal-safe signing session seams. The route reads real package/envelope/recipient state, launches `EmbedSignDocument` only after backend session issuance, and displays validation plus audit events from persisted backend state. Live Documenso is the runtime path; deterministic fetch fakes are used only for unit assertions around payload shape and cleanup.

**Tech Stack:** Convex + fluent-convex, React + TanStack Router, Documenso `@documenso/embed-react`, Vitest/convex-test, Playwright, Bun, Biome.

---

## File Structure

- Create `convex/demo/dealClosingPipeline.ts`: demo read/reset functions, fixed ids, audit event helpers, package application, cleanup orchestration, and route read model assembly.
- Modify `convex/documents/dealPackages.ts`: expose a narrow internal package-generation seam if current `runCreateDocumentPackageInternal` cannot target the fixed package version deterministically, and expose validation/payload summary data needed by the demo read model.
- Modify `convex/documents/signature/documenso.ts`: make envelope deletion cleanup results explicit and testable without throwing away which provider envelope failed.
- Modify `convex/deals/envelopeWebhooks.ts` or add a narrow companion internal mutation in `convex/demo/dealClosingPipeline.ts`: mirror live Documenso webhook state into the demo audit read model.
- Modify `src/routes/demo/deal-closing-pipeline.tsx`: switch from static fixture props to Convex query/action wiring with auth-gated rendering.
- Modify `src/components/demo/deal-closing/DealClosingPipelineDemo.tsx`: accept real read-model props, show reset/regenerate, validation artifacts, live recipients, audit events, and `EmbedSignDocument`.
- Modify `src/components/demo/deal-closing/fixtures.ts`: delete or reduce fixture-only signing HTML after the real component no longer needs it.
- Add `src/test/convex/demo/dealClosingPipeline.test.ts`: backend demo harness tests.
- Extend `src/test/convex/documents/dealPackages.test.ts`: payload/interpolation/signatory/security assertions that belong to shared package/signature behavior.
- Add or modify `src/test/demo/deal-closing-pipeline.test.tsx`: component-level tests for read model states and signing modal.
- Add `e2e/deal-closing/documenso-signing.spec.ts`: live Documenso e2e with credential guards and cleanup artifact output.

Before editing any existing function, run GitNexus impact analysis for that symbol and record the blast radius in the task notes:

```bash
npx gitnexus impact createDocumentPackageForDeal --direction upstream
npx gitnexus impact createEmbeddedSigningSession --direction upstream
npx gitnexus impact createDocumensoSignatureProvider --direction upstream
```

If GitNexus reports HIGH or CRITICAL risk, pause and report the blast radius before editing.

---

### Task 1: Shared Payload And Validation Tests

**Files:**
- Modify: `src/test/convex/documents/dealPackages.test.ts`
- Modify: `convex/documents/dealPackages.ts` only when the new tests expose missing validation artifacts or incorrect payload mapping.
- Modify: `convex/documents/signature/documenso.ts` only when the new tests expose incorrect Documenso payload mapping.

- [ ] **Step 1: Add assertions for Documenso create payload shape**

Append this test near the existing Documenso provider tests in `src/test/convex/documents/dealPackages.test.ts`. Reuse the existing `installMockDocumensoFetch` and `seedDealPackageFixture` helpers.

```ts
it("sends Documenso the expected payload shape for signable package documents", async () => {
	const { fetchMock } = installMockDocumensoFetch({
		recipientEmail: "lender.phase7@test.fairlend.ca",
		recipientName: "Lena Lender",
	});
	const t = createTestConvex({ includeWorkflowComponents: false });
	const fixture = await seedDealPackageFixture(t, {
		includeListing: true,
		signablePlatformRole: "lender_primary",
		templatedVariableKey: "borrower_primary_full_name",
	});

	await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
		dealId: fixture.dealId,
		retry: false,
	});

	const createCall = fetchMock.mock.calls.find(([input]) =>
		String(input).endsWith("/envelope/create")
	);
	expect(createCall).toBeDefined();
	const [, init] = createCall ?? [];
	expect(init?.method).toBe("POST");
	expect(init?.body).toBeInstanceOf(FormData);
	const formData = init?.body as FormData;
	const payload = JSON.parse(String(formData.get("payload")));
	expect(payload).toMatchObject({
		type: "DOCUMENT",
		title: "Borrower signature packet",
		externalId: expect.any(String),
		recipients: [
			expect.objectContaining({
				email: "lender.phase7@test.fairlend.ca",
				name: "Lena Lender",
				role: "SIGNER",
				signingOrder: 0,
			}),
		],
	});
	expect(payload.recipients[0].fields.length).toBeGreaterThan(0);
	expect(payload.recipients[0].fields[0]).toMatchObject({
		type: "SIGNATURE",
		page: expect.any(Number),
		positionX: expect.any(Number),
		positionY: expect.any(Number),
		width: expect.any(Number),
		height: expect.any(Number),
		required: true,
	});
	expect(formData.get("files")).toBeInstanceOf(Blob);
});
```

- [ ] **Step 2: Run the targeted test and verify it fails or exposes missing summary behavior**

Run:

```bash
bun test src/test/convex/documents/dealPackages.test.ts --runInBand -t "expected payload shape"
```

Expected before implementation: fail if the test cannot inspect `FormData` fields or field names do not match the actual provider payload. If it already passes, keep it as regression coverage.

- [ ] **Step 3: Add validation artifact test for interpolation and signer mapping**

Add this test in the same file. It locks the critical lender identity and interpolation behavior at the shared package layer.

```ts
it("records interpolation inputs and maps the lender signer to the canonical user", async () => {
	installMockDocumensoFetch({
		recipientEmail: "lender.phase7@test.fairlend.ca",
		recipientName: "Lena Lender",
	});
	const t = createTestConvex({ includeWorkflowComponents: false });
	const fixture = await seedDealPackageFixture(t, {
		includeFullVariableData: true,
		includeListing: true,
		signablePlatformRole: "lender_primary",
		templatedVariableKey: "borrower_primary_full_name",
	});

	await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
		dealId: fixture.dealId,
		retry: false,
	});

	const variables = await t.query(
		internal.documents.dealPackages.resolveDealDocumentVariablesInternal,
		{ dealId: fixture.dealId }
	);
	const recipients = await t.run((ctx) =>
		ctx.db.query("signatureRecipients").collect()
	);

	expect(variables).toMatchObject({
		borrower_primary_full_name: "Sam Seller",
		lender_primary_email: "lender.phase7@test.fairlend.ca",
		lender_primary_full_name: "Lena Lender",
		lender_primary_system_id: String(fixture.lenderUserId),
	});
	expect(recipients).toEqual([
		expect.objectContaining({
			email: "lender.phase7@test.fairlend.ca",
			name: "Lena Lender",
			platformRole: "lender_primary",
			userId: fixture.lenderUserId,
		}),
	]);
});
```

- [ ] **Step 4: Run the targeted interpolation test**

Run:

```bash
bun test src/test/convex/documents/dealPackages.test.ts --runInBand -t "records interpolation inputs"
```

Expected: PASS, or FAIL with a concrete mismatch in variable/signatory mapping to fix before demo work.

- [ ] **Step 5: Implement only the minimal shared fixes needed**

If Step 1 failed because `toDocumensoField` or `buildCreateEnvelopePayload` uses the wrong shape for the current Documenso API, update `convex/documents/signature/documenso.ts` around the payload helpers to preserve the nested recipient fields used by the existing provider:

```ts
function toDocumensoField(field: SignatureProviderField) {
	return {
		identifier: field.identifier ?? 0,
		type: field.type,
		page: field.pageNumber,
		positionX: field.positionX,
		positionY: field.positionY,
		width: field.width,
		height: field.height,
		required: field.required,
		...(field.fieldMeta ? { fieldMeta: field.fieldMeta } : {}),
	};
}

function buildCreateEnvelopePayload(
	input: SignatureProviderCreateEnvelopeInput
) {
	return {
		type: "DOCUMENT",
		title: input.title,
		externalId: String(input.generatedDocumentId),
		recipients: input.recipients.map(toCreateRecipientPayload),
	};
}
```

- [ ] **Step 6: Re-run shared package/signature tests**

Run:

```bash
bun test src/test/convex/documents/dealPackages.test.ts --runInBand -t "Documenso|interpolation|embedded signing"
```

Expected: all selected tests pass.

- [ ] **Step 7: Record the change**

If this is the first tracked change on the branch:

```bash
gt create -am "test: lock Documenso signing payload contract"
```

If the branch is already tracked:

```bash
gt modify -am "test: lock Documenso signing payload contract"
```

---

### Task 2: Demo Harness Backend

**Files:**
- Create: `convex/demo/dealClosingPipeline.ts`
- Test: `src/test/convex/demo/dealClosingPipeline.test.ts`
- Modify: `convex/documents/dealPackages.ts` only if `runCreateDocumentPackageInternal` cannot consume the active `mortgagePackageApplications` package version deterministically.

- [ ] **Step 1: Write failing backend tests for fixed package lookup and reset result**

Create `src/test/convex/demo/dealClosingPipeline.test.ts`:

```ts
import { describe, expect, it, vi, afterEach } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { createMockViewer, createTestConvex, ensureSeededIdentity } from "../../auth/helpers";

const DEMO_LENDER = createMockViewer({
	roles: ["lender"],
	subject: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
	email: "connor.belez@gmail.com",
	firstName: "Connor",
	lastName: "Belez",
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete process.env.DOCUMENSO_API_TOKEN;
});

describe("demo/dealClosingPipeline", () => {
	it("reports setup_missing_package when the fixed package definition is absent", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		await ensureSeededIdentity(t, DEMO_LENDER);

		const state = await t.withIdentity(DEMO_LENDER).query(
			api.demo.dealClosingPipeline.getState,
			{}
		);

		expect(state.setup.status).toBe("missing_package");
		expect(state.packageDefinition).toMatchObject({
			id: "rd7t376j110ynd5gnvtnskhzch85vnen",
			expectedTitle: "test full package april30",
		});
		expect(state.canReset).toBe(false);
	});

	it("reset returns a deterministic setup error before provider work when package is absent", async () => {
		const t = createTestConvex({ includeWorkflowComponents: false });
		await ensureSeededIdentity(t, DEMO_LENDER);

		await expect(
			t.withIdentity(DEMO_LENDER).action(
				api.demo.dealClosingPipeline.resetAndRegenerate,
				{}
			)
		).rejects.toThrow(/test full package april30/i);
	});
});
```

- [ ] **Step 2: Run the new tests to verify they fail because functions do not exist**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand
```

Expected: FAIL with missing `api.demo.dealClosingPipeline.getState` or generated API type errors.

- [ ] **Step 3: Add the minimal demo harness module**

Create `convex/demo/dealClosingPipeline.ts`:

```ts
import { ConvexError, v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { authedAction, authedQuery } from "../fluent";

const DEMO_PACKAGE_DEFINITION_ID =
	"rd7t376j110ynd5gnvtnskhzch85vnen" as Id<"documentPackageDefinitions">;
const DEMO_PACKAGE_TITLE = "test full package april30";
const DEMO_LENDER = {
	userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as Id<"users">,
	authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
	email: "connor.belez@gmail.com",
	name: "Connor Belez",
};

async function getDemoPackageDefinition(ctx: Pick<QueryCtx, "db">) {
	const definition = await ctx.db.get(DEMO_PACKAGE_DEFINITION_ID);
	if (!definition || definition.name !== DEMO_PACKAGE_TITLE) {
		return null;
	}
	return definition;
}

export const getState = authedQuery
	.input({})
	.handler(async (ctx) => {
		const definition = await getDemoPackageDefinition(ctx);
		return {
			setup: {
				status: definition ? "ready" : "missing_package",
			},
			canReset: Boolean(definition),
			packageDefinition: {
				id: DEMO_PACKAGE_DEFINITION_ID,
				expectedTitle: DEMO_PACKAGE_TITLE,
				currentPublishedVersion: definition?.currentPublishedVersion ?? null,
				name: definition?.name ?? null,
			},
			lender: DEMO_LENDER,
			deal: null,
			package: null,
			auditTrail: [],
		};
	})
	.public();

export const resetAndRegenerate = authedAction
	.input({})
	.handler(async (ctx) => {
		const definition = await ctx.runQuery(
			internal.demo.dealClosingPipeline.getDemoPackageDefinitionInternal,
			{}
		);
		if (!definition) {
			throw new ConvexError(
				`Demo package ${DEMO_PACKAGE_TITLE} (${DEMO_PACKAGE_DEFINITION_ID}) was not found`
			);
		}
		return {
			ok: true,
			packageDefinitionId: DEMO_PACKAGE_DEFINITION_ID,
		};
	})
	.public();

export const getDemoPackageDefinitionInternal = authedQuery
	.input({})
	.handler(async (ctx) => getDemoPackageDefinition(ctx))
	.internal();
```

If fluent builders do not support `.internal()` on `authedQuery`, use `convex.query().input({}).handler(...).internal()` for the internal helper and keep exported public functions explicit.

- [ ] **Step 4: Run codegen and tests**

Run:

```bash
bunx convex codegen
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand
```

Expected: tests pass for missing-package behavior.

- [ ] **Step 5: Add tests for package version application and cleanup call shape**

Extend `src/test/convex/demo/dealClosingPipeline.test.ts` with a published package fixture. Use direct DB inserts for the package definition/version and assert reset creates or selects an active `mortgagePackageApplications` row before generation.

```ts
it("reset applies the fixed published package version before generation", async () => {
	const t = createTestConvex({ includeWorkflowComponents: false });
	await ensureSeededIdentity(t, DEMO_LENDER);
	const packageVersionId = await t.run(async (ctx) => {
		await ctx.db.insert("documentPackageDefinitions", {
			_id: "rd7t376j110ynd5gnvtnskhzch85vnen" as never,
			createdAt: Date.now(),
			currentPublishedVersion: 1,
			description: "Demo package",
			draft: { items: [] },
			hasDraftChanges: false,
			name: "test full package april30",
			updatedAt: Date.now(),
		} as never);
		return ctx.db.insert("documentPackageVersions", {
			packageId: "rd7t376j110ynd5gnvtnskhzch85vnen" as never,
			publishedAt: Date.now(),
			publishedBy: "test",
			version: 1,
			snapshot: {
				description: "Demo package",
				envelopeBoundaries: [],
				items: [],
				name: "test full package april30",
				requiredPlatformRoles: [],
				requiredVariableKeys: [],
			},
		});
	});

	const result = await t.withIdentity(DEMO_LENDER).action(
		api.demo.dealClosingPipeline.resetAndRegenerate,
		{}
	);

	expect(result).toMatchObject({ ok: true, packageVersionId });
});
```

If Convex test insertion cannot force `_id`, replace this test with an internal helper that accepts `packageDefinitionId` in test-only code is not acceptable; instead query by `name` in the harness and assert it still reports the configured id in the read model. Keep production behavior validating both id and title.

- [ ] **Step 6: Implement package version lookup and active application**

In `convex/demo/dealClosingPipeline.ts`, add helpers:

```ts
async function getCurrentDemoPackageVersion(ctx: Pick<QueryCtx, "db">) {
	const definition = await getDemoPackageDefinition(ctx);
	if (!definition?.currentPublishedVersion) {
		return null;
	}
	return ctx.db
		.query("documentPackageVersions")
		.withIndex("by_package", (q) =>
			q
				.eq("packageId", DEMO_PACKAGE_DEFINITION_ID)
				.eq("version", definition.currentPublishedVersion)
		)
		.first();
}

async function ensureActivePackageApplication(
	ctx: Pick<MutationCtx, "db">,
	args: { mortgageId: Id<"mortgages">; packageVersionId: Id<"documentPackageVersions"> }
) {
	const existing = await ctx.db
		.query("mortgagePackageApplications")
		.withIndex("by_mortgage_status", (q) =>
			q.eq("mortgageId", args.mortgageId).eq("status", "active")
		)
		.order("desc")
		.first();
	if (existing?.packageVersionId === args.packageVersionId) {
		return existing._id;
	}
	if (existing) {
		await ctx.db.patch(existing._id, {
			status: "archived",
			archivedAt: Date.now(),
		});
	}
	return ctx.db.insert("mortgagePackageApplications", {
		createdAt: Date.now(),
		mortgageId: args.mortgageId,
		packageVersionId: args.packageVersionId,
		status: "active",
	});
}
```

The full fixed deal bootstrap can initially use the existing fixture/deal lookup pattern. Do not invent a separate document-generation path.

- [ ] **Step 7: Wire reset to package generation**

After package application is active, call the existing generator:

```ts
const generation = await ctx.runAction(
	internal.documents.dealPackages.runCreateDocumentPackageInternal,
	{
		dealId,
		retry: true,
	}
);
```

Return:

```ts
return {
	ok: true,
	dealId,
	mortgageId,
	packageId: generation.packageId,
	packageVersionId: packageVersion._id,
	status: generation.status,
};
```

- [ ] **Step 8: Run tests**

Run:

```bash
bunx convex codegen
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand
```

Expected: tests pass, or fixed-deal bootstrap test remains skipped until Task 3 adds a realistic seed.

- [ ] **Step 9: Record the change**

```bash
gt modify -am "feat: add demo deal closing signing harness"
```

---

### Task 3: Fixed Demo Deal Bootstrap And Audit Read Model

**Files:**
- Modify: `convex/demo/dealClosingPipeline.ts`
- Modify: `src/test/convex/demo/dealClosingPipeline.test.ts`

- [ ] **Step 1: Add failing test for fixed lender identity in generated state**

Add a test that seeds enough deal/package data to call `getState` after reset, then asserts the lender identity:

```ts
it("exposes the fixed lender identity and audit events in the demo read model", async () => {
	const t = createTestConvex({ includeWorkflowComponents: false });
	await ensureSeededIdentity(t, DEMO_LENDER);

	const state = await t.withIdentity(DEMO_LENDER).query(
		api.demo.dealClosingPipeline.getState,
		{}
	);

	expect(state.lender).toMatchObject({
		authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
		email: "connor.belez@gmail.com",
		userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k",
	});
	expect(state.auditTrail).toEqual(expect.any(Array));
});
```

- [ ] **Step 2: Run test**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand -t "fixed lender identity"
```

Expected: FAIL if read model does not yet include audit trail shape or fixed identity fields.

- [ ] **Step 3: Implement audit event helper in demo harness**

In `convex/demo/dealClosingPipeline.ts`, add a demo event writer that stores events in `auditJournal` because the route needs persistent audit visibility:

```ts
import { appendAuditJournalEntry } from "../engine/auditJournal";

async function appendDemoAudit(
	ctx: MutationCtx,
	args: {
		dealId: Id<"deals"> | string;
		eventType: string;
		message: string;
		metadata?: Record<string, unknown>;
	}
) {
	const now = Date.now();
	return appendAuditJournalEntry(ctx, {
		entityId: String(args.dealId),
		entityType: "deal",
		eventType: args.eventType,
		organizationId: "demo",
		timestamp: now,
		actorId: "demo-deal-closing-pipeline",
		actorType: "system",
		channel: "api",
		previousState: "none",
		newState: "recorded",
		payload: {
			message: args.message,
			...(args.metadata ?? {}),
		},
	});
}
```

Use existing `AuditJournalEntryInput` requirements from `convex/engine/auditJournal.ts`. If field validators reject `channel: "api"`, use the closest existing channel from `channelValidator`.

- [ ] **Step 4: Add audit read helper**

Add:

```ts
async function listDemoAuditEvents(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals"> | null
) {
	if (!dealId) {
		return [];
	}
	const rows = await ctx.db
		.query("auditJournal")
		.filter((q) => q.eq(q.field("entityId"), String(dealId)))
		.order("desc")
		.take(25);
	return rows.map((row) => ({
		id: row._id,
		eventType: row.eventType,
		message:
			typeof row.payload?.message === "string"
				? row.payload.message
				: row.eventType,
		actorId: row.actorId,
		channel: row.channel,
		timestamp: row.timestamp,
		metadata: row.payload,
	}));
}
```

- [ ] **Step 5: Add audit writes around reset**

In `resetAndRegenerate`, add:

```ts
await appendDemoAudit(ctx, {
	dealId,
	eventType: "demo_package_reset_started",
	message: "Demo deal package reset started",
	metadata: { packageDefinitionId: String(DEMO_PACKAGE_DEFINITION_ID) },
});
```

After generation:

```ts
await appendDemoAudit(ctx, {
	dealId,
	eventType: "demo_package_regenerated",
	message: "Demo deal package regenerated",
	metadata: {
		packageId: String(generation.packageId),
		status: generation.status,
	},
});
```

- [ ] **Step 6: Run tests**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand
```

Expected: tests pass.

- [ ] **Step 7: Record the change**

```bash
gt modify -am "feat: add demo signing audit read model"
```

---

### Task 4: Provider Cleanup Results

**Files:**
- Modify: `convex/documents/signature/documenso.ts`
- Modify: `convex/documents/signature/provider.ts`
- Modify: `convex/demo/dealClosingPipeline.ts`
- Test: `src/test/convex/demo/dealClosingPipeline.test.ts`

- [ ] **Step 1: Add failing cleanup test**

Add to `src/test/convex/demo/dealClosingPipeline.test.ts`:

```ts
it("records provider cleanup failures without blocking local supersession", async () => {
	const t = createTestConvex({ includeWorkflowComponents: false });
	await ensureSeededIdentity(t, DEMO_LENDER);
	vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
		if (String(input).endsWith("/envelope/delete")) {
			return new Response(JSON.stringify({ error: "not deletable" }), {
				status: 400,
			});
		}
		return new Response(JSON.stringify({ id: "ignored" }), { status: 200 });
	}));
	process.env.DOCUMENSO_API_TOKEN = "documenso_test_token";

	const result = await t.withIdentity(DEMO_LENDER).action(
		api.demo.dealClosingPipeline.cleanupProviderEnvelopeForTest,
		{ providerEnvelopeId: "env_not_deletable" }
	);

	expect(result).toMatchObject({
		providerEnvelopeId: "env_not_deletable",
		status: "not_deletable",
	});
});
```

If you do not want a public test-only action, make it internal and call through `internal.demo.dealClosingPipeline.cleanupProviderEnvelopeForTest`.

- [ ] **Step 2: Run test**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand -t "cleanup failures"
```

Expected: FAIL because cleanup helper does not exist.

- [ ] **Step 3: Add cleanup result type to provider**

In `convex/documents/signature/provider.ts`, add:

```ts
export interface SignatureProviderCleanupEnvelopeResult {
	providerEnvelopeId: string;
	status: "deleted" | "not_deletable" | "provider_error";
	error?: string;
}
```

Do not replace `deleteEnvelope`; add a helper in the demo harness that catches provider errors and normalizes them.

- [ ] **Step 4: Implement demo cleanup helper**

In `convex/demo/dealClosingPipeline.ts`:

```ts
import { getSignatureProvider } from "../documents/signature/provider";

async function cleanupDocumensoEnvelope(providerEnvelopeId: string) {
	const provider = getSignatureProvider("documenso", {
		fetchFn: fetch,
		getStorageBlob: async () => null,
	});
	try {
		await provider.deleteEnvelope({ providerEnvelopeId });
		return {
			providerEnvelopeId,
			status: "deleted" as const,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			providerEnvelopeId,
			status: message.includes("400")
				? ("not_deletable" as const)
				: ("provider_error" as const),
			error: message,
		};
	}
}
```

Export an internal action for tests:

```ts
export const cleanupProviderEnvelopeForTest = authedAction
	.input({ providerEnvelopeId: v.string() })
	.handler(async (_ctx, args) => cleanupDocumensoEnvelope(args.providerEnvelopeId))
	.public();
```

If keeping this public is too broad, make it internal and test through an internal action. Do not leave a broad production cleanup endpoint without auth.

- [ ] **Step 5: Use cleanup during reset**

Before regenerating, find existing demo package envelope rows for the fixed deal and call `cleanupDocumensoEnvelope` for each `providerEnvelopeId`. For each result, write a demo audit event:

```ts
await appendDemoAudit(ctx, {
	dealId,
	eventType: "demo_provider_envelope_cleanup",
	message: `Provider envelope cleanup ${cleanup.status}`,
	metadata: cleanup,
});
```

- [ ] **Step 6: Run cleanup tests**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand -t "cleanup"
```

Expected: PASS.

- [ ] **Step 7: Record the change**

```bash
gt modify -am "feat: record Documenso cleanup outcomes"
```

---

### Task 5: React Route And Embedded Signing UI

**Files:**
- Modify: `package.json`
- Modify: `src/routes/demo/deal-closing-pipeline.tsx`
- Modify: `src/components/demo/deal-closing/DealClosingPipelineDemo.tsx`
- Modify: `src/components/demo/deal-closing/fixtures.ts`
- Test: `src/test/demo/deal-closing-pipeline.test.tsx`

- [ ] **Step 1: Add Documenso embed package**

Run:

```bash
bun add @documenso/embed-react
```

Expected: `package.json` and lockfile update.

- [ ] **Step 2: Add or update component test for reset and signing eligibility**

Create `src/test/demo/deal-closing-pipeline.test.tsx` with a pure component test if no route harness exists:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DealClosingPipelineDemo } from "#/components/demo/deal-closing/DealClosingPipelineDemo";

vi.mock("@documenso/embed-react", () => ({
	EmbedSignDocument: ({ token }: { token: string }) => (
		<div data-testid="documenso-embed">token:{token}</div>
	),
}));

const state = {
	setup: { status: "ready" },
	canReset: true,
	packageDefinition: {
		id: "rd7t376j110ynd5gnvtnskhzch85vnen",
		expectedTitle: "test full package april30",
		name: "test full package april30",
		currentPublishedVersion: 1,
	},
	lender: {
		userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k",
		authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
		email: "connor.belez@gmail.com",
		name: "Connor Belez",
	},
	deal: {
		id: "demo",
		title: "Demo deal",
		statusLabel: "Documents in progress",
		stage: "documents",
	},
	package: {
		instances: [
			{
				instanceId: "inst1",
				displayName: "Investment Agreement",
				status: "signature_sent",
				signing: {
					canLaunchEmbeddedSigning: true,
					recipients: [
						{
							email: "connor.belez@gmail.com",
							isCurrentViewer: true,
							name: "Connor Belez",
							platformRole: "lender_primary",
							status: "pending",
						},
					],
				},
			},
		],
	},
	auditTrail: [
		{
			id: "audit1",
			eventType: "demo_package_regenerated",
			message: "Demo deal package regenerated",
			timestamp: Date.now(),
		},
	],
};

describe("DealClosingPipelineDemo", () => {
	it("renders the real package state and reset action", () => {
		render(
			<DealClosingPipelineDemo
				onCreateSigningSession={vi.fn()}
				onReset={vi.fn()}
				resetPending={false}
				signingSession={null}
				state={state as never}
			/>
		);

		expect(screen.getByText("test full package april30")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /reset/i })).toBeEnabled();
		expect(screen.getByText("connor.belez@gmail.com")).toBeInTheDocument();
	});
});
```

- [ ] **Step 3: Run component test to verify failure**

Run:

```bash
bun test src/test/demo/deal-closing-pipeline.test.tsx --runInBand
```

Expected: FAIL because component props still expect fixture data.

- [ ] **Step 4: Update route wiring**

Modify `src/routes/demo/deal-closing-pipeline.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { DealClosingPipelineDemo } from "#/components/demo/deal-closing/DealClosingPipelineDemo";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/demo/deal-closing-pipeline")({
	ssr: false,
	component: DealClosingPipelineRoute,
});

function DealClosingPipelineRoute() {
	const state = useQuery(api.demo.dealClosingPipeline.getState, {});
	const reset = useAction(api.demo.dealClosingPipeline.resetAndRegenerate);
	const createSigningSession = useAction(
		api.documents.signature.sessions.createEmbeddedSigningSession
	);
	const [resetPending, setResetPending] = useState(false);
	const [signingSession, setSigningSession] = useState<{
		instanceId: string;
		token: string;
		url: string;
		expiresAt: number;
	} | null>(null);

	if (!state) {
		return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
	}

	return (
		<DealClosingPipelineDemo
			state={state}
			resetPending={resetPending}
			signingSession={signingSession}
			onReset={async () => {
				setResetPending(true);
				try {
					await reset({});
				} finally {
					setResetPending(false);
				}
			}}
			onCreateSigningSession={async (args) => {
				const session = await createSigningSession({
					dealId: args.dealId as Id<"deals">,
					instanceId: args.instanceId as Id<"dealDocumentInstances">,
				});
				const token = session.url.split("/").pop() ?? session.url;
				setSigningSession({
					instanceId: args.instanceId,
					token,
					url: session.url,
					expiresAt: session.expiresAt,
				});
			}}
		/>
	);
}
```

- [ ] **Step 5: Update component props and embed**

Modify `DealClosingPipelineDemo.tsx` to import:

```tsx
import { EmbedSignDocument } from "@documenso/embed-react";
```

Replace fixture-only props with:

```ts
interface DealClosingPipelineDemoProps {
	state: DemoDealClosingState;
	resetPending: boolean;
	signingSession: {
		instanceId: string;
		token: string;
		url: string;
		expiresAt: number;
	} | null;
	onReset: () => Promise<void>;
	onCreateSigningSession: (args: {
		dealId: string;
		instanceId: string;
	}) => Promise<void>;
}
```

Define a local type from the backend shape or use `FunctionReturnType<typeof api.demo.dealClosingPipeline.getState>` in a separate typed wrapper.

In the dialog body, replace the iframe with:

```tsx
{signingSession ? (
	<EmbedSignDocument
		token={signingSession.token}
		onDocumentCompleted={() => {
			setOpenEnvelopeId(null);
		}}
	/>
) : (
	<div className="grid h-full place-items-center px-6 text-center">
		<Button
			onClick={() =>
				onCreateSigningSession({
					dealId: state.deal.id,
					instanceId: selectedEnvelope.instanceId,
				})
			}
		>
			Launch secure signing
		</Button>
	</div>
)}
```

Only render the launch button when `selectedEnvelope.signing.canLaunchEmbeddedSigning` is true.

- [ ] **Step 6: Run component test**

Run:

```bash
bun test src/test/demo/deal-closing-pipeline.test.tsx --runInBand
```

Expected: PASS.

- [ ] **Step 7: Run typecheck for frontend wiring**

Run:

```bash
bun typecheck
```

Expected: PASS or only unrelated pre-existing failures documented in `docs/test-failure-manifest.md`.

- [ ] **Step 8: Record the change**

```bash
gt modify -am "feat: wire deal demo to embedded Documenso signing"
```

---

### Task 6: Webhook/Sync Audit Visibility

**Files:**
- Modify: `convex/demo/dealClosingPipeline.ts`
- Modify: `convex/deals/envelopeWebhooks.ts` only if provider events do not carry enough ids for the demo read-model projection.
- Test: `src/test/convex/demo/dealClosingPipeline.test.ts`

- [ ] **Step 1: Add failing test for provider event visibility**

Add to `src/test/convex/demo/dealClosingPipeline.test.ts`:

```ts
it("includes Documenso provider webhook events in the demo audit trail", async () => {
	const t = createTestConvex({ includeWorkflowComponents: false });
	await ensureSeededIdentity(t, DEMO_LENDER);
	const fixture = await seedDemoDealClosingFixture(t);
	const dealId = fixture.dealId;
	await t.run(async (ctx) => {
		await ctx.db.insert("dealEnvelopeProviderEvents", {
			provider: "documenso",
			providerEventId: "event_demo_signed",
			providerEnvelopeId: "env_demo",
			rawBody: "{}",
			rawEventType: "DOCUMENT_COMPLETED",
			normalizedEventType: "document_completed",
			status: "processed",
			signatureVerified: true,
			dealId,
			attempts: 1,
			receivedAt: Date.now(),
			processedAt: Date.now(),
		});
	});

	const state = await t.withIdentity(DEMO_LENDER).query(
		api.demo.dealClosingPipeline.getState,
		{}
	);

	expect(state.auditTrail.some((entry) =>
		entry.eventType.includes("document_completed")
	)).toBe(true);
});
```

`seedDemoDealClosingFixture` should be introduced in this test file by extracting the smallest reusable setup from `seedDealPackageFixture` in `src/test/convex/documents/dealPackages.test.ts`: seeded lender, borrower, broker, property, mortgage, listing, and deal rows. Keep it local to this test file unless a second test file needs it.

- [ ] **Step 2: Run test**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand -t "provider webhook events"
```

Expected: FAIL until `getState` merges provider events.

- [ ] **Step 3: Merge provider events into audit trail read model**

In `convex/demo/dealClosingPipeline.ts`, add:

```ts
async function listDocumensoProviderEvents(
	ctx: Pick<QueryCtx, "db">,
	dealId: Id<"deals"> | null
) {
	if (!dealId) {
		return [];
	}
	const rows = await ctx.db
		.query("dealEnvelopeProviderEvents")
		.filter((q) => q.eq(q.field("dealId"), dealId))
		.order("desc")
		.take(25);
	return rows.map((row) => ({
		id: row._id,
		eventType: `documenso_${row.normalizedEventType}`,
		message: `Documenso ${row.normalizedEventType}`,
		timestamp: row.processedAt ?? row.receivedAt,
		metadata: {
			providerEnvelopeId: row.providerEnvelopeId,
			providerRecipientId: row.providerRecipientId,
			rawEventType: row.rawEventType,
			status: row.status,
		},
	}));
}
```

Combine and sort audit entries:

```ts
const auditTrail = [
	...(await listDemoAuditEvents(ctx, dealId)),
	...(await listDocumensoProviderEvents(ctx, dealId)),
].sort((left, right) => right.timestamp - left.timestamp);
```

- [ ] **Step 4: Run test**

Run:

```bash
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand -t "provider webhook events"
```

Expected: PASS.

- [ ] **Step 5: Record the change**

```bash
gt modify -am "feat: show Documenso webhook events in demo audit trail"
```

---

### Task 7: Live E2E And Cleanup

**Files:**
- Create: `e2e/deal-closing/documenso-signing.spec.ts`
- Modify: `e2e/helpers/document-engine.ts` only if the existing base URL/storage-state helpers cannot open authenticated demo routes.
- Modify: `docs/test-failure-manifest.md` only if live environment skips are documented

- [ ] **Step 1: Add live e2e with credential guard**

Create `e2e/deal-closing/documenso-signing.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { ADMIN_STORAGE_STATE, BASE_URL } from "../helpers/document-engine";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Demo Deal Closing - Documenso signing", () => {
	test.skip(
		!process.env.DOCUMENSO_API_TOKEN && !process.env.DOCUMENSO_API_KEY,
		"DOCUMENSO_API_TOKEN or DOCUMENSO_API_KEY is required for live Documenso e2e"
	);

	test("regenerates the fixed package and opens embedded signing", async ({ page }) => {
		await page.goto(`${BASE_URL}/demo/deal-closing-pipeline`);
		await expect(page.getByText("test full package april30")).toBeVisible({
			timeout: 20_000,
		});

		await page.getByRole("button", { name: /reset.*regenerate/i }).click();
		await expect(page.getByText(/Documenso|signature|envelope/i)).toBeVisible({
			timeout: 60_000,
		});

		const signButton = page.getByRole("button", {
			name: /launch secure signing|open signing|sign/i,
		}).first();
		await expect(signButton).toBeVisible({ timeout: 20_000 });
		await signButton.click();

		await expect(page.locator("text=/documenso|sign document/i")).toBeVisible({
			timeout: 30_000,
		});
	});
});
```

- [ ] **Step 2: Run e2e in configured environment**

Run:

```bash
bun run test:e2e e2e/deal-closing/documenso-signing.spec.ts
```

Expected with credentials: route regenerates a live envelope and opens embedded signing. Expected without credentials: Playwright skips with the explicit message.

- [ ] **Step 3: Add teardown cleanup artifact**

If live test creates envelopes but does not complete signing, collect visible provider envelope ids from the route or query output and call a cleanup endpoint. Add this to the test after the reset assertion:

```ts
const envelopeIds = await page
	.getByTestId("provider-envelope-id")
	.allTextContents();
test.info().attach("documenso-envelope-cleanup", {
	body: envelopeIds.join("\n"),
	contentType: "text/plain",
});
```

The backend reset action already attempts provider deletion on next run, so the e2e artifact records any ids that need manual inspection.

- [ ] **Step 4: Record the change**

```bash
gt modify -am "test: add live Documenso deal demo e2e"
```

---

### Task 8: Final Validation

**Files:**
- All changed files
- Modify: `docs/superpowers/specs/2026-04-30-demo-deal-closing-documenso-signing-design.md` only if implementation discoveries require a spec correction

- [ ] **Step 1: Run codegen**

Run:

```bash
bunx convex codegen
```

Expected: exits 0. Generated API files may change when new Convex functions are added.

- [ ] **Step 2: Run formatter/lint check first**

Run:

```bash
bun check
```

Expected: exits 0. Per repo instructions, do not manually chase lint before this command has had a chance to auto-fix.

- [ ] **Step 3: Run typecheck**

Run:

```bash
bun typecheck
```

Expected: exits 0.

- [ ] **Step 4: Run focused tests**

Run:

```bash
bun test src/test/convex/documents/dealPackages.test.ts --runInBand -t "Documenso|interpolation|embedded signing"
bun test src/test/convex/demo/dealClosingPipeline.test.ts --runInBand
bun test src/test/demo/deal-closing-pipeline.test.tsx --runInBand
```

Expected: all pass.

- [ ] **Step 5: Run live e2e when credentials are configured**

Run:

```bash
bun run test:e2e e2e/deal-closing/documenso-signing.spec.ts
```

Expected: pass in configured live Documenso environment, skip with explicit credential message otherwise.

- [ ] **Step 6: Run GitNexus change detection before commit**

Run:

```bash
npx gitnexus detect-changes
```

Expected: affected symbols are limited to demo harness, Documenso signing/provider cleanup, deal demo UI, and related tests. If it reports unexpected high-risk flows, inspect before committing.

- [ ] **Step 7: Commit final validation changes**

```bash
gt modify -am "feat: complete Documenso deal signing demo"
```
