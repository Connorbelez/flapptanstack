import { convexTest } from "convex-test";
import { seedFromIdentity } from "../auth/helpers";
import { FAIRLEND_ADMIN, LENDER } from "../auth/identities";
import { api, internal } from "../../../convex/_generated/api";
import schema from "../../../convex/schema";
import { convexModules } from "../../../convex/test/moduleMaps";

export const FIXTURE_TIME = Date.UTC(2026, 0, 15, 12, 0, 0);

const SYS_SOURCE = { type: "system" as const, channel: "test" };

export function createHarness() {
	return convexTest(schema, convexModules);
}

async function initializeLedger(
	admin: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>
) {
	await admin.mutation(
		api.ledger.sequenceCounter.initializeSequenceCounter,
		{}
	);
}

async function mintMortgage(
	admin: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
	mortgageId: string,
	idempotencyKey: string
) {
	return await admin.mutation(api.ledger.mutations.mintMortgage, {
		effectiveDate: "2026-01-01",
		idempotencyKey,
		mortgageId,
		source: SYS_SOURCE,
	});
}

async function issueShares(
	admin: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
	mortgageId: string,
	lenderId: string,
	amount: number,
	idempotencyKey: string
) {
	return await admin.mutation(internal.ledger.mutations.issueShares, {
		amount,
		effectiveDate: "2026-01-01",
		idempotencyKey,
		lenderId,
		mortgageId,
		source: SYS_SOURCE,
	});
}

async function redeemShares(
	admin: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
	mortgageId: string,
	lenderId: string,
	amount: number,
	effectiveDate: string,
	idempotencyKey: string
) {
	return await admin.mutation(internal.ledger.mutations.redeemSharesInternal, {
		amount,
		effectiveDate,
		idempotencyKey,
		lenderId,
		mortgageId,
		source: SYS_SOURCE,
	});
}

export async function createPortfolioFixture(
	t: ReturnType<typeof createHarness>,
	options?: {
		exitDate?: string;
		issueAmount?: number;
	}
) {
	await seedFromIdentity(t, LENDER);

	const ids = await t.run(async (ctx) => {
		const lenderUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", LENDER.subject))
			.unique();
		if (!(lenderUser && LENDER.org_id)) {
			throw new Error("Expected seeded lender identity");
		}

		const brokerUserId = await ctx.db.insert("users", {
			authId: "portfolio_snapshot_broker",
			email: "broker@fairlend.ca",
			firstName: "Morgan",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "Meridian Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: LENDER.org_id,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: FIXTURE_TIME,
			onboardingEntryPath: "self_signup",
			orgId: LENDER.org_id,
			status: "active",
			userId: lenderUser._id,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: FIXTURE_TIME,
			defaultPostAuthPath: "/lender/portfolio",
			isPublished: true,
			landingPageId: undefined,
			localHost: "portfolio.localhost:3000",
			orgId: LENDER.org_id,
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "portfolio.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "portfolio",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: FIXTURE_TIME,
		});
		const pricingPolicyId = await ctx.db.insert("portalPricingPolicies", {
			brokerSplitPercent: 12.5,
			createdAt: FIXTURE_TIME,
			effectiveFrom: FIXTURE_TIME - 1000,
			effectiveTo: undefined,
			portalId,
			status: "active",
			updatedAt: FIXTURE_TIME,
		});
		await ctx.db.patch(portalId, {
			pricingPolicyId,
			updatedAt: FIXTURE_TIME,
		});
		await ctx.db.patch(lenderUser._id, {
			homePortalId: portalId,
		});

		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: FIXTURE_TIME,
			postalCode: "M5V1E3",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: brokerId,
			brokerOfRecordId: brokerId,
			createdAt: FIXTURE_TIME,
			firstPaymentDate: "2026-02-01",
			fundedAt: undefined,
			interestAdjustmentDate: "2026-01-01",
			interestRate: 12,
			isRenewal: undefined,
			lastTransitionAt: undefined,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: undefined,
			maturityDate: "2027-12-31",
			orgId: LENDER.org_id,
			paymentAmount: 1000,
			paymentFrequency: "monthly",
			principal: 120_000,
			priorMortgageId: undefined,
			propertyId,
			rateType: "fixed",
			simulationId: undefined,
			status: "active",
			termMonths: 24,
			termStartDate: "2026-01-01",
		});

		return { lenderId, mortgageId, portalId };
	});

	const admin = t.withIdentity(FAIRLEND_ADMIN);
	await initializeLedger(admin);
	await mintMortgage(admin, String(ids.mortgageId), "portfolio-fixture-mint");

	const issueAmount = options?.issueAmount ?? 10_000;
	if (issueAmount > 0) {
		await issueShares(
			admin,
			String(ids.mortgageId),
			LENDER.subject,
			issueAmount,
			"portfolio-fixture-issue"
		);
	}
	if (issueAmount > 0 && options?.exitDate) {
		await redeemShares(
			admin,
			String(ids.mortgageId),
			LENDER.subject,
			issueAmount,
			options.exitDate,
			"portfolio-fixture-redeem"
		);
	}

	return ids;
}
