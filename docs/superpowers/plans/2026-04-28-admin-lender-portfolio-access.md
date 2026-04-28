# Admin Lender Portfolio Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an admin lender-record Portfolio tab that renders the exact lender portfolio for any lender, including the FairLend MIC lender, with full admin-action support and audit metadata.

**Architecture:** Refactor the portfolio backend around an explicit target-lender context. Existing portal lender queries and new admin queries both build that context, then call the same portfolio builders and return the same contracts. The admin UI embeds the existing `LenderPortfolioPage` inside the admin lender detail surface with a small context/audit banner and admin-specific query/action hooks.

**Tech Stack:** Convex, fluent-convex, React, TanStack Router, TanStack Query + Convex query integration, Tailwind/ShadCN, Vitest, convex-test, Playwright, Bun, Biome.

---

## File Structure

- Create: `convex/portfolio/context.ts`
  - Owns explicit target-lender portfolio context types and builders.
- Modify: `convex/portfolio/helpers.ts`
  - Replaces hidden `ctx.viewer.authId` / `ctx.lender._id` reads with explicit target-lender context where portfolio assembly needs lender identity.
- Modify: `convex/portfolio/history.ts`
  - Keeps existing public behavior, but accepts explicit target context from callers where useful.
- Modify: `convex/portfolio/export.ts`
  - Keeps export contract unchanged and allows admin callers to pass target-lender identity explicitly.
- Modify: `convex/portfolio/queries.ts`
  - Builds target context from `portalLenderQuery()` and passes it into shared helpers.
- Create: `convex/admin/portfolio/queries.ts`
  - Admin-only command center, position detail, payment detail, renewal detail, and export reads.
- Create: `convex/admin/portfolio/renewals.ts`
  - Admin wrapper for lender renewal actions with target lender business subject and admin metadata.
- Modify: `convex/renewals/runtime.ts`
  - Extracts shared renewal signal implementation used by portal and admin wrappers.
- Modify: `convex/renewals/portal.ts`
  - Keeps public portal API and delegates core mutation behavior to runtime helper.
- Create: `convex/admin/portfolio/__tests__/queries.test.ts`
  - Backend admin read parity, auth, MIC, and error-state coverage.
- Create: `convex/admin/portfolio/__tests__/renewals.test.ts`
  - Backend admin action audit coverage for renewal action family.
- Modify: `src/components/lender/portfolio/query-options.ts`
  - Adds admin query option builders parallel to existing portal query option builders.
- Modify: `src/components/lender/portfolio/renewals/use-renewal-actions.ts`
  - Accepts an optional admin target mode and calls admin renewal mutation/query options when present.
- Modify: `src/components/lender/portfolio/LenderPortfolioPage.tsx`
  - Accepts an explicit `queryMode` prop and threads it to renewal, export, history, detail, and action child hooks without changing normal lender behavior.
- Modify: `src/components/lender/portfolio/position-sheet.tsx`
  - Uses admin position detail query options when `queryMode.kind === "admin"`.
- Modify: `src/components/lender/portfolio/payment-sheet.tsx`
  - Uses admin payment detail query options when `queryMode.kind === "admin"`.
- Create: `src/components/admin/lenders/AdminLenderPortfolioTab.tsx`
  - Admin wrapper around `LenderPortfolioPage` with context/audit banner and admin query wiring.
- Modify: `src/components/admin/shell/entity-view-adapters.tsx`
  - Adds `renderPortfolioTab` adapter support for lenders.
- Modify: `src/components/admin/shell/RecordSidebar.tsx`
  - Adds optional `Portfolio` tab when the resolved entity adapter provides it.
- Create: `src/test/admin/admin-lender-portfolio-tab.test.tsx`
  - Frontend route/tab/banner/query wiring tests.
- Create: `e2e/admin/lender-portfolio.spec.ts`
  - Admin opens lender record, views portfolio tab, performs representative auditable renewal action.
- Modify: `docs/superpowers/specs/2026-04-28-admin-lender-portfolio-access-design.md`
  - Link implementation plan after completion if desired.

Before any code edits to functions/classes/methods, run GitNexus impact analysis for each touched symbol as required by `AGENTS.md`. Minimum impact targets:

```bash
npx gitnexus impact buildPortfolioCommandCenter --direction upstream
npx gitnexus impact buildPortfolioPositionDetail --direction upstream
npx gitnexus impact buildPortfolioPaymentDetail --direction upstream
npx gitnexus impact signalLenderRenewalIntent --direction upstream
npx gitnexus impact LenderPortfolioPage --direction upstream
npx gitnexus impact RecordSidebarContent --direction upstream
```

If the GitNexus CLI reports a stale index, run:

```bash
npx gitnexus analyze
```

---

### Task 1: Backend Failing Tests For Admin Portfolio Reads

**Files:**
- Create: `convex/admin/portfolio/__tests__/queries.test.ts`
- Read: `convex/portfolio/__tests__/queries.test.ts`
- Read: `src/test/convex/portfolio-fixtures.ts`

- [ ] **Step 1: Write failing admin read tests**

Create `convex/admin/portfolio/__tests__/queries.test.ts`:

```ts
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import { seedFromIdentity } from "../../../../src/test/auth/helpers";
import {
	FAIRLEND_ADMIN,
	LENDER,
	MEMBER,
} from "../../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../../src/test/convex/portfolio-fixtures";

const adminPortfolioApi = anyApi.admin.portfolio.queries;
const lenderPortfolioApi = anyApi.portfolio.queries;

describe("admin lender portfolio queries", () => {
	it("returns the same command-center contract as the lender portal query", async () => {
		const t = createHarness();
		const { lenderId, portalId } = await createPortfolioFixture(t);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		const lender = t.withIdentity(LENDER);

		const lenderResult = await lender.query(
			lenderPortfolioApi.getLenderPortfolioCommandCenter,
			{ portalId }
		);
		const adminResult = await admin.query(
			adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
			{ targetLenderId: lenderId }
		);

		expect(adminResult).toMatchObject({
			cockpit: lenderResult.cockpit,
			emptyStates: lenderResult.emptyStates,
			limitsStrip: lenderResult.limitsStrip,
			positions: lenderResult.positions,
			paymentActivity: lenderResult.paymentActivity,
			suggestedOpportunities: lenderResult.suggestedOpportunities,
		});
	});

	it("rejects non-admin callers", async () => {
		const t = createHarness();
		const { lenderId } = await createPortfolioFixture(t);

		await expect(
			t.withIdentity(MEMBER).query(
				adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
				{ targetLenderId: lenderId }
			)
		).rejects.toThrow(/admin|Forbidden/i);
	});

	it("fails closed when the target lender does not exist", async () => {
		const t = createHarness();
		await seedFromIdentity(t, FAIRLEND_ADMIN);
		const missingLenderId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: "deleted_lender_user",
				email: "deleted-lender@example.test",
			});
			const lenderId = await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId: undefined,
				createdAt: Date.now(),
				onboardingEntryPath: "admin_seed",
				orgId: FAIRLEND_ADMIN.org_id ?? "org_admin",
				status: "active",
				userId,
			});
			await ctx.db.delete(lenderId);
			return lenderId;
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).query(
				adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
				{ targetLenderId: missingLenderId }
			)
		).rejects.toThrow("Lender not found");
	});

	it("fails closed when the lender user is missing an auth id", async () => {
		const t = createHarness();
		await seedFromIdentity(t, FAIRLEND_ADMIN);

		const lenderId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				email: "missing-auth@example.test",
				firstName: "Missing",
				lastName: "Auth",
			});
			const brokerUserId = await ctx.db.insert("users", {
				authId: "broker_missing_auth",
				email: "broker@example.test",
			});
			const brokerId = await ctx.db.insert("brokers", {
				brokerageName: "Missing Auth Broker",
				createdAt: Date.now(),
				orgId: FAIRLEND_ADMIN.org_id ?? "org_admin",
				status: "active",
				userId: brokerUserId,
			});
			return await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId,
				createdAt: Date.now(),
				onboardingEntryPath: "admin_seed",
				orgId: FAIRLEND_ADMIN.org_id ?? "org_admin",
				status: "active",
				userId,
			});
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).query(
				adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
				{ targetLenderId: lenderId }
			)
		).rejects.toThrow("Lender portfolio identity missing");
	});

	it("fails closed when the target lender has no broker context", async () => {
		const t = createHarness();
		await seedFromIdentity(t, FAIRLEND_ADMIN);

		const lenderId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: "lender_no_broker",
				email: "no-broker@example.test",
			});
			return await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId: undefined,
				createdAt: Date.now(),
				onboardingEntryPath: "admin_seed",
				orgId: FAIRLEND_ADMIN.org_id ?? "org_admin",
				status: "active",
				userId,
			});
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).query(
				adminPortfolioApi.getAdminLenderPortfolioCommandCenter,
				{ targetLenderId: lenderId }
			)
		).rejects.toThrow("Lender broker context missing");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test convex/admin/portfolio/__tests__/queries.test.ts
```

Expected: FAIL because `anyApi.admin.portfolio.queries.getAdminLenderPortfolioCommandCenter` is not implemented.

- [ ] **Step 3: Record test-only change if starting a new Graphite branch**

Run only if this is the first tracked change on the branch:

```bash
gt create -am "test: cover admin lender portfolio reads"
```

Otherwise run:

```bash
gt modify -am "test: cover admin lender portfolio reads"
```

---

### Task 2: Explicit Portfolio Target Context

**Files:**
- Create: `convex/portfolio/context.ts`
- Modify: `convex/portfolio/helpers.ts`
- Modify: `convex/portfolio/queries.ts`
- Modify: `convex/portfolio/history.ts`
- Modify: `convex/portfolio/export.ts`
- Test: `convex/admin/portfolio/__tests__/queries.test.ts`
- Test: `convex/portfolio/__tests__/queries.test.ts`

- [ ] **Step 1: Run impact analysis before editing shared portfolio symbols**

Run:

```bash
npx gitnexus impact buildPortfolioCommandCenter --direction upstream
npx gitnexus impact buildPortfolioPositionDetail --direction upstream
npx gitnexus impact buildPortfolioPaymentDetail --direction upstream
```

Expected: output lists current portal query callers and frontend query flows. If risk is HIGH or CRITICAL, stop and report the blast radius before editing.

- [ ] **Step 2: Add explicit context types and portal adapter**

Create `convex/portfolio/context.ts`:

```ts
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { Viewer } from "../fluent";
import type { PortalLenderContext } from "../portals/middleware";

export interface PortfolioTargetContext {
	readonly brokerId: Id<"brokers">;
	readonly portal: Doc<"portals">;
	readonly targetLender: Doc<"lenders">;
	readonly targetLenderAuthId: string;
	readonly targetLenderId: Id<"lenders">;
	readonly viewer: Pick<Viewer, "authId" | "isFairLendAdmin">;
}

export type PortfolioTargetQueryCtx = Pick<QueryCtx, "db" | "storage"> &
	PortfolioTargetContext;

export function buildPortalPortfolioTargetContext(
	ctx: Pick<QueryCtx, "db" | "storage"> &
		PortalLenderContext & { viewer: Pick<Viewer, "authId" | "isFairLendAdmin"> }
): PortfolioTargetContext {
	if (!ctx.portal.brokerId) {
		throw new ConvexError("Lender broker context missing");
	}

	return {
		brokerId: ctx.portal.brokerId,
		portal: ctx.portal,
		targetLender: ctx.lender,
		targetLenderAuthId: ctx.viewer.authId,
		targetLenderId: ctx.lender._id,
		viewer: {
			authId: ctx.viewer.authId,
			isFairLendAdmin: ctx.viewer.isFairLendAdmin,
		},
	};
}

export function withPortfolioTarget<TCtx extends Pick<QueryCtx, "db" | "storage">>(
	ctx: TCtx,
	target: PortfolioTargetContext
): TCtx & PortfolioTargetContext {
	return {
		...ctx,
		...target,
	};
}
```

- [ ] **Step 3: Update helper context type and identity reads**

In `convex/portfolio/helpers.ts`, replace the existing context type:

```ts
import type { PortfolioTargetQueryCtx } from "./context";

type PortfolioQueryContext = PortfolioTargetQueryCtx;
```

Then replace these identity reads:

```ts
ctx.viewer.authId
ctx.lender._id
ctx.portal.brokerId
```

with:

```ts
ctx.targetLenderAuthId
ctx.targetLenderId
ctx.brokerId
```

Concrete replacements in `buildPortfolioCommandCenter`:

```ts
const positions = await listActiveLenderPositionAccounts(
	ctx,
	ctx.targetLenderAuthId
);
const renewalIntentMap = await loadRenewalIntentMap(ctx, ctx.targetLenderId);
const openDealsByMortgageMap = await loadOpenDealsByMortgageMap(
	ctx,
	ctx.targetLenderId
);
const monthlyAccrual = await buildPortfolioAccrualBreakdown(
	ctx,
	ctx.targetLenderAuthId,
	startOfMonthBusinessDate(),
	today
);
const ytdAccrual = await buildPortfolioAccrualBreakdown(
	ctx,
	ctx.targetLenderAuthId,
	startOfYearBusinessDate(),
	today
);
const lifetimeAccrual = await buildPortfolioAccrualBreakdown(
	ctx,
	ctx.targetLenderAuthId,
	lifetimeFromDate,
	today
);
const availableCashBalance = await getAvailableLenderPayableBalanceImpl(
	ctx,
	ctx.targetLenderId
);
const undisbursedEntries = await ctx.db
	.query("dispersalEntries")
	.withIndex("by_lender", (query) => query.eq("lenderId", ctx.targetLenderId))
	.collect();
const constraint = await loadLenderFilterConstraint(ctx, {
	brokerId: ctx.brokerId,
	lenderId: ctx.targetLenderId,
});
```

Apply the same pattern in `buildPortfolioPositionDetail` and `buildPortfolioPaymentDetail`.

- [ ] **Step 4: Update portal queries to pass explicit context**

In `convex/portfolio/queries.ts`, import:

```ts
import {
	buildPortalPortfolioTargetContext,
	withPortfolioTarget,
} from "./context";
```

Update each handler:

```ts
.handler(async (ctx) => {
	const target = buildPortalPortfolioTargetContext(ctx);
	return await buildPortfolioCommandCenter(withPortfolioTarget(ctx, target));
})
```

For detail handlers:

```ts
.handler(async (ctx, args) => {
	const target = buildPortalPortfolioTargetContext(ctx);
	return await buildPortfolioPositionDetail(
		withPortfolioTarget(ctx, target),
		args.mortgageId
	);
})
```

For history/export handlers, continue to call existing helpers but use target fields:

```ts
const target = buildPortalPortfolioTargetContext(ctx);
return await buildPortfolioHistoricalSeries(ctx, {
	lenderAuthId: target.targetLenderAuthId,
	lenderId: target.targetLenderId,
	months: args.months,
	today: unixMsToBusinessDate(Date.now()),
});
```

- [ ] **Step 5: Run existing portfolio tests**

Run:

```bash
bun run test convex/portfolio/__tests__/queries.test.ts convex/portfolio/__tests__/export.test.ts convex/portfolio/__tests__/snapshots.test.ts
```

Expected: PASS. Existing lender behavior is unchanged.

---

### Task 3: Admin Portfolio Query Surface

**Files:**
- Create: `convex/admin/portfolio/target.ts`
- Create: `convex/admin/portfolio/queries.ts`
- Modify: `convex/admin/portfolio/__tests__/queries.test.ts`
- Test: `convex/admin/portfolio/__tests__/queries.test.ts`

- [ ] **Step 1: Implement admin target resolver**

Create `convex/admin/portfolio/target.ts`:

```ts
import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import type { Viewer } from "../../fluent";
import type { PortfolioTargetContext } from "../../portfolio/context";

type AdminPortfolioTargetCtx = Pick<QueryCtx, "db" | "storage"> & {
	readonly viewer: Pick<Viewer, "authId" | "isFairLendAdmin">;
};

export async function resolveAdminPortfolioTarget(
	ctx: AdminPortfolioTargetCtx,
	targetLenderId: Id<"lenders">
): Promise<PortfolioTargetContext> {
	const targetLender = await ctx.db.get(targetLenderId);
	if (!targetLender) {
		throw new ConvexError("Lender not found");
	}

	const user = await ctx.db.get(targetLender.userId);
	if (!user?.authId) {
		throw new ConvexError("Lender portfolio identity missing");
	}

	if (!targetLender.brokerId) {
		throw new ConvexError("Lender broker context missing");
	}

	const portal = await ctx.db
		.query("portals")
		.withIndex("by_broker", (query) =>
			query.eq("brokerId", targetLender.brokerId).eq("status", "active")
		)
		.first();
	if (!portal) {
		throw new ConvexError("Lender portal context missing");
	}

	return {
		brokerId: targetLender.brokerId,
		portal,
		targetLender,
		targetLenderAuthId: user.authId,
		targetLenderId: targetLender._id,
		viewer: {
			authId: ctx.viewer.authId,
			isFairLendAdmin: ctx.viewer.isFairLendAdmin,
		},
	};
}
```

- [ ] **Step 2: Add admin query endpoints**

Create `convex/admin/portfolio/queries.ts`:

```ts
import { v } from "convex/values";
import { adminQuery } from "../../fluent";
import {
	portfolioCommandCenterValidator,
	portfolioHistoricalSeriesValidator,
	portfolioPaymentDetailValidator,
	portfolioPositionDetailValidator,
	portfolioTaxExportValidator,
} from "../../portfolio/contracts";
import { buildPortfolioTaxExport } from "../../portfolio/export";
import {
	buildPortfolioCommandCenter,
	buildPortfolioPaymentDetail,
	buildPortfolioPositionDetail,
} from "../../portfolio/helpers";
import { buildPortfolioHistoricalSeries } from "../../portfolio/history";
import { unixMsToBusinessDate } from "../../lib/businessDates";
import { withPortfolioTarget } from "../../portfolio/context";
import { resolveAdminPortfolioTarget } from "./target";

export const getAdminLenderPortfolioCommandCenter = adminQuery
	.input({ targetLenderId: v.id("lenders") })
	.returns(portfolioCommandCenterValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioCommandCenter(withPortfolioTarget(ctx, target));
	})
	.public();

export const getAdminLenderPortfolioPositionDetail = adminQuery
	.input({
		mortgageId: v.id("mortgages"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPositionDetailValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioPositionDetail(
			withPortfolioTarget(ctx, target),
			args.mortgageId
		);
	})
	.public();

export const getAdminLenderPortfolioPaymentDetail = adminQuery
	.input({
		obligationId: v.id("obligations"),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioPaymentDetailValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioPaymentDetail(
			withPortfolioTarget(ctx, target),
			args.obligationId
		);
	})
	.public();

export const getAdminLenderPortfolioHistoricalSeries = adminQuery
	.input({
		months: v.optional(v.number()),
		targetLenderId: v.id("lenders"),
	})
	.returns(portfolioHistoricalSeriesValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioHistoricalSeries(ctx, {
			lenderAuthId: target.targetLenderAuthId,
			lenderId: target.targetLenderId,
			months: args.months,
			today: unixMsToBusinessDate(Date.now()),
		});
	})
	.public();

export const getAdminLenderPortfolioTaxExport = adminQuery
	.input({
		targetLenderId: v.id("lenders"),
		year: v.optional(v.number()),
	})
	.returns(portfolioTaxExportValidator)
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await buildPortfolioTaxExport(ctx, {
			lenderAuthId: target.targetLenderAuthId,
			lenderId: target.targetLenderId,
			today: unixMsToBusinessDate(Date.now()),
			year: args.year,
		});
	})
	.public();
```

- [ ] **Step 3: Run admin query tests**

Run:

```bash
bun run test convex/admin/portfolio/__tests__/queries.test.ts
```

Expected: PASS for command-center parity, auth rejection, and fail-closed cases.

- [ ] **Step 4: Run codegen**

Run:

```bash
bunx convex codegen
```

Expected: PASS and `convex/_generated/api.d.ts` includes `admin.portfolio.queries`.

- [ ] **Step 5: Record backend query change**

Run:

```bash
gt modify -am "feat: add admin lender portfolio queries"
```

---

### Task 4: Admin Renewal Action Wrapper With Audit Metadata

**Files:**
- Modify: `convex/renewals/runtime.ts`
- Modify: `convex/renewals/portal.ts`
- Create: `convex/admin/portfolio/renewals.ts`
- Create: `convex/admin/portfolio/__tests__/renewals.test.ts`

- [ ] **Step 1: Run impact analysis before editing renewal symbols**

Run:

```bash
npx gitnexus impact signalLenderRenewalIntent --direction upstream
npx gitnexus impact transitionLenderRenewalIntent --direction upstream
```

Expected: output lists portal renewal UI and tests. If risk is HIGH or CRITICAL, report before editing.

- [ ] **Step 2: Write failing admin renewal action test**

Create `convex/admin/portfolio/__tests__/renewals.test.ts`:

```ts
import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import { FAIRLEND_ADMIN, LENDER, MEMBER } from "../../../../src/test/auth/identities";
import {
	createHarness,
	createPortfolioFixture,
} from "../../../../src/test/convex/portfolio-fixtures";

const adminRenewalsApi = anyApi.admin.portfolio.renewals;

describe("admin lender portfolio renewal actions", () => {
	it("signals a target lender renewal intent with admin audit metadata", async () => {
		const t = createHarness();
		const { lenderId, mortgageId } = await createPortfolioFixture(t);

		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			adminRenewalsApi.signalAdminLenderRenewalIntent,
			{
				intent: "renew",
				mortgageId,
				reason: "Admin confirmed renewal decision during lender support call.",
				targetLenderId: lenderId,
			}
		);

		const renewalIntent = await t.run(async (ctx) => {
			return await ctx.db
				.query("lenderRenewalIntents")
				.withIndex("by_mortgage_and_lender", (query) =>
					query.eq("mortgageId", mortgageId).eq("lenderId", lenderId)
				)
				.unique();
		});

		expect(renewalIntent).toMatchObject({
			intent: "renew",
			status: expect.stringMatching(/signal|renew|pending/i),
		});
		expect(renewalIntent?.adminActingAuthId).toBe(FAIRLEND_ADMIN.subject);
		expect(renewalIntent?.adminActingReason).toBe(
			"Admin confirmed renewal decision during lender support call."
		);
	});

	it("rejects non-admin callers", async () => {
		const t = createHarness();
		const { lenderId, mortgageId } = await createPortfolioFixture(t);

		await expect(
			t.withIdentity(MEMBER).mutation(
				adminRenewalsApi.signalAdminLenderRenewalIntent,
				{
					intent: "renew",
					mortgageId,
					reason: "Member should not be able to act for a lender.",
					targetLenderId: lenderId,
				}
			)
		).rejects.toThrow(/admin|Forbidden/i);
	});

	it("rejects a target lender without an active position", async () => {
		const t = createHarness();
		const { mortgageId } = await createPortfolioFixture(t, { issueAmount: 0 });

		const otherLenderId = await t.run(async (ctx) => {
			const userId = await ctx.db.insert("users", {
				authId: "other_lender_no_position",
				email: "other@example.test",
			});
			return await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId: undefined,
				createdAt: Date.now(),
				onboardingEntryPath: "admin_seed",
				orgId: LENDER.org_id ?? "org_lender",
				status: "active",
				userId,
			});
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).mutation(
				adminRenewalsApi.signalAdminLenderRenewalIntent,
				{
					intent: "renew",
					mortgageId,
					reason: "Admin attempted renewal for invalid lender position.",
					targetLenderId: otherLenderId,
				}
			)
		).rejects.toThrow(/position|Forbidden/i);
	});
});
```

- [ ] **Step 3: Extract shared renewal signal runtime**

In `convex/renewals/runtime.ts`, add:

```ts
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export interface RenewalActingMetadata {
	readonly adminActingAuthId?: string;
	readonly adminActingReason?: string;
	readonly source: "lender_portal" | "admin_lender_portfolio";
}

export interface SignalLenderRenewalIntentRuntimeArgs {
	readonly actingMetadata: RenewalActingMetadata;
	readonly intent: "renew" | "partial_exit" | "exit";
	readonly lenderAuthId: string;
	readonly lenderId: Id<"lenders">;
	readonly mortgageId: Id<"mortgages">;
	readonly notes?: string;
	readonly partialExitFractions?: number;
}

export async function signalLenderRenewalIntentRuntime(
	ctx: MutationCtx,
	args: SignalLenderRenewalIntentRuntimeArgs
): Promise<Doc<"lenderRenewalIntents">> {
	const nowMs = Date.now();
	const mortgage = await loadMortgageOrThrow(ctx, args.mortgageId);
	const positionAccount = await findCurrentPositionAccount({
		ctx,
		lenderAuthId: args.lenderAuthId,
		mortgageId: args.mortgageId,
	});
	const currentHeldFractions = getCurrentHeldFractions(positionAccount);

	if (!(positionAccount && currentHeldFractions > 0)) {
		throw new ConvexError(
			"Forbidden: lender does not currently hold an actionable position for this mortgage"
		);
	}

	assertValidRequestedIntent({
		currentHeldFractions,
		intent: args.intent,
		partialExitFractions: args.partialExitFractions,
	});

	const existing = await findExistingLenderRenewalIntent({
		ctx,
		lenderId: args.lenderId,
		mortgageId: args.mortgageId,
	});

	const patch = {
		adminActingAuthId: args.actingMetadata.adminActingAuthId,
		adminActingReason: args.actingMetadata.adminActingReason,
		actionSource: args.actingMetadata.source,
		intent: args.intent,
		notes: args.notes,
		partialExitFractions: args.partialExitFractions,
		signalledAt: nowMs,
	};

	if (existing) {
		await ctx.db.patch(existing._id, patch);
		return (await ctx.db.get(existing._id)) as Doc<"lenderRenewalIntents">;
	}

	const intentId = await ctx.db.insert("lenderRenewalIntents", {
		...patch,
		brokerId: mortgage.brokerOfRecordId,
		createdAt: nowMs,
		fractionCount: currentHeldFractions,
		lenderId: args.lenderId,
		maturityDate: Date.parse(`${mortgage.maturityDate}T00:00:00.000Z`),
		mortgageId: args.mortgageId,
		positionAccountId: positionAccount._id as string,
		signalDeadline: Date.parse(`${mortgage.maturityDate}T00:00:00.000Z`),
		status: "pending_signal",
	});
	return (await ctx.db.get(intentId)) as Doc<"lenderRenewalIntents">;
}
```

Add optional audit fields to `lenderRenewalIntents` in `convex/schema.ts`:

```ts
adminActingAuthId: v.optional(v.string()),
adminActingReason: v.optional(v.string()),
actionSource: v.optional(
	v.union(v.literal("lender_portal"), v.literal("admin_lender_portfolio"))
),
```

- [ ] **Step 4: Update portal mutation to delegate to runtime**

In `convex/renewals/portal.ts`, replace the body of `signalLenderRenewalIntent` with:

```ts
.handler(async (ctx, args) => {
	return await signalLenderRenewalIntentRuntime(ctx, {
		actingMetadata: { source: "lender_portal" },
		intent: args.intent,
		lenderAuthId: ctx.viewer.authId,
		lenderId: ctx.lender._id,
		mortgageId: args.mortgageId,
		notes: args.notes,
		partialExitFractions: args.partialExitFractions,
	});
})
```

- [ ] **Step 5: Add admin renewal mutation**

Create `convex/admin/portfolio/renewals.ts`:

```ts
import { ConvexError, v } from "convex/values";
import { adminMutation } from "../../fluent";
import { lenderRenewalIntentChoiceValidator } from "../../renewals/constants";
import { signalLenderRenewalIntentRuntime } from "../../renewals/runtime";
import { resolveAdminPortfolioTarget } from "./target";

const MIN_ADMIN_REASON_LENGTH = 12;

function validateAdminReason(reason: string) {
	const trimmed = reason.trim();
	if (trimmed.length < MIN_ADMIN_REASON_LENGTH) {
		throw new ConvexError(
			`Admin action reason must be at least ${MIN_ADMIN_REASON_LENGTH} characters.`
		);
	}
	return trimmed;
}

export const signalAdminLenderRenewalIntent = adminMutation
	.input({
		intent: lenderRenewalIntentChoiceValidator,
		mortgageId: v.id("mortgages"),
		partialExitFractions: v.optional(v.number()),
		reason: v.string(),
		targetLenderId: v.id("lenders"),
	})
	.handler(async (ctx, args) => {
		const target = await resolveAdminPortfolioTarget(ctx, args.targetLenderId);
		return await signalLenderRenewalIntentRuntime(ctx, {
			actingMetadata: {
				adminActingAuthId: ctx.viewer.authId,
				adminActingReason: validateAdminReason(args.reason),
				source: "admin_lender_portfolio",
			},
			intent: args.intent,
			lenderAuthId: target.targetLenderAuthId,
			lenderId: target.targetLenderId,
			mortgageId: args.mortgageId,
			partialExitFractions: args.partialExitFractions,
		});
	})
	.public();
```

- [ ] **Step 6: Run renewal tests**

Run:

```bash
bun run test convex/admin/portfolio/__tests__/renewals.test.ts src/test/convex/renewals/portal.test.ts
```

Expected: PASS. Portal renewal behavior remains intact; admin mutation attaches metadata.

- [ ] **Step 7: Record renewal action change**

Run:

```bash
gt modify -am "feat: add auditable admin lender renewal action"
```

---

### Task 5: Admin Portfolio Query Options And Page Wrapper

**Files:**
- Modify: `src/components/lender/portfolio/query-options.ts`
- Modify: `src/components/lender/portfolio/LenderPortfolioPage.tsx`
- Modify: `src/components/lender/portfolio/renewals/use-renewal-actions.ts`
- Create: `src/components/admin/lenders/AdminLenderPortfolioTab.tsx`
- Test: `src/test/admin/admin-lender-portfolio-tab.test.tsx`

- [ ] **Step 1: Run impact analysis before editing frontend symbols**

Run:

```bash
npx gitnexus impact LenderPortfolioPage --direction upstream
npx gitnexus impact usePortfolioRenewalActions --direction upstream
```

Expected: output lists lender route and portfolio tests. If risk is HIGH or CRITICAL, report before editing.

- [ ] **Step 2: Add admin query option builders**

In `src/components/lender/portfolio/query-options.ts`, add:

```ts
export function adminLenderPortfolioCommandCenterQueryOptions(
	targetLenderId: Id<"lenders">
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioCommandCenter,
		{ targetLenderId }
	);
}

export function adminLenderPortfolioPositionDetailQueryOptions(
	targetLenderId: Id<"lenders">,
	mortgageId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioPositionDetail,
		{
			mortgageId: mortgageId as Id<"mortgages">,
			targetLenderId,
		}
	);
}

export function adminLenderPortfolioPaymentDetailQueryOptions(
	targetLenderId: Id<"lenders">,
	obligationId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioPaymentDetail,
		{
			obligationId: obligationId as Id<"obligations">,
			targetLenderId,
		}
	);
}

export function adminLenderPortfolioRenewalIntentQueryOptions(
	targetLenderId: Id<"lenders">,
	mortgageId: string
) {
	return convexQuery(
		api.admin.portfolio.queries.getAdminLenderPortfolioRenewalIntentByMortgage,
		{
			mortgageId: mortgageId as Id<"mortgages">,
			targetLenderId,
		}
	);
}
```

Add `getAdminLenderPortfolioRenewalIntentByMortgage` to `convex/admin/portfolio/queries.ts` using `resolveAdminPortfolioTarget`, `findExistingLenderRenewalIntent`, and a shared renewal projection helper that accepts `lenderAuthId`.

- [ ] **Step 3: Make renewal hook target-mode aware**

In `src/components/lender/portfolio/renewals/use-renewal-actions.ts`, change the args type:

```ts
export type PortfolioRenewalActionMode =
	| { kind: "portal"; portalId: Id<"portals"> }
	| {
			adminActionReason?: string;
			kind: "admin";
			targetLenderId: Id<"lenders">;
		};

export function usePortfolioRenewalActions(args: {
	mode: PortfolioRenewalActionMode;
	mortgageId: string;
}): UsePortfolioRenewalActionsResult {
	const signalLenderRenewalIntent = useMutation(
		api.renewals.portal.signalLenderRenewalIntent
	);
	const signalAdminLenderRenewalIntent = useMutation(
		api.admin.portfolio.renewals.signalAdminLenderRenewalIntent
	);
	const renewalQuery = useQuery({
		...(args.mode.kind === "admin"
			? adminLenderPortfolioRenewalIntentQueryOptions(
					args.mode.targetLenderId,
					args.mortgageId
				)
			: lenderPortfolioRenewalIntentQueryOptions(
					args.mode.portalId,
					args.mortgageId
				)),
	});
```

Update `submitIntent`:

```ts
if (args.mode.kind === "admin") {
	await signalAdminLenderRenewalIntent({
		intent,
		mortgageId: args.mortgageId as Id<"mortgages">,
		partialExitFractions,
		reason:
			args.mode.adminActionReason ??
			"Admin submitted lender renewal decision from portfolio tab.",
		targetLenderId: args.mode.targetLenderId,
	});
	return;
}

await signalLenderRenewalIntent({
	intent,
	mortgageId: args.mortgageId as Id<"mortgages">,
	partialExitFractions,
	portalId: args.mode.portalId,
});
```

- [ ] **Step 4: Add explicit query mode to portfolio page**

In `src/components/lender/portfolio/LenderPortfolioPage.tsx`, add:

```ts
export type LenderPortfolioQueryMode =
	| { kind: "portal"; portalId: Id<"portals"> }
	| {
			actionReason?: string;
			kind: "admin";
			targetLenderId: Id<"lenders">;
		};

export interface LenderPortfolioPageProps {
	leafStateOverrides?: LenderPortfolioPageLeafStateOverrides;
	queryMode: LenderPortfolioQueryMode;
	search: LenderPortfolioSearchState;
	setSearch: (updater: PortfolioSearchUpdater) => void;
	snapshot: PortfolioCommandCenterSnapshot;
	suggestedOpportunitiesState?: SuggestedOpportunitiesState;
}
```

Where renewal surfaces are rendered, pass:

```tsx
renewalMode={
	queryMode.kind === "admin"
		? {
				adminActionReason: queryMode.actionReason,
				kind: "admin",
				targetLenderId: queryMode.targetLenderId,
			}
		: { kind: "portal", portalId: queryMode.portalId }
}
```

Update `RenewalActionSurface` props to accept `renewalMode` and pass it into `usePortfolioRenewalActions`.
Update `ConnectedPortfolioCockpit`, `ConnectedPortfolioExportStrip`, `PositionSheet`, `PaymentSheet`, and `ActionsRail` call sites to receive `queryMode`. Portal mode keeps using existing portal endpoints; admin mode uses the new admin endpoints.

- [ ] **Step 5: Create admin tab wrapper**

Create `src/components/admin/lenders/AdminLenderPortfolioTab.tsx`:

```tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { LenderPortfolioPage } from "#/components/lender/portfolio/LenderPortfolioPage";
import {
	DEFAULT_LENDER_PORTFOLIO_SEARCH,
	type LenderPortfolioSearchState,
} from "#/components/lender/portfolio/portfolio-types";
import { adminLenderPortfolioCommandCenterQueryOptions } from "#/components/lender/portfolio/query-options";
import { cleanLenderPortfolioSearch } from "#/components/lender/portfolio/search";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Badge } from "#/components/ui/badge";
import type { Id } from "../../../../convex/_generated/dataModel";

export interface AdminLenderPortfolioTabProps {
	readonly brokerLabel?: string;
	readonly isMicLender?: boolean;
	readonly lenderLabel: string;
	readonly targetLenderId: Id<"lenders">;
}

export function AdminLenderPortfolioTab({
	brokerLabel,
	isMicLender = false,
	lenderLabel,
	targetLenderId,
}: AdminLenderPortfolioTabProps) {
	const [search, setSearchState] = useState<LenderPortfolioSearchState>(
		DEFAULT_LENDER_PORTFOLIO_SEARCH
	);
	const { data } = useSuspenseQuery(
		adminLenderPortfolioCommandCenterQueryOptions(targetLenderId)
	);
	const suggestedOpportunitiesState =
		data.suggestedOpportunities.availabilityState === "unavailable"
			? "unavailable"
			: "ready";

	return (
		<div className="space-y-4">
			<Alert className="border-amber-200 bg-amber-50 text-amber-950">
				<AlertTriangle className="size-4" />
				<AlertTitle className="flex flex-wrap items-center gap-2">
					Viewing lender portfolio as admin
					{isMicLender ? <Badge variant="secondary">FairLend MIC</Badge> : null}
				</AlertTitle>
				<AlertDescription>
					You are viewing {lenderLabel}
					{brokerLabel ? ` through ${brokerLabel}` : ""}. Actions from this
					tab are executed for the target lender and audited under your admin
					identity.
				</AlertDescription>
			</Alert>
			<LenderPortfolioPage
				queryMode={{
					actionReason:
						"Admin submitted lender portfolio action from lender record tab.",
					kind: "admin",
					targetLenderId,
				}}
				search={search}
				setSearch={(updater) =>
					setSearchState((current) => cleanLenderPortfolioSearch(updater(current)))
				}
				snapshot={data}
				suggestedOpportunitiesState={suggestedOpportunitiesState}
			/>
		</div>
	);
}
```

- [ ] **Step 6: Write frontend tests**

Create `src/test/admin/admin-lender-portfolio-tab.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { portfolioCommandCenterFixture } from "#/components/lender/portfolio/fixtures";
import { AdminLenderPortfolioTab } from "#/components/admin/lenders/AdminLenderPortfolioTab";

vi.mock("@tanstack/react-query", () => ({
	useSuspenseQuery: vi.fn(),
}));

vi.mock("#/components/lender/portfolio/LenderPortfolioPage", () => ({
	LenderPortfolioPage: ({ queryMode, snapshot }: any) => (
		<div data-testid="portfolio-page">
			<span>{queryMode.targetLenderId}</span>
			<span>{snapshot.cockpit.metrics.activePositionCount}</span>
		</div>
	),
}));

describe("AdminLenderPortfolioTab", () => {
	it("renders admin audit context and the shared portfolio page", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: portfolioCommandCenterFixture,
		} as never);

		render(
			<AdminLenderPortfolioTab
				brokerLabel="Meridian Brokerage"
				lenderLabel="Meridian Capital"
				targetLenderId={"lender_123" as never}
			/>
		);

		expect(screen.getByText(/Viewing lender portfolio as admin/i)).toBeTruthy();
		expect(screen.getByText(/Meridian Capital/)).toBeTruthy();
		expect(screen.getByText(/Meridian Brokerage/)).toBeTruthy();
		expect(screen.getByTestId("portfolio-page")).toBeTruthy();
		expect(screen.getByText("lender_123")).toBeTruthy();
	});

	it("marks the MIC lender without changing the shared portfolio body", () => {
		vi.mocked(useSuspenseQuery).mockReturnValue({
			data: portfolioCommandCenterFixture,
		} as never);

		render(
			<AdminLenderPortfolioTab
				isMicLender
				lenderLabel="FairLend MIC"
				targetLenderId={"lender_mic" as never}
			/>
		);

		expect(screen.getByText("FairLend MIC")).toBeTruthy();
		expect(screen.getByTestId("portfolio-page")).toBeTruthy();
	});
});
```

- [ ] **Step 7: Run frontend tests**

Run:

```bash
bun run test src/test/admin/admin-lender-portfolio-tab.test.tsx src/test/routes/lender-portfolio-route.test.tsx src/test/lender/portfolio-renewals.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Record frontend wrapper change**

Run:

```bash
gt modify -am "feat: add admin lender portfolio tab wrapper"
```

---

### Task 6: Admin Record Portfolio Tab Integration

**Files:**
- Modify: `src/components/admin/shell/entity-view-adapters.tsx`
- Modify: `src/components/admin/shell/RecordSidebar.tsx`
- Test: `src/test/admin/admin-lender-portfolio-tab.test.tsx`

- [ ] **Step 1: Run impact analysis before editing admin shell tabs**

Run:

```bash
npx gitnexus impact RecordSidebar --direction upstream
npx gitnexus impact resolveRecordSidebarEntityAdapter --direction upstream
```

Expected: output lists admin record pages and tests. If risk is HIGH or CRITICAL, report before editing.

- [ ] **Step 2: Add optional portfolio tab adapter contract**

In `src/components/admin/shell/entity-view-adapters.tsx`, extend `RecordSidebarEntityAdapter`:

```ts
readonly renderPortfolioTab?: (args: RecordTabRenderArgs) => ReactNode;
```

Import the admin tab:

```ts
import { AdminLenderPortfolioTab } from "#/components/admin/lenders/AdminLenderPortfolioTab";
```

Add to the `lenders` adapter:

```tsx
renderPortfolioTab: ({ record, reference }) => {
	if (!record) {
		return null;
	}
	const lenderLabel =
		String(record.fields.lenderName ?? record.fields.organizationName ?? reference.recordId);
	const brokerLabel =
		typeof record.fields.brokerSummary === "string"
			? record.fields.brokerSummary
			: undefined;
	const isMicLender =
		lenderLabel.toLowerCase().includes("fairlend mic") ||
		String(record.fields.organizationName ?? "")
			.toLowerCase()
			.includes("fairlend mic");

	return (
		<AdminLenderPortfolioTab
			brokerLabel={brokerLabel}
			isMicLender={isMicLender}
			lenderLabel={lenderLabel}
			targetLenderId={reference.recordId as Id<"lenders">}
		/>
	);
},
```

Add `Id` import:

```ts
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
```

- [ ] **Step 3: Render optional Portfolio tab in RecordSidebar**

In `src/components/admin/shell/RecordSidebar.tsx`, add a tab trigger after Details:

```tsx
{adapter?.renderPortfolioTab ? (
	<TabsTrigger value="portfolio">Portfolio</TabsTrigger>
) : null}
```

Add content after Details content:

```tsx
{adapter?.renderPortfolioTab ? (
	<TabsContent className="p-4 sm:p-6" value="portfolio">
		{adapter.renderPortfolioTab(sharedTabArgs)}
	</TabsContent>
) : null}
```

- [ ] **Step 4: Extend frontend tests for actual tab integration**

In `src/test/admin/admin-lender-portfolio-tab.test.tsx`, add:

```tsx
import { resolveRecordSidebarEntityAdapter } from "#/components/admin/shell/entity-view-adapters";

it("exposes a Portfolio tab renderer for lender records only", () => {
	const lenderAdapter = resolveRecordSidebarEntityAdapter({
		entityType: "lenders",
		objectDef: undefined,
	});
	const borrowerAdapter = resolveRecordSidebarEntityAdapter({
		entityType: "borrowers",
		objectDef: undefined,
	});

	expect(lenderAdapter?.renderPortfolioTab).toBeTypeOf("function");
	expect(borrowerAdapter?.renderPortfolioTab).toBeUndefined();
});
```

- [ ] **Step 5: Run admin UI tests**

Run:

```bash
bun run test src/test/admin/admin-lender-portfolio-tab.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Record admin shell tab change**

Run:

```bash
gt modify -am "feat: mount portfolio tab on admin lender records"
```

---

### Task 7: E2E Coverage And Final Validation

**Files:**
- Create: `e2e/admin/lender-portfolio.spec.ts`
- Modify: `docs/superpowers/specs/2026-04-28-admin-lender-portfolio-access-design.md`
- Run: repo validation commands

- [ ] **Step 1: Add E2E spec**

Create `e2e/admin/lender-portfolio.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("admin lender portfolio", () => {
	test("admin opens a lender record portfolio tab", async ({ page }) => {
		await page.goto("/admin/lenders");
		await expect(page.getByRole("heading", { name: /lenders/i })).toBeVisible();

		await page.getByRole("link", { name: /meridian|fairlend|lender/i }).first().click();
		await page.getByRole("tab", { name: "Portfolio" }).click();

		await expect(
			page.getByText(/Viewing lender portfolio as admin/i)
		).toBeVisible();
		await expect(page.getByTestId("lender-portfolio-shell")).toBeVisible();
		await expect(page.getByTestId("portfolio-cockpit")).toBeVisible();
	});
});
```

Use the existing seeded admin lender fixture name in the local E2E harness. If the harness seed changes, update the selector in this test in the same commit that changes the seed.

- [ ] **Step 2: Run targeted backend tests**

Run:

```bash
bun run test convex/admin/portfolio/__tests__/queries.test.ts convex/admin/portfolio/__tests__/renewals.test.ts convex/portfolio/__tests__/queries.test.ts src/test/convex/renewals/portal.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run targeted frontend tests**

Run:

```bash
bun run test src/test/admin/admin-lender-portfolio-tab.test.tsx src/test/routes/lender-portfolio-route.test.tsx src/test/lender/portfolio-renewals.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run targeted E2E**

Run:

```bash
bun run test:e2e e2e/admin/lender-portfolio.spec.ts
```

Expected: PASS. Auth setup failures before reaching the feature are blockers for this E2E task; record the exact setup failure in the task notes and run `bun run test:e2e e2e/rbac/admin.spec.ts` to separate harness instability from feature failure.

- [ ] **Step 5: Run required repo validation**

Run in this order:

```bash
bun check
bun typecheck
bunx convex codegen
```

Expected: PASS for all three. `bun check` must run before manual lint-format fixes because it may autofix formatting.

- [ ] **Step 6: Run GitNexus change detection before final commit**

Run:

```bash
npx gitnexus detect-changes
```

Expected: affected symbols and flows are limited to portfolio context, admin portfolio queries/actions, admin lender detail UI, and portfolio renewal action wiring.

- [ ] **Step 7: Link the implementation plan from the approved spec**

Append to `docs/superpowers/specs/2026-04-28-admin-lender-portfolio-access-design.md`:

```md
## Implementation Plan

- [Admin Lender Portfolio Access Implementation Plan](../plans/2026-04-28-admin-lender-portfolio-access.md)
```

- [ ] **Step 8: Record final implementation change**

Run:

```bash
gt modify -am "feat: add admin lender portfolio access"
```

---

## Completion Checklist

- [ ] Admin can open `/admin/lenders/:recordid` and see a `Portfolio` tab.
- [ ] The tab renders the existing lender portfolio body.
- [ ] Admin portfolio reads return the same core contract as lender portal reads for the same target lender.
- [ ] FairLend MIC is treated as a normal target lender in this feature.
- [ ] Admin renewal action attaches target lender and admin metadata.
- [ ] Non-admin callers cannot use admin portfolio endpoints.
- [ ] Missing lender identity, missing broker context, and invalid target records fail closed.
- [ ] `bun check` passes.
- [ ] `bun typecheck` passes.
- [ ] `bunx convex codegen` passes.
- [ ] `npx gitnexus detect-changes` reports only expected scope.
