# MIC Investors Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `mic.<domain>` as a public MIC landing page plus an invite-only authenticated `/portal` experience, with admin-triaged email-only access requests and a read-only MIC transparency dashboard derived from mortgage-ledger MIC-as-lender participation.

**Architecture:** Extend the portal registry with a first-class `mic` portal type and explicit MIC lender mapping, then build a dedicated `micInvestorAccessRequest` governed workflow that provisions a WorkOS user and membership into the MIC organization on approval. Reuse lender-portfolio UI patterns where they fit, but keep the MIC route, permission, and query contracts separate so the source of truth stays the mortgage ledger and not org ownership.

**Tech Stack:** Convex, fluent-convex, WorkOS AuthKit, TanStack Router, TanStack Query, React, Tailwind CSS, ShadCN UI, Vitest, React Testing Library, convex-test, Biome, Graphite

---

**Branch workflow note:** the repo is on detached `HEAD`. The first record step below uses `gt create -am` to create a tracked branch. All later record steps use `gt modify -am`.

## File Structure

### Portal and auth foundation

- Modify: `convex/auth/permissionCatalog.ts`
  Add `mic:access` and the `micinvestor` role grant.
- Modify: `src/lib/auth.ts`
  Add the MIC route authorization rule so `/portal` is permission-gated by `mic:access`.
- Modify: `src/lib/portal/route-host-policy.ts`
  Treat `/portal` and `/portal/mortgages/*` as portal-host-only routes.
- Modify: `shared/portal/contracts.ts`
  Reserve the `mic` slug and keep MIC host handling explicit.
- Modify: `convex/portals/validators.ts`
  Add `portalType: "mic"` plus `lenderId` to the portal summary contract.
- Modify: `convex/schema.ts`
  Add `lenderId` to `portals` and add the `micInvestorAccessRequests` table.
- Modify: `convex/portals/helpers.ts`
  Add a `micPortalFields()` helper with `defaultPostAuthPath: "/portal"`.
- Modify: `convex/portals/middleware.ts`
  Add MIC-specific resolved context helpers.
- Modify: `convex/fluent.ts`
  Add `portalMicQuery()` and `portalMicMutation()` wrappers.
- Modify: `convex/portals/queries.ts`
  Return MIC lender mapping in portal summaries so host resolution, auth completion, and route loaders can use it safely.

### MIC request workflow

- Create: `convex/micInvestorAccess/validators.ts`
  Input and result validators for public submit, admin review, internal lookup, and provisioning updates.
- Create: `convex/micInvestorAccess/internal.ts`
  Internal reads and patch helpers used by the effect.
- Create: `convex/micInvestorAccess/mutations.ts`
  Public submit mutation plus admin approve/reject mutations.
- Create: `convex/micInvestorAccess/queries.ts`
  Admin triage list, request detail, and audit-oriented list filters.
- Create: `convex/engine/machines/micInvestorAccessRequest.machine.ts`
  Governed lifecycle definition.
- Create: `convex/engine/effects/micInvestorAccess.ts`
  WorkOS provisioning effect with explicit success/failure writes and home-portal sync.
- Modify: `convex/engine/machines/registry.ts`
- Modify: `convex/engine/effects/registry.ts`
- Modify: `convex/engine/types.ts`
- Modify: `convex/engine/validators.ts`
  Register the new governed entity and effect names.

### MIC portfolio contracts

- Create: `convex/micPortfolio/contracts.ts`
  Validators and shared TypeScript types for dashboard, sidebar detail, and full mortgage detail contracts.
- Create: `convex/micPortfolio/helpers.ts`
  Ledger-derived MIC aggregation helpers keyed by `portal.lenderId`.
- Create: `convex/micPortfolio/queries.ts`
  Dashboard, sheet detail, and full mortgage detail queries.

### Frontend surfaces

- Create: `src/components/mic/landing/MicLandingPage.tsx`
- Create: `src/components/mic/landing/MicRequestForm.tsx`
- Create: `src/components/mic/portal/query-options.ts`
- Create: `src/components/mic/portal/mic-portal-types.ts`
- Create: `src/components/mic/portal/MicPortalPage.tsx`
- Create: `src/components/mic/portal/MicPositionSheet.tsx`
- Create: `src/components/mic/portal/MicMortgageDetailPage.tsx`
- Create: `src/components/admin/mic-investors/AdminMicInvestorRequestsPage.tsx`
  MIC-only presentation and route-facing React components. Per the user requirement, these presentational slices should be delegated to Kimi before local integration.
- Modify: `src/routes/index.tsx`
  Render the public MIC landing page for active MIC portal hosts.
- Create: `src/routes/portal.tsx`
  Authenticated MIC dashboard route.
- Create: `src/routes/portal.mortgages.$mortgageId.tsx`
  Full mortgage detail route used by the sheet CTA.
- Create: `src/routes/admin/mic-investors.tsx`
  Admin request-triage route.
- Modify: `src/components/admin/shell/entity-registry.ts`
  Add the admin nav entry.

### Tests

- Modify: `convex/portals/__tests__/registry.test.ts`
- Modify: `src/test/auth/permissions.ts`
- Modify: `src/test/routes/route-host-policy.test.ts`
- Create: `src/test/convex/micInvestorAccess.test.ts`
- Create: `convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts`
- Create: `convex/micPortfolio/__tests__/queries.test.ts`
- Create: `src/test/routes/mic-landing-page.test.tsx`
- Create: `src/test/admin/mic-investors-page.test.tsx`
- Create: `src/test/routes/mic-portal-route.test.tsx`
- Modify: `src/test/routes/portal-auth-callback.test.tsx`

## Task 1: Add MIC Portal Auth And Registry Foundation

**Files:**
- Modify: `convex/auth/permissionCatalog.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/portal/route-host-policy.ts`
- Modify: `shared/portal/contracts.ts`
- Modify: `convex/portals/validators.ts`
- Modify: `convex/schema.ts`
- Modify: `convex/portals/helpers.ts`
- Modify: `convex/portals/queries.ts`
- Test: `src/test/auth/permissions.ts`
- Test: `src/test/routes/route-host-policy.test.ts`
- Test: `convex/portals/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing auth and portal registry tests**

```ts
// src/test/auth/permissions.ts
it("grants micinvestor the MIC access permission", () => {
	expect(hasPermissionGrant(["mic:access"], "mic:access")).toBe(true);
	expect(PERMISSION_DISPLAY_METADATA["mic:access"]).toEqual({
		description: "Access the MIC investor portal",
		domain: "access",
		name: "MIC Access",
	});
});

// src/test/routes/route-host-policy.test.ts
it("treats /portal as a portal-host route", () => {
	expect(resolveRouteHostPolicy("/portal")).toBe("portal");
	expect(resolveRouteHostPolicy("/portal/mortgages/mortgage_123")).toBe("portal");
});

// convex/portals/__tests__/registry.test.ts
it("exposes MIC portal metadata including lender mapping", async () => {
	const result = await t.query(internal.portals.queries.getPortalBySlugInternal, {
		slug: "mic",
	});
	expect(result?.portalType).toBe("mic");
	expect(String(result?.lenderId)).toBe(String(micLenderId));
	expect(result?.defaultPostAuthPath).toBe("/portal");
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
bun test src/test/auth/permissions.ts src/test/routes/route-host-policy.test.ts convex/portals/__tests__/registry.test.ts
```

Expected:

```text
FAIL PERMISSION_DISPLAY_METADATA["mic:access"] is undefined
FAIL expected "/portal" to resolve to "portal"
FAIL portal summary does not include portalType "mic" or lenderId
```

- [ ] **Step 3: Implement the MIC permission, route, and portal registry changes**

Insert this permission metadata and role grant:

```ts
// convex/auth/permissionCatalog.ts
"mic:access": {
	name: "MIC Access",
	description: "Access the MIC investor portal",
	domain: "access",
},
```

```ts
// convex/auth/permissionCatalog.ts
micinvestor: ["mic:access", "portfolio:view"],
```

Add the MIC island and route authorization rule:

```ts
// src/lib/auth.ts
export const ISLAND_PERMISSIONS = {
	admin: "admin:access",
	broker: "broker:access",
	borrower: "borrower:access",
	lender: "lender:access",
	mic: "mic:access",
	underwriter: "underwriter:access",
	lawyer: "lawyer:access",
	onboarding: "onboarding:access",
} as const;

export const ROUTE_AUTHORIZATION_RULES = {
	adminDocumentEngine: {
		kind: "fairLendAdminWithPermission",
		permission: "document:review",
	},
	adminOriginations: {
		kind: "operationalAdminPermission",
		permission: "mortgage:originate",
	},
	adminRotessaReconciliation: {
		kind: "operationalAdminPermission",
		permission: "payment:manage",
	},
	adminUnderwriting: {
		kind: "anyPermission",
		options: { allowAdminOverride: true },
		permissions: ["admin:access", "underwriter:access"],
	},
	listings: {
		kind: "permission",
		permission: "listing:view",
	},
	borrower: {
		kind: "permission",
		permission: "borrower:access",
	},
	broker: {
		kind: "permission",
		permission: "broker:access",
	},
	lawyer: {
		kind: "permission",
		permission: "lawyer:access",
	},
	lender: {
		kind: "permission",
		permission: "lender:access",
	},
	micPortal: {
		kind: "permission",
		permission: "mic:access",
	},
	onboarding: {
		kind: "permission",
		permission: "onboarding:access",
	},
} as const satisfies Record<string, AuthorizationRequirement>;
```

Make `/portal` portal-host only:

```ts
// src/lib/portal/route-host-policy.ts
const ROUTE_HOST_POLICY_REGISTRY = [
	{ prefix: "/sign-out/local", policy: "shared" },
	{ prefix: "/auth-complete", policy: "shared" },
	{ prefix: "/host-boundary", policy: "shared" },
	{ prefix: "/sign-in", policy: "shared" },
	{ prefix: "/sign-out", policy: "shared" },
	{ prefix: "/sign-up", policy: "shared" },
	{ prefix: "/unauthorized", policy: "shared" },
	{ prefix: "/callback", policy: "shared" },
	{ prefix: "/authenticated", policy: "shared" },
	{ prefix: "/about", policy: "marketing" },
	{ prefix: "/admin", policy: "admin" },
	{ prefix: "/portal", policy: "portal" },
	{ prefix: "/listings", policy: "portal" },
	{ prefix: "/broker", policy: "portal" },
	{ prefix: "/borrower", policy: "portal" },
	{ prefix: "/lender", policy: "portal" },
	{ prefix: "/lawyer", policy: "portal" },
	{ prefix: "/onboard", policy: "portal" },
	{ prefix: "/", policy: "shared" },
] as const;
```

Reserve the `mic` slug:

```ts
// shared/portal/contracts.ts
export const PORTAL_RESERVED_SLUGS = ["app", "api", "admin", "mic", "staging", "www"];
```

Extend the portal contracts and schema:

```ts
// convex/portals/validators.ts
export const portalTypeValidator = v.union(
	v.literal("fairlend"),
	v.literal("broker"),
	v.literal("mic")
);

export const portalSummaryValidator = v.object({
	portalId: v.id("portals"),
	slug: v.string(),
	portalType: portalTypeValidator,
	brokerId: v.optional(v.id("brokers")),
	lenderId: v.optional(v.id("lenders")),
	orgId: v.string(),
	productionHost: v.string(),
	localHost: v.string(),
	status: portalStatusValidator,
	isPublished: v.boolean(),
	publicTeaserEnabled: v.boolean(),
	teaserListingLimit: v.optional(v.number()),
	defaultPostAuthPath: v.optional(v.string()),
	landingPageId: v.optional(v.id("portalLandingPages")),
	pricingPolicyId: v.optional(v.id("portalPricingPolicies")),
});
```

```ts
// convex/schema.ts
portals: defineTable({
	slug: v.string(),
	portalType: portalTypeValidator,
	brokerId: v.optional(v.id("brokers")),
	lenderId: v.optional(v.id("lenders")),
	orgId: v.string(),
	productionHost: v.string(),
	localHost: v.string(),
	status: portalStatusValidator,
	isPublished: v.boolean(),
	publicTeaserEnabled: v.boolean(),
	teaserListingLimit: v.optional(v.number()),
	defaultPostAuthPath: v.optional(v.string()),
	landingPageId: v.optional(v.id("portalLandingPages")),
	pricingPolicyId: v.optional(v.id("portalPricingPolicies")),
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_slug", ["slug"])
	.index("by_production_host", ["productionHost"])
	.index("by_local_host", ["localHost"])
	.index("by_broker", ["brokerId"])
	.index("by_org", ["orgId"])
	.index("by_status", ["status"]),
```

Add the MIC portal helper and include `lenderId` in portal summaries:

```ts
// convex/portals/helpers.ts
export function micPortalFields(args: {
	lenderId: Id<"lenders">;
	now: number;
	orgId: string;
	slug: string;
}) {
	const hosts = buildPortalHosts(args.slug);
	return {
		slug: args.slug,
		portalType: "mic" as const,
		brokerId: undefined,
		lenderId: args.lenderId,
		orgId: args.orgId,
		productionHost: hosts.productionHost,
		localHost: hosts.localHost,
		status: "active" as const,
		isPublished: true,
		publicTeaserEnabled: false,
		teaserListingLimit: 0,
		defaultPostAuthPath: "/portal",
		createdAt: args.now,
		updatedAt: args.now,
	};
}
```

```ts
// convex/portals/middleware.ts
function toPortalSummary(portal: Doc<"portals">): PortalSummary {
	return {
		portalId: portal._id,
		slug: portal.slug,
		portalType: portal.portalType,
		brokerId: portal.brokerId,
		lenderId: portal.lenderId,
		orgId: portal.orgId,
		productionHost: portal.productionHost,
		localHost: portal.localHost,
		status: portal.status,
		isPublished: portal.isPublished,
		publicTeaserEnabled: portal.publicTeaserEnabled,
		teaserListingLimit: portal.teaserListingLimit,
		defaultPostAuthPath: portal.defaultPostAuthPath,
		landingPageId: portal.landingPageId,
		pricingPolicyId: portal.pricingPolicyId,
	};
}
```

Expose internal portal lookups for tests and the provisioning effect:

```ts
// convex/portals/queries.ts
import { internalQuery } from "../_generated/server";

export const getPortalBySlugInternal = internalQuery({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const portal = await getPortalBySlug(ctx, args.slug);
		return portal ? toPortalSummary(portal) : null;
	},
});

export const getPortalByIdInternal = internalQuery({
	args: { portalId: v.id("portals") },
	handler: async (ctx, args) => {
		const portal = await ctx.db.get(args.portalId);
		return portal ? toPortalSummary(portal) : null;
	},
});
```

- [ ] **Step 4: Re-run the focused tests**

Run:

```bash
bun test src/test/auth/permissions.ts src/test/routes/route-host-policy.test.ts convex/portals/__tests__/registry.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 5: Record the change**

```bash
gt create -am "feat: add mic portal auth foundation"
```

## Task 2: Implement The Governed MIC Access Request Workflow

**Files:**
- Modify: `convex/schema.ts`
- Create: `convex/micInvestorAccess/validators.ts`
- Create: `convex/micInvestorAccess/internal.ts`
- Create: `convex/micInvestorAccess/mutations.ts`
- Create: `convex/micInvestorAccess/queries.ts`
- Create: `convex/engine/machines/micInvestorAccessRequest.machine.ts`
- Create: `convex/engine/effects/micInvestorAccess.ts`
- Modify: `convex/engine/machines/registry.ts`
- Modify: `convex/engine/effects/registry.ts`
- Modify: `convex/engine/types.ts`
- Modify: `convex/engine/validators.ts`
- Test: `src/test/convex/micInvestorAccess.test.ts`
- Test: `convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts`

- [ ] **Step 1: Write the failing workflow tests**

```ts
// src/test/convex/micInvestorAccess.test.ts
it("dedupes public requests by portal and normalized email", async () => {
	const first = await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
		email: "Investor@example.com",
		portalSlug: "mic",
	});
	const second = await t.mutation(api.micInvestorAccess.mutations.submitRequest, {
		email: "investor@example.com",
		portalSlug: "mic",
	});
	expect(second.requestId).toBe(first.requestId);
	expect(second.reused).toBe(true);
});

it("approves a request, provisions WorkOS access, and syncs the home portal", async () => {
	const requestId = await seedMicAccessRequest(t, { email: "approved@example.com" });
	await admin.mutation(api.micInvestorAccess.mutations.approveRequest, { requestId });
	const request = await getMicAccessRequest(t, requestId);
	expect(request.status).toBe("approved");
	expect(request.provisioningState).toBe("provisioned");
	expect(request.workosUserId).toBe("user_approved");
	expect(request.workosMembershipId).toBe("om_approved");
});

it("records provisioning failures without pretending the request completed", async () => {
	setWorkosProvisioningForTests({
		createOrganization: vi.fn(),
		createOrganizationMembership: vi.fn().mockRejectedValue(new Error("membership failed")),
		createUser: vi.fn().mockResolvedValue({ email: "failed@example.com", id: "user_failed" }),
		listUsers: vi.fn().mockResolvedValue([]),
	});
	const requestId = await seedMicAccessRequest(t, { email: "failed@example.com" });
	await expect(admin.mutation(api.micInvestorAccess.mutations.approveRequest, { requestId })).rejects.toThrow();
	const request = await getMicAccessRequest(t, requestId);
	expect(request.status).toBe("approved");
	expect(request.provisioningState).toBe("failed");
});

// convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts
it("moves from pending_review to approved or rejected", () => {
	expect(micInvestorAccessRequestMachine.transition("pending_review", { type: "APPROVE" }).value).toBe("approved");
	expect(micInvestorAccessRequestMachine.transition("pending_review", { type: "REJECT" }).value).toBe("rejected");
});
```

- [ ] **Step 2: Run the focused workflow tests to verify they fail**

Run:

```bash
bun test src/test/convex/micInvestorAccess.test.ts convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts
```

Expected:

```text
FAIL api.micInvestorAccess.mutations.submitRequest is undefined
FAIL micInvestorAccessRequestMachine is undefined
```

- [ ] **Step 3: Add the new table, validators, machine, and public/admin mutations**

Add the new table:

```ts
// convex/schema.ts
micInvestorAccessRequests: defineTable({
	email: v.string(),
	normalizedEmail: v.string(),
	portalId: v.id("portals"),
	status: v.union(
		v.literal("pending_review"),
		v.literal("approved"),
		v.literal("rejected")
	),
	reviewedBy: v.optional(v.string()),
	reviewedAt: v.optional(v.number()),
	rejectionReason: v.optional(v.string()),
	provisioningState: v.union(
		v.literal("pending"),
		v.literal("provisioned"),
		v.literal("failed")
	),
	provisioningError: v.optional(v.string()),
	workosUserId: v.optional(v.string()),
	workosMembershipId: v.optional(v.string()),
	createdAt: v.number(),
	updatedAt: v.number(),
})
	.index("by_portal_normalized_email", ["portalId", "normalizedEmail"])
	.index("by_portal_status", ["portalId", "status"]),
```

Create the validators:

```ts
// convex/micInvestorAccess/validators.ts
import { v } from "convex/values";

export const micInvestorAccessStatusValidator = v.union(
	v.literal("pending_review"),
	v.literal("approved"),
	v.literal("rejected")
);

export const micInvestorProvisioningStateValidator = v.union(
	v.literal("pending"),
	v.literal("provisioned"),
	v.literal("failed")
);

export const submitMicInvestorAccessArgsValidator = {
	email: v.string(),
	portalSlug: v.string(),
};

export const reviewMicInvestorAccessArgsValidator = {
	requestId: v.id("micInvestorAccessRequests"),
	rejectionReason: v.optional(v.string()),
};
```

Create the state machine:

```ts
// convex/engine/machines/micInvestorAccessRequest.machine.ts
import { setup } from "xstate";

export const micInvestorAccessRequestMachine = setup({
	types: {
		context: {} as Record<string, never>,
		events: {} as
			| { type: "APPROVE" }
			| { type: "REJECT" },
	},
	actions: {
		provisionMicAccess: () => {},
	},
}).createMachine({
	id: "micInvestorAccessRequest",
	version: "1.0.0",
	initial: "pending_review",
	context: {},
	states: {
		pending_review: {
			on: {
				APPROVE: {
					target: "approved",
					actions: ["provisionMicAccess"],
				},
				REJECT: {
					target: "rejected",
				},
			},
		},
		approved: {},
		rejected: { type: "final" },
	},
});
```

Create the public submit mutation and the admin review mutations:

```ts
// convex/micInvestorAccess/mutations.ts
import { ConvexError, v } from "convex/values";
import { buildSource } from "../engine/commands";
import { executeTransition } from "../engine/transition";
import { adminMutation, convex } from "../fluent";
import { requirePermission } from "../fluent";

export const submitRequest = convex.mutation()
	.input({
		email: v.string(),
		portalSlug: v.string(),
	})
	.handler(async (ctx, args) => {
		const normalizedEmail = args.email.trim().toLowerCase();
		const portal = await ctx.db
			.query("portals")
			.withIndex("by_slug", (query) => query.eq("slug", args.portalSlug))
			.unique();
		if (!portal || portal.portalType !== "mic") {
			throw new ConvexError("MIC portal not found");
		}

		const existing = await ctx.db
			.query("micInvestorAccessRequests")
			.withIndex("by_portal_normalized_email", (query) =>
				query.eq("portalId", portal._id).eq("normalizedEmail", normalizedEmail)
			)
			.unique();

		if (existing && (existing.status === "pending_review" || existing.status === "approved")) {
			return { requestId: existing._id, reused: true };
		}

		const now = Date.now();
		const requestId = await ctx.db.insert("micInvestorAccessRequests", {
			email: args.email.trim(),
			normalizedEmail,
			portalId: portal._id,
			status: "pending_review",
			provisioningState: "pending",
			createdAt: now,
			updatedAt: now,
		});

		return { requestId, reused: false };
	})
	.public();

export const approveRequest = adminMutation
	.use(requirePermission("admin:access"))
	.input({ requestId: v.id("micInvestorAccessRequests") })
	.handler(async (ctx, args) => {
		const result = await executeTransition(ctx, {
			entityType: "micInvestorAccessRequest",
			entityId: args.requestId,
			eventType: "APPROVE",
			payload: {},
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});
		if (!result.success) {
			throw new ConvexError(result.reason ?? "Transition failed");
		}
		await ctx.db.patch(args.requestId, {
			reviewedAt: Date.now(),
			reviewedBy: ctx.viewer.authId,
			status: "approved",
			updatedAt: Date.now(),
		});
		return { ok: true };
	})
	.public();

export const rejectRequest = adminMutation
	.use(requirePermission("admin:access"))
	.input({
		rejectionReason: v.string(),
		requestId: v.id("micInvestorAccessRequests"),
	})
	.handler(async (ctx, args) => {
		const result = await executeTransition(ctx, {
			entityType: "micInvestorAccessRequest",
			entityId: args.requestId,
			eventType: "REJECT",
			payload: { rejectionReason: args.rejectionReason },
			source: buildSource(ctx.viewer, "admin_dashboard"),
		});
		if (!result.success) {
			throw new ConvexError(result.reason ?? "Transition failed");
		}
		await ctx.db.patch(args.requestId, {
			rejectionReason: args.rejectionReason,
			reviewedAt: Date.now(),
			reviewedBy: ctx.viewer.authId,
			status: "rejected",
			updatedAt: Date.now(),
		});
		return { ok: true };
	})
	.public();
```

- [ ] **Step 4: Implement the provisioning effect with explicit user creation, membership creation, and home-portal sync**

Create the internal helpers:

```ts
// convex/micInvestorAccess/internal.ts
import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

export const getById = internalQuery({
	args: { requestId: v.id("micInvestorAccessRequests") },
	handler: async (ctx, args) => await ctx.db.get(args.requestId),
});

export const markProvisioned = internalMutation({
	args: {
		requestId: v.id("micInvestorAccessRequests"),
		workosMembershipId: v.string(),
		workosUserId: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.requestId, {
			provisioningError: undefined,
			provisioningState: "provisioned",
			updatedAt: Date.now(),
			workosMembershipId: args.workosMembershipId,
			workosUserId: args.workosUserId,
		});
	},
});

export const markProvisioningFailed = internalMutation({
	args: {
		errorMessage: v.string(),
		requestId: v.id("micInvestorAccessRequests"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.requestId, {
			provisioningError: args.errorMessage,
			provisioningState: "failed",
			updatedAt: Date.now(),
		});
	},
});
```

Use the existing WorkOS provisioning pattern instead of inventing helpers:

```ts
// convex/engine/effects/micInvestorAccess.ts
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import { internalAction } from "../../_generated/server";
import { effectPayloadValidator } from "../validators";
import { getWorkosProvisioning } from "./workosProvisioning";

function isWorkosConflictError(error: unknown): error is { status: number } {
	return typeof error === "object" && error !== null && "status" in error && error.status === 409;
}

async function findProvisionedUserByEmail(email: string) {
	const provisioning = getWorkosProvisioning();
	const matches = await provisioning.listUsers({ email });
	return matches.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

async function getOrCreateMicUser(email: string) {
	const provisioning = getWorkosProvisioning();
	const existingUser = await findProvisionedUserByEmail(email);
	if (existingUser) {
		return existingUser;
	}
	try {
		return await provisioning.createUser({ email });
	} catch (error) {
		if (!isWorkosConflictError(error)) {
			throw error;
		}
		const conflictedUser = await findProvisionedUserByEmail(email);
		if (conflictedUser) {
			return conflictedUser;
		}
		throw error;
	}
}

export const provisionMicAccess = internalAction({
	args: effectPayloadValidator,
	handler: async (ctx, args) => {
		const request = await ctx.runQuery(internal.micInvestorAccess.internal.getById, {
			requestId: args.entityId as Id<"micInvestorAccessRequests">,
		});
		if (!request) {
			throw new Error(`MIC access request not found: ${args.entityId}`);
		}

		const portal = await ctx.runQuery(internal.portals.queries.getPortalByIdInternal, {
			portalId: request.portalId,
		});
		if (!portal || portal.portalType !== "mic" || !portal.orgId) {
			throw new Error("MIC portal is missing an organization mapping");
		}

		try {
			const user = await getOrCreateMicUser(request.normalizedEmail);
			const provisioning = getWorkosProvisioning();
			const membership = await provisioning.createOrganizationMembership({
				organizationId: portal.orgId,
				roleSlug: "micinvestor",
				userId: user.id,
			});

			await ctx.runMutation(internal.micInvestorAccess.internal.markProvisioned, {
				requestId: request._id,
				workosMembershipId: String((membership as { id: string }).id),
				workosUserId: user.id,
			});

			await ctx.runMutation(internal.auth.syncUserHomePortalAssignment, {
				authId: user.id,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			await ctx.runMutation(internal.micInvestorAccess.internal.markProvisioningFailed, {
				errorMessage: message,
				requestId: request._id,
			});
			throw error;
		}
	},
});
```

Wire the new entity and effect into the engine:

```ts
// convex/engine/types.ts
export type EntityType =
	| "onboardingRequest"
	| "micInvestorAccessRequest"
	| "mortgage"
	| "obligation"
	| "collectionAttempt"
	| "deal"
	| "transfer"
	| "servicingFeeEntry"
	| "dispersalCalculationRun"
	| "auditEvidencePackage"
	| "provisionalApplication"
	| "applicationPackage"
	| "broker"
	| "borrower"
	| "lender"
	| "lenderOnboarding"
	| "provisionalOffer"
	| "offerCondition"
	| "lenderRenewalIntent"
	| "dispersalEntry";

export type GovernedEntityType =
	| "onboardingRequest"
	| "micInvestorAccessRequest"
	| "mortgage"
	| "obligation"
	| "collectionAttempt"
	| "deal"
	| "transfer"
	| "lenderRenewalIntent";

export const ENTITY_TABLE_MAP = {
	onboardingRequest: "onboardingRequests",
	micInvestorAccessRequest: "micInvestorAccessRequests",
	mortgage: "mortgages",
	obligation: "obligations",
	collectionAttempt: "collectionAttempts",
	deal: "deals",
	transfer: "transferRequests",
	servicingFeeEntry: "servicingFeeEntries",
	dispersalCalculationRun: "dispersalCalculationRuns",
	auditEvidencePackage: "auditEvidencePackages",
	provisionalApplication: "provisionalApplications",
	applicationPackage: "applicationPackages",
	broker: "brokers",
	borrower: "borrowers",
	lender: "lenders",
	lenderOnboarding: "lenderOnboardings",
	provisionalOffer: "provisionalOffers",
	offerCondition: "offerConditions",
	lenderRenewalIntent: "lenderRenewalIntents",
	dispersalEntry: "dispersalEntries",
} as const;
```

```ts
// convex/engine/validators.ts
export const entityTypeValidator = v.union(
	v.literal("onboardingRequest"),
	v.literal("micInvestorAccessRequest"),
	v.literal("mortgage"),
	v.literal("obligation"),
	v.literal("collectionAttempt"),
	v.literal("deal"),
	v.literal("transfer"),
	v.literal("servicingFeeEntry"),
	v.literal("dispersalCalculationRun"),
	v.literal("auditEvidencePackage"),
	v.literal("provisionalApplication"),
	v.literal("applicationPackage"),
	v.literal("broker"),
	v.literal("borrower"),
	v.literal("lender"),
	v.literal("lenderOnboarding"),
	v.literal("provisionalOffer"),
	v.literal("offerCondition"),
	v.literal("lenderRenewalIntent"),
	v.literal("dispersalEntry")
);
```

```ts
// convex/engine/machines/registry.ts
export const machineRegistry: Record<GovernedEntityType, AnyStateMachine> = {
	collectionAttempt: collectionAttemptMachine,
	deal: dealMachine,
	lenderRenewalIntent: lenderRenewalIntentMachine,
	micInvestorAccessRequest: micInvestorAccessRequestMachine,
	mortgage: mortgageMachine,
	obligation: obligationMachine,
	onboardingRequest: onboardingRequestMachine,
	transfer: transferMachine,
} as const;
```

```ts
// convex/engine/effects/registry.ts
export const effectRegistry: Record<string, FunctionReference<"mutation" | "action", "internal">> = {
	assignRole: internal.engine.effects.onboarding.assignRole,
	provisionMicAccess: internal.engine.effects.micInvestorAccess.provisionMicAccess,
	notifyApplicantApproved: internal.engine.effects.onboarding.notifyApplicantApproved,
	notifyApplicantRejected: internal.engine.effects.onboarding.notifyApplicantRejected,
	notifyAdminNewRequest: internal.engine.effects.onboarding.notifyAdminNewRequest,
	emitObligationOverdue: internal.engine.effects.obligation.emitObligationOverdue,
	emitObligationSettled: internal.engine.effects.obligation.emitObligationSettled,
	createLateFeeObligation: internal.engine.effects.obligationLateFee.createLateFeeObligation,
	applyPayment: internal.engine.effects.obligationPayment.applyPayment,
	recordWaiver: internal.engine.effects.obligationWaiver.recordWaiver,
	accrueObligation: internal.engine.effects.obligationAccrual.accrueObligation,
	notifyAllParties: internal.engine.effects.dealClosingEffects.notifyAllParties,
	notifyCancellation: internal.engine.effects.dealClosingEffects.notifyCancellation,
	createDocumentPackage: internal.engine.effects.dealClosingEffects.createDocumentPackage,
	archiveSignedDocuments: internal.engine.effects.dealClosingEffects.archiveSignedDocuments,
	confirmFundsReceipt: internal.engine.effects.dealClosingEffects.confirmFundsReceipt,
	collectLockingFee: internal.engine.effects.dealClosingEffects.collectLockingFee,
	reserveShares: internal.engine.effects.dealClosing.reserveShares,
	commitReservation: internal.engine.effects.dealClosing.commitReservation,
	voidReservation: internal.engine.effects.dealClosing.voidReservation,
	prorateAccrualBetweenOwners: internal.engine.effects.dealClosingProrate.prorateAccrualBetweenOwners,
	updatePaymentSchedule: internal.engine.effects.dealClosingPayments.updatePaymentSchedule,
	createDealAccess: internal.engine.effects.dealAccess.createDealAccess,
	revokeAllDealAccess: internal.engine.effects.dealAccess.revokeAllDealAccess,
	revokeLawyerAccess: internal.engine.effects.dealAccess.revokeLawyerAccess,
	emitPaymentReceived: internal.engine.effects.collectionAttempt.emitPaymentReceived,
	recordSettlementObserved: internal.engine.effects.collectionAttempt.recordSettlementObserved,
	scheduleRetryEntry: internal.engine.effects.collectionAttempt.scheduleRetryEntry,
	emitCollectionFailed: internal.engine.effects.collectionAttempt.emitCollectionFailed,
	notifyAdmin: internal.engine.effects.collectionAttempt.notifyAdmin,
	emitPaymentReversed: internal.engine.effects.collectionAttempt.emitPaymentReversed,
	recordTransferProviderRef: internal.engine.effects.transfer.recordTransferProviderRef,
	publishTransferConfirmed: internal.engine.effects.transfer.publishTransferConfirmed,
	publishTransferCancelled: internal.engine.effects.transfer.publishTransferCancelled,
	publishTransferFailed: internal.engine.effects.transfer.publishTransferFailed,
	publishTransferReversed: internal.engine.effects.transfer.publishTransferReversed,
};
```

- [ ] **Step 5: Re-run the focused workflow tests**

Run:

```bash
bun test src/test/convex/micInvestorAccess.test.ts convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: add mic access request workflow"
```

## Task 3: Build The Public MIC Landing Page And Email Capture Flow

**Files:**
- Modify: `src/routes/index.tsx`
- Create: `src/components/mic/landing/MicLandingPage.tsx`
- Create: `src/components/mic/landing/MicRequestForm.tsx`
- Test: `src/test/routes/mic-landing-page.test.tsx`

- [ ] **Step 1: Write the failing route test for the MIC host landing page**

```tsx
// src/test/routes/mic-landing-page.test.tsx
it("renders the MIC landing page on an active MIC portal host", () => {
	vi.mocked(RootRoute.useRouteContext).mockReturnValue({
		portalCacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
		portalContext: {
			availability: "active",
			cacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
			canonicalHost: "mic.localhost:3000",
			kind: "portal",
			matchedHostType: "local",
			portal: {
				defaultPostAuthPath: "/portal",
				isPublished: true,
				landingPageId: undefined,
				lenderId: "lender_mic",
				localHost: "mic.localhost:3000",
				orgId: "org_mic",
				portalId: "portal_mic",
				portalType: "mic",
				pricingPolicyId: undefined,
				productionHost: "mic.fairlend.ca",
				publicTeaserEnabled: false,
				slug: "mic",
				status: "active",
				teaserListingLimit: 0,
			},
			requestedHost: "mic.localhost:3000",
		},
		requestHost: "mic.localhost:3000",
	} as never);

	render(<HomeContent />);

	expect(screen.getByRole("heading", { name: /MIC Investors Portal/i })).toBeInTheDocument();
	expect(screen.getByRole("link", { name: /Sign in/i })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /Request offering memorandum/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the landing-page test to verify it fails**

Run:

```bash
bun test src/test/routes/mic-landing-page.test.tsx
```

Expected:

```text
FAIL unable to find heading "MIC Investors Portal"
```

- [ ] **Step 3: Delegate the presentational slice to Kimi**

Use Kimi for these files only:

```text
/delegate-kimi Create the presentational React components for the MIC public landing page using the existing app visual language. Scope: src/components/mic/landing/MicLandingPage.tsx and src/components/mic/landing/MicRequestForm.tsx. Requirements: headline "MIC Investors Portal", sign-in CTA, public email capture form labeled "Request offering memorandum / prospectus", low-friction single-email form, success and error states, mobile-first layout, no backend wiring assumptions beyond props and mutation callbacks.
```

- [ ] **Step 4: Wire the MIC host branch and the public submission mutation**

Render the MIC landing page before the existing teaser-listings branch:

```tsx
// src/routes/index.tsx
function PortalHomeContent({
	portalContext,
}: {
	portalContext: ActivePortalContext;
}) {
	if (portalContext.portal.portalType === "mic") {
		return (
			<MicLandingPage
				portalId={String(portalContext.portal.portalId)}
				portalSlug={portalContext.portal.slug}
				signInHref="/sign-in?redirect=/portal"
			/>
		);
	}

	const teaserQuery = useQuery(
		publicPortalListingsQueryOptions(String(portalContext.portal.portalId), {
			numItems: portalContext.portal.teaserListingLimit,
		})
	);
```

Wire the form to the new mutation:

```tsx
// src/components/mic/landing/MicRequestForm.tsx
import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

export function MicRequestForm({ portalSlug }: { portalSlug: string }) {
	const submitRequest = useMutation(api.micInvestorAccess.mutations.submitRequest);
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		try {
			await submitRequest({ email, portalSlug });
			toast.success("Request received. We will follow up by email after review.");
			setEmail("");
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unable to submit request";
			toast.error(message);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className="flex w-full max-w-md gap-3" onSubmit={onSubmit}>
			<Input
				autoComplete="email"
				inputMode="email"
				onChange={(event) => setEmail(event.target.value)}
				placeholder="name@example.com"
				type="email"
				value={email}
			/>
			<Button disabled={isSubmitting} type="submit">
				Request offering memorandum
			</Button>
		</form>
	);
}
```

- [ ] **Step 5: Re-run the test and manually verify the public page**

Run:

```bash
bun test src/test/routes/mic-landing-page.test.tsx
vite dev
```

Expected:

```text
PASS
```

Manual verification:

```text
Open http://mic.localhost:3000 and verify the page is public, shows the sign-in CTA, accepts an email-only request, and does not show teaser listings.
```

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: add mic public landing flow"
```

## Task 4: Add Admin MIC Request Triage

**Files:**
- Create: `src/routes/admin/mic-investors.tsx`
- Create: `src/components/admin/mic-investors/AdminMicInvestorRequestsPage.tsx`
- Create: `convex/micInvestorAccess/queries.ts`
- Modify: `src/components/admin/shell/entity-registry.ts`
- Test: `src/test/admin/mic-investors-page.test.tsx`

- [ ] **Step 1: Write the failing admin triage page test**

```tsx
// src/test/admin/mic-investors-page.test.tsx
it("renders pending MIC access requests with approve and reject actions", () => {
	vi.mocked(useQuery).mockReturnValue([
		{
			_id: "mic_req_1",
			email: "investor@example.com",
			portalSlug: "mic",
			provisioningState: "pending",
			status: "pending_review",
		},
	] as never);

	render(<AdminMicInvestorRequestsPage />);

	expect(screen.getByText("investor@example.com")).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
	expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the admin triage test to verify it fails**

Run:

```bash
bun test src/test/admin/mic-investors-page.test.tsx
```

Expected:

```text
FAIL AdminMicInvestorRequestsPage is undefined
```

- [ ] **Step 3: Add the admin query, route, nav entry, and page shell**

Expose the admin list query:

```ts
// convex/micInvestorAccess/queries.ts
import { v } from "convex/values";
import { adminQuery } from "../fluent";
import { requirePermission } from "../fluent";

export const listRequests = adminQuery
	.use(requirePermission("admin:access"))
	.input({
		status: v.optional(v.union(
			v.literal("pending_review"),
			v.literal("approved"),
			v.literal("rejected")
		)),
	})
	.handler(async (ctx, args) => {
		const allRows = await ctx.db.query("micInvestorAccessRequests").collect();
		const rows = args.status
			? allRows.filter((row) => row.status === args.status)
			: allRows;

		return Promise.all(
			rows.map(async (row) => {
				const portal = await ctx.db.get(row.portalId);
				return {
					...row,
					portalSlug: portal?.slug ?? "unknown",
				};
			})
		);
	})
	.public();
```

Add the route and admin nav item:

```tsx
// src/routes/admin/mic-investors.tsx
import { createFileRoute } from "@tanstack/react-router";
import { AdminMicInvestorRequestsPage } from "#/components/admin/mic-investors/AdminMicInvestorRequestsPage";

export const Route = createFileRoute("/admin/mic-investors")({
	component: AdminMicInvestorRequestsPage,
});
```

```ts
// src/components/admin/shell/entity-registry.ts
{
	kind: "route",
	label: "MIC Investors",
	route: "/admin/mic-investors",
	domain: "system",
	iconName: "users",
},
```

Create the page shell:

```tsx
// src/components/admin/mic-investors/AdminMicInvestorRequestsPage.tsx
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";

export function AdminMicInvestorRequestsPage() {
	const requests = useQuery(api.micInvestorAccess.queries.listRequests, {
		status: "pending_review",
	});
	const approve = useMutation(api.micInvestorAccess.mutations.approveRequest);
	const reject = useMutation(api.micInvestorAccess.mutations.rejectRequest);

	if (!requests) {
		return <AdminPageSkeleton />;
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>MIC investor access requests</CardTitle>
				<CardDescription>Review public requests for the MIC portal.</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Portal</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{requests.map((request) => (
							<TableRow key={String(request._id)}>
								<TableCell>{request.email}</TableCell>
								<TableCell>{request.portalSlug}</TableCell>
								<TableCell>{request.status}</TableCell>
								<TableCell className="flex gap-2">
									<Button
										onClick={async () => {
											await approve({ requestId: request._id });
											toast.success("MIC access approved");
										}}
										size="sm"
									>
										Approve
									</Button>
									<Button
										onClick={async () => {
											await reject({
												rejectionReason: "Rejected by admin",
												requestId: request._id,
											});
											toast.success("MIC access rejected");
										}}
										size="sm"
										variant="outline"
									>
										Reject
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
```

- [ ] **Step 4: Re-run the admin triage test**

Run:

```bash
bun test src/test/admin/mic-investors-page.test.tsx
```

Expected:

```text
PASS
```

- [ ] **Step 5: Record the change**

```bash
gt modify -am "feat: add admin mic request triage"
```

## Task 5: Implement MIC Portfolio Query Contracts From Mortgage-Ledger Participation

**Files:**
- Create: `convex/micPortfolio/contracts.ts`
- Create: `convex/micPortfolio/helpers.ts`
- Create: `convex/micPortfolio/queries.ts`
- Modify: `convex/portals/middleware.ts`
- Modify: `convex/fluent.ts`
- Test: `convex/micPortfolio/__tests__/queries.test.ts`

- [ ] **Step 1: Write the failing MIC portfolio query tests**

```ts
// convex/micPortfolio/__tests__/queries.test.ts
it("builds the MIC dashboard from portal.lenderId instead of org ownership", async () => {
	const result = await micViewer.query(api.micPortfolio.queries.getMicPortfolioDashboard, {
		portalId,
	});
	expect(result.sourceOfTruth).toBe("mortgage-ledger lender participation");
	expect(result.positions.rows).toHaveLength(2);
	expect(result.focusRail.concentrationByBorrower.length).toBeGreaterThan(0);
});

it("fails closed when the MIC portal is missing lenderId", async () => {
	await t.run(async (ctx) => {
		await ctx.db.patch(portalId, { lenderId: undefined });
	});
	await expect(
		micViewer.query(api.micPortfolio.queries.getMicPortfolioDashboard, { portalId })
	).rejects.toThrow("MIC portal lender mapping is missing");
});

it("loads a full mortgage detail contract for the detail page", async () => {
	const detail = await micViewer.query(api.micPortfolio.queries.getMicMortgageDetail, {
		mortgageId,
		portalId,
	});
	expect(detail.mortgage.mortgageId).toBe(mortgageId);
	expect(detail.history.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the MIC portfolio tests to verify they fail**

Run:

```bash
bun test convex/micPortfolio/__tests__/queries.test.ts
```

Expected:

```text
FAIL api.micPortfolio.queries.getMicPortfolioDashboard is undefined
```

- [ ] **Step 3: Add MIC portal context resolution to the portal middleware and fluent builders**

Add the MIC context type and resolver:

```ts
// convex/portals/middleware.ts
export interface PortalMicContext extends PortalAccessContext {
	micLenderId: Id<"lenders">;
}

export async function resolvePortalMic(
	context: PortalAuthedBaseContext & PortalResolvedContext
): Promise<Id<"lenders">> {
	if (context.portal.portalType !== "mic" || !context.portal.lenderId) {
		throw new ConvexError("MIC portal lender mapping is missing");
	}
	return context.portal.lenderId;
}

export function withPortalMic<
	TContext extends PortalAuthedBaseContext,
	TArgs extends PortalArgs,
	TResult,
>(
	handler: (
		context: TContext & PortalMicContext,
		args: TArgs
	) => Promise<TResult>
) {
	return withPortalAccess<TContext, TArgs, TResult>(async (context, args) => {
		return handler(
			{
				...context,
				micLenderId: await resolvePortalMic(context),
			},
			args
		);
	});
}
```

Add the fluent wrappers:

```ts
// convex/fluent.ts
export function portalMicQuery<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = authedQuery.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"query",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalMicContext
	>(
		builder,
		withPortalMic as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalMicContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalMicMutation<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = authedMutation.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"mutation",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalMicContext
	>(
		builder,
		withPortalMic as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalMicContext,
			BuilderArgsOf<typeof builder>
		>
	);
}
```

- [ ] **Step 4: Implement the MIC dashboard, sidebar detail, and full-detail query contracts**

Define the contracts:

```ts
// convex/micPortfolio/contracts.ts
import { v } from "convex/values";

export const micPositionRowValidator = v.object({
	mortgageId: v.id("mortgages"),
	borrowerName: v.string(),
	city: v.string(),
	maturityDate: v.string(),
	mortgageStatus: v.string(),
	outstandingPrincipal: v.number(),
	propertyLabel: v.string(),
	weightedAverageRate: v.number(),
});

export const micPortfolioDashboardValidator = v.object({
	sourceOfTruth: v.string(),
	generatedAt: v.number(),
	cockpit: v.object({
		activePositionCount: v.number(),
		outstandingPrincipal: v.number(),
		weightedAverageLtv: v.number(),
		weightedAverageRate: v.number(),
	}),
	focusRail: v.object({
		concentrationByBorrower: v.array(v.object({
			borrowerName: v.string(),
			outstandingPrincipal: v.number(),
		})),
		delinquencyExposure: v.number(),
		maturityBuckets: v.array(v.object({
			label: v.string(),
			value: v.number(),
		})),
	}),
	positions: v.object({
		rows: v.array(micPositionRowValidator),
	}),
});
```

Build the helpers from lender participation instead of org ownership:

```ts
// convex/micPortfolio/helpers.ts
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export async function buildMicPortfolioDashboard(
	ctx: Pick<QueryCtx, "db">,
	micLenderId: Id<"lenders">
) {
	const lender = await ctx.db.get(micLenderId);
	if (!lender) {
		throw new ConvexError("MIC lender record not found");
	}

	const positions = await ctx.db
		.query("mortgageLedgerEntries")
		.withIndex("by_lender", (query) => query.eq("lenderId", micLenderId))
		.collect();

	return {
		sourceOfTruth: "mortgage-ledger lender participation",
		generatedAt: Date.now(),
		cockpit: {
			activePositionCount: positions.length,
			outstandingPrincipal: positions.reduce((sum, row) => sum + row.outstandingPrincipal, 0),
			weightedAverageLtv: deriveWeightedAverageLtv(positions),
			weightedAverageRate: deriveWeightedAverageRate(positions),
		},
		focusRail: {
			concentrationByBorrower: deriveBorrowerConcentration(positions),
			delinquencyExposure: deriveDelinquencyExposure(positions),
			maturityBuckets: deriveMaturityBuckets(positions),
		},
		positions: {
			rows: await Promise.all(positions.map((row) => toMicPositionRow(ctx, row))),
		},
	};
}
```

Expose the queries:

```ts
// convex/micPortfolio/queries.ts
import { v } from "convex/values";
import { portalMicQuery, requirePermission } from "../fluent";

export const getMicPortfolioDashboard = portalMicQuery()
	.use(requirePermission("mic:access"))
	.returns(micPortfolioDashboardValidator)
	.handler(async (ctx) => await buildMicPortfolioDashboard(ctx, ctx.micLenderId))
	.public();

export const getMicPositionDetail = portalMicQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("mic:access"))
	.handler(async (ctx, args) => await buildMicPositionDetail(ctx, ctx.micLenderId, args.mortgageId))
	.public();

export const getMicMortgageDetail = portalMicQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("mic:access"))
	.handler(async (ctx, args) => await buildMicMortgageDetail(ctx, ctx.micLenderId, args.mortgageId))
	.public();
```

- [ ] **Step 5: Re-run the MIC portfolio tests**

Run:

```bash
bun test convex/micPortfolio/__tests__/queries.test.ts
```

Expected:

```text
PASS
```

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: add mic portfolio query contracts"
```

## Task 6: Add The Authenticated MIC Portal Route, Sheet Drilldown, Full Detail Page, And Auth Completion Contract

**Files:**
- Create: `src/routes/portal.tsx`
- Create: `src/routes/portal.mortgages.$mortgageId.tsx`
- Create: `src/components/mic/portal/query-options.ts`
- Create: `src/components/mic/portal/mic-portal-types.ts`
- Create: `src/components/mic/portal/MicPortalPage.tsx`
- Create: `src/components/mic/portal/MicPositionSheet.tsx`
- Create: `src/components/mic/portal/MicMortgageDetailPage.tsx`
- Create: `src/test/routes/mic-portal-route.test.tsx`
- Modify: `src/test/routes/portal-auth-callback.test.tsx`

- [ ] **Step 1: Write the failing MIC portal route and auth-completion tests**

```tsx
// src/test/routes/mic-portal-route.test.tsx
it("guards /portal with mic:access", () => {
	expect(() =>
		Route.options.beforeLoad?.({
			context: {
				orgId: "org_mic",
				permissions: [],
				role: "member",
				roles: ["member"],
				token: "token",
				userId: "user_member",
			},
			location: { href: "/portal", pathname: "/portal" },
		} as never)
	).toThrow();
});

it("renders the MIC dashboard contract and opens the position detail host", () => {
	vi.mocked(useSuspenseQuery).mockReturnValue({ data: micPortfolioFixture } as never);
	render(<MicPortalRouteComponent />);
	expect(screen.getByRole("heading", { name: /MIC Portfolio/i })).toBeInTheDocument();
});

// src/test/routes/portal-auth-callback.test.tsx
it("redirects approved MIC investors to /portal on the MIC host when no explicit return path exists", () => {
	expect(
		resolveAuthCompletionDecision({
			authState: {
				version: 1,
				issuedAt: 1_000,
				returnPathname: "/",
				hasExplicitReturnPath: false,
				hostClass: "marketing",
				hostType: "local",
				requestedHost: "localhost:3000",
				canonicalHost: "localhost:3000",
			},
			currentPortalContext: {
				kind: "marketing",
				requestedHost: "localhost:3000",
				canonicalHost: "localhost:3000",
				cacheKey: "marketing:localhost:3000",
			},
			viewerAssignment: {
				userId: "user_mic",
				homePortalId: "portal_mic",
				homePortal: {
					portalId: "portal_mic",
					slug: "mic",
					portalType: "mic",
					productionHost: "mic.fairlend.ca",
					localHost: "mic.localhost:3000",
					status: "active",
					isPublished: true,
					defaultPostAuthPath: "/portal",
				},
				isFairLendAdmin: false,
			},
		})
	).toEqual({
		kind: "redirect",
		href: "http://mic.localhost:3000/portal",
	});
});
```

- [ ] **Step 2: Run the route and auth-completion tests to verify they fail**

Run:

```bash
bun test src/test/routes/mic-portal-route.test.tsx src/test/routes/portal-auth-callback.test.tsx
```

Expected:

```text
FAIL /portal route is undefined
FAIL MIC auth-completion redirect assertion does not match current behavior
```

- [ ] **Step 3: Delegate the presentational MIC portal components to Kimi**

Use Kimi for these files only:

```text
/delegate-kimi Create the MIC portal presentation layer using the existing lender portfolio visual language as the baseline. Scope: src/components/mic/portal/MicPortalPage.tsx, src/components/mic/portal/MicPositionSheet.tsx, src/components/mic/portal/MicMortgageDetailPage.tsx, src/components/mic/portal/mic-portal-types.ts. Requirements: read-only fund dashboard, top-line MIC stats, positions table, sheet or drawer detail host, clear CTA to open /portal/mortgages/$mortgageId, mobile-friendly behavior, no personalized holdings language, and no assumptions about cash-ledger treasury data.
```

- [ ] **Step 4: Add the route, query options, and full-detail page wiring**

Add the dashboard route:

```tsx
// src/routes/portal.tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { MicPortalPage } from "#/components/mic/portal/MicPortalPage";
import { micPortfolioDashboardQueryOptions } from "#/components/mic/portal/query-options";
import { guardPermission } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/portal")({
	beforeLoad: guardPermission("mic:access"),
	component: MicPortalRouteComponent,
	loader: async ({ context }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC portal requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			micPortfolioDashboardQueryOptions(portalId)
		);
	},
});

export function MicPortalRouteComponent() {
	return (
		<>
			<Authenticated>
				<MicPortalRouteContent />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}

function MicPortalRouteContent() {
	const navigate = useNavigate();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const { data } = useSuspenseQuery(micPortfolioDashboardQueryOptions(portalId));

	return (
		<MicPortalPage
			onOpenMortgageDetail={(mortgageId) =>
				void navigate({ to: "/portal/mortgages/$mortgageId", params: { mortgageId } })
			}
			portalId={portalId}
			snapshot={data}
		/>
	);
}
```

Add the query options and full-detail route:

```ts
// src/components/mic/portal/query-options.ts
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function micPortfolioDashboardQueryOptions(portalId: Id<"portals">) {
	return convexQuery(api.micPortfolio.queries.getMicPortfolioDashboard, { portalId });
}

export function micPositionDetailQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(api.micPortfolio.queries.getMicPositionDetail, {
		mortgageId: mortgageId as Id<"mortgages">,
		portalId,
	});
}

export function micMortgageDetailQueryOptions(
	portalId: Id<"portals">,
	mortgageId: string
) {
	return convexQuery(api.micPortfolio.queries.getMicMortgageDetail, {
		mortgageId: mortgageId as Id<"mortgages">,
		portalId,
	});
}
```

```tsx
// src/routes/portal.mortgages.$mortgageId.tsx
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { MicMortgageDetailPage } from "#/components/mic/portal/MicMortgageDetailPage";
import { micMortgageDetailQueryOptions } from "#/components/mic/portal/query-options";
import { guardPermission } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";

export const Route = createFileRoute("/portal/mortgages/$mortgageId")({
	beforeLoad: guardPermission("mic:access"),
	component: MicMortgageDetailRouteComponent,
	loader: async ({ context, params }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC mortgage detail requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			micMortgageDetailQueryOptions(portalId, params.mortgageId)
		);
	},
});

function MicMortgageDetailRouteComponent() {
	return (
		<>
			<Authenticated>
				<MicMortgageDetailRouteContent />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}

function MicMortgageDetailRouteContent() {
	const { mortgageId } = Route.useParams();
	const portalId = assertActivePortalId(Route.useRouteContext().portalContext, "MIC mortgage detail requires an active portal host.");
	const { data } = useSuspenseQuery(micMortgageDetailQueryOptions(portalId, mortgageId));
	return <MicMortgageDetailPage detail={data} />;
}
```

Wire the sheet CTA to the route:

```tsx
// src/components/mic/portal/MicPositionSheet.tsx
<Button asChild size="sm">
	<Link params={{ mortgageId }} to="/portal/mortgages/$mortgageId">
		Open full detail page
	</Link>
</Button>
```

- [ ] **Step 5: Re-run the route tests and manually verify the sheet-to-page drilldown**

Run:

```bash
bun test src/test/routes/mic-portal-route.test.tsx src/test/routes/portal-auth-callback.test.tsx
vite dev
```

Expected:

```text
PASS
```

Manual verification:

```text
Sign in as an approved MIC investor on http://mic.localhost:3000. Confirm that sign-in lands on /portal, the dashboard loads, clicking a position row opens the sheet or drawer, and clicking the CTA navigates to /portal/mortgages/<id>.
```

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: add mic portal routes and detail pages"
```

## Task 7: Run Full Verification And Capture The Final State

**Files:**
- Modify: `docs/superpowers/specs/2026-04-23-mic-investors-portal-design.md` only if the implementation revealed a real contract correction
- Test: `bunx convex codegen`
- Test: `bun check`
- Test: `bun typecheck`

- [ ] **Step 1: Run the targeted test suites**

Run:

```bash
bun test src/test/auth/permissions.ts src/test/routes/route-host-policy.test.ts convex/portals/__tests__/registry.test.ts src/test/convex/micInvestorAccess.test.ts convex/engine/machines/__tests__/micInvestorAccessRequest.machine.test.ts convex/micPortfolio/__tests__/queries.test.ts src/test/routes/mic-landing-page.test.tsx src/test/admin/mic-investors-page.test.tsx src/test/routes/mic-portal-route.test.tsx src/test/routes/portal-auth-callback.test.tsx
```

Expected:

```text
PASS
```

- [ ] **Step 2: Regenerate Convex bindings**

Run:

```bash
bunx convex codegen
```

Expected:

```text
Codegen completes without schema or function export errors
```

- [ ] **Step 3: Run repository validation**

Run:

```bash
bun check
bun typecheck
```

Expected:

```text
PASS
```

- [ ] **Step 4: Review the final diff scope**

Run:

```bash
gt status
git diff --stat
```

Expected:

```text
Only MIC portal, request workflow, admin triage, and supporting auth/portal files are changed
```

- [ ] **Step 5: Detect impacted symbols before submission**

Run:

```bash
npx gitnexus detect-changes
```

Expected:

```text
Changed symbols are limited to the MIC portal/auth/request/admin/query surface you intended to touch
```

- [ ] **Step 6: Record the final state and submit**

Run:

```bash
gt modify -am "feat: finish mic investor portal"
gt sync
gt submit --no-interactive
```

Expected:

```text
Graphite syncs successfully and opens or updates the stack for review
```
