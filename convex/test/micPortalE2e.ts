import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery, requirePermission } from "../fluent";
import { micPortalFields } from "../portals/helpers";

const MIC_PORTAL_E2E_ENABLED_ENV = "MIC_PORTAL_E2E_ENABLED";
const ORIGINATION_E2E_ENABLED_ENV = "ORIGINATION_E2E_ENABLED";
const MIC_E2E_ORG_ID = "org_mic_e2e";
const MIC_E2E_SLUG = "mic";
const MIC_E2E_BROKER_AUTH_ID = "mic_e2e_broker_workos";
const MIC_E2E_LENDER_AUTH_ID = "mic_e2e_lender_workos";
const MIC_E2E_BORROWER_AUTH_ID = "mic_e2e_borrower_workos";

function assertMicPortalE2eEnabled() {
	if (
		process.env.MIC_PORTAL_E2E_ENABLED !== "true" &&
		process.env.ORIGINATION_E2E_ENABLED !== "true"
	) {
		throw new ConvexError(
			`MIC portal E2E helpers are disabled. Set ${MIC_PORTAL_E2E_ENABLED_ENV}=true or ${ORIGINATION_E2E_ENABLED_ENV}=true to enable them.`
		);
	}
}

async function ensureUserByAuthId(
	ctx: MutationCtx,
	args: {
		authId: string;
		email: string;
		firstName: string;
		lastName: string;
	}
) {
	const existing = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", args.authId))
		.unique();
	if (existing) {
		return existing._id;
	}

	return await ctx.db.insert("users", args);
}

async function ensureActiveBroker(ctx: MutationCtx, userId: Id<"users">) {
	const existing = await ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.unique();
	if (existing) {
		return existing._id;
	}

	const now = Date.now();
	return await ctx.db.insert("brokers", {
		brokerageName: "FairLend MIC E2E Brokerage",
		createdAt: now,
		lastTransitionAt: now,
		onboardedAt: now,
		orgId: MIC_E2E_ORG_ID,
		status: "active",
		userId,
	});
}

async function ensureActiveLender(
	ctx: MutationCtx,
	args: {
		brokerId: Id<"brokers">;
		userId: Id<"users">;
	}
) {
	const existing = await ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", args.userId))
		.unique();
	if (existing) {
		return existing._id;
	}

	const now = Date.now();
	return await ctx.db.insert("lenders", {
		accreditationStatus: "exempt",
		activatedAt: now,
		brokerId: args.brokerId,
		createdAt: now,
		onboardingEntryPath: "admin_invite",
		orgId: MIC_E2E_ORG_ID,
		status: "active",
		userId: args.userId,
	});
}

async function ensureMicPortal(
	ctx: MutationCtx,
	args: {
		lenderId: Id<"lenders">;
		localHost: string;
		productionHost: string;
	}
) {
	const now = Date.now();
	const fields = {
		...micPortalFields({
			lenderId: args.lenderId,
			now,
			orgId: MIC_E2E_ORG_ID,
			slug: MIC_E2E_SLUG,
		}),
		localHost: args.localHost,
		productionHost: args.productionHost,
	};
	const localHostMatches = await ctx.db
		.query("portals")
		.withIndex("by_local_host", (query) =>
			query.eq("localHost", args.localHost)
		)
		.collect();
	const slugMatches = await ctx.db
		.query("portals")
		.withIndex("by_slug", (query) => query.eq("slug", MIC_E2E_SLUG))
		.collect();
	const existing = slugMatches[0] ?? localHostMatches[0];

	for (const stalePortal of [...localHostMatches, ...slugMatches]) {
		if (!existing || stalePortal._id === existing._id) {
			continue;
		}

		const staleSuffix = String(stalePortal._id).replace(/[^a-z0-9-]/gi, "-");
		await ctx.db.patch(stalePortal._id, {
			localHost: `stale-${staleSuffix}.localhost`,
			productionHost: `stale-${staleSuffix}.fairlend.test`,
			slug: `stale-${staleSuffix}`,
			status: "archived",
			updatedAt: now,
		});
	}

	if (existing) {
		await ctx.db.patch(existing._id, {
			...fields,
			createdAt: existing.createdAt,
			updatedAt: now,
		});
		return existing._id;
	}

	return await ctx.db.insert("portals", fields);
}

async function findRequestByEmail(
	ctx: Pick<QueryCtx, "db">,
	portalId: Id<"portals">,
	normalizedEmail: string
) {
	return await ctx.db
		.query("micInvestorAccessRequests")
		.withIndex("by_portal_normalized_email", (query) =>
			query.eq("portalId", portalId).eq("normalizedEmail", normalizedEmail)
		)
		.first();
}

export const bootstrapMicPortalScenario = adminMutation
	.use(requirePermission("admin:access"))
	.input({
		localHost: v.string(),
		productionHost: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		assertMicPortalE2eEnabled();

		const now = Date.now();
		const brokerUserId = await ensureUserByAuthId(ctx, {
			authId: MIC_E2E_BROKER_AUTH_ID,
			email: "mic-e2e-broker@fairlend.test",
			firstName: "MIC",
			lastName: "Broker",
		});
		const brokerId = await ensureActiveBroker(ctx, brokerUserId);
		const lenderUserId = await ensureUserByAuthId(ctx, {
			authId: MIC_E2E_LENDER_AUTH_ID,
			email: "mic-e2e-lender@fairlend.test",
			firstName: "FairLend",
			lastName: "MIC",
		});
		const lenderId = await ensureActiveLender(ctx, {
			brokerId,
			userId: lenderUserId,
		});
		const portalId = await ensureMicPortal(ctx, {
			lenderId,
			localHost: args.localHost,
			productionHost: args.productionHost ?? "mic-e2e.fairlend.test",
		});
		const borrowerUserId = await ensureUserByAuthId(ctx, {
			authId: MIC_E2E_BORROWER_AUTH_ID,
			email: "mic-e2e-borrower@fairlend.test",
			firstName: "Avery",
			lastName: "Borrower",
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			createdAt: now,
			creationSource: "e2e_seed",
			lastTransitionAt: now,
			onboardedAt: now,
			orgId: MIC_E2E_ORG_ID,
			portalId,
			status: "active",
			userId: borrowerUserId,
		});
		const propertyLabel = `718 E2E MIC Way ${now}`;
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 2T6",
			propertyType: "residential",
			province: "ON",
			streetAddress: propertyLabel,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: brokerId,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-05-01",
			fundedAt: now,
			interestAdjustmentDate: "2026-04-01",
			interestRate: 11.75,
			isRenewal: undefined,
			lastTransitionAt: now,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: undefined,
			maturityDate: "2028-04-01",
			orgId: MIC_E2E_ORG_ID,
			paymentAmount: 4250,
			paymentFrequency: "monthly",
			principal: 850_000,
			priorMortgageId: undefined,
			propertyId,
			rateType: "fixed",
			simulationId: "mic-portal-e2e",
			status: "active",
			termMonths: 24,
			termStartDate: "2026-04-01",
		});
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: now,
			borrowerId,
			mortgageId,
			role: "primary",
		});
		await ctx.db.insert("ledger_accounts", {
			createdAt: now,
			cumulativeCredits: 0n,
			cumulativeDebits: 25_000n,
			lenderId: MIC_E2E_LENDER_AUTH_ID,
			metadata: { source: "mic_portal_e2e" },
			mortgageId: String(mortgageId),
			type: "POSITION",
		});
		await ctx.db.insert("obligations", {
			amount: 4250,
			amountSettled: 0,
			borrowerId,
			createdAt: now,
			dueDate: Date.UTC(2026, 4, 1),
			gracePeriodEnd: Date.UTC(2026, 4, 8),
			lastTransitionAt: now,
			machineContext: undefined,
			mortgageId,
			orgId: MIC_E2E_ORG_ID,
			paymentNumber: 1,
			status: "due",
			type: "regular_interest",
		});

		return {
			mortgageId,
			portalId,
			propertyLabel,
			slug: MIC_E2E_SLUG,
		};
	})
	.public();

export const getRequestByEmail = adminQuery
	.use(requirePermission("admin:access"))
	.input({
		email: v.string(),
		portalId: v.id("portals"),
	})
	.handler(async (ctx, args) => {
		assertMicPortalE2eEnabled();
		return await findRequestByEmail(
			ctx,
			args.portalId,
			args.email.trim().toLowerCase()
		);
	})
	.public();
