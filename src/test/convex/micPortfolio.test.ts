import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import schema from "../../../convex/schema";
import { convexModules } from "../../../convex/test/moduleMaps";
import {
	createMockViewer,
	seedFromIdentity,
} from "#/test/auth/helpers";
import { FAIRLEND_ADMIN } from "#/test/auth/identities";

const modules = convexModules;
const FIXTURE_TIME = 1_710_000_900_000;
const SYS_SOURCE = { channel: "test", type: "system" as const };

const MIC_INVESTOR = createMockViewer({
	email: "investor@fairlendmic.ca",
	firstName: "Mic",
	lastName: "Investor",
	orgId: "org_fairlend_mic",
	orgName: "FairLend MIC",
	roles: ["micinvestor"],
	subject: "user_mic_investor_test",
});

function createHarness() {
	return convexTest(schema, modules);
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
	mortgageId: string
) {
	return await admin.mutation(api.ledger.mutations.mintMortgage, {
		effectiveDate: "2026-01-01",
		idempotencyKey: `mint-${mortgageId}`,
		mortgageId,
		source: SYS_SOURCE,
	});
}

async function issueShares(
	admin: ReturnType<ReturnType<typeof createHarness>["withIdentity"]>,
	mortgageId: string,
	lenderAuthId: string
) {
	return await admin.mutation(internal.ledger.mutations.issueShares, {
		amount: 10_000,
		effectiveDate: "2026-01-01",
		idempotencyKey: `issue-${mortgageId}-${lenderAuthId}`,
		lenderId: lenderAuthId,
		mortgageId,
		source: SYS_SOURCE,
	});
}

async function createMicPortfolioFixture(t: ReturnType<typeof createHarness>) {
	await seedFromIdentity(t, MIC_INVESTOR);

	return await t.run(async (ctx) => {
		const micInvestorUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) =>
				query.eq("authId", MIC_INVESTOR.subject)
			)
			.unique();
		if (!micInvestorUser) {
			throw new Error("Expected MIC investor user");
		}

		const micLenderUserId = await ctx.db.insert("users", {
			authId: "user_mic_lender_operator",
			email: "ops@fairlendmic.ca",
			firstName: "FairLend",
			lastName: "MIC",
		});
		const brokerUserId = await ctx.db.insert("users", {
			authId: "user_mic_broker",
			email: "broker@fairlendmic.ca",
			firstName: "Morgan",
			lastName: "Broker",
		});

		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "MIC Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: MIC_INVESTOR.org_id,
			status: "active",
			userId: brokerUserId,
		});
		const micLenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "exempt",
			brokerId,
			createdAt: FIXTURE_TIME,
			onboardingEntryPath: "admin_seed",
			orgId: MIC_INVESTOR.org_id,
			status: "active",
			userId: micLenderUserId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: FIXTURE_TIME,
			defaultPostAuthPath: "/portal",
			isPublished: true,
			landingPageId: undefined,
			lenderId: micLenderId,
			localHost: "mic.localhost:3000",
			orgId: MIC_INVESTOR.org_id ?? "org_fairlend_mic",
			portalType: "mic",
			pricingPolicyId: undefined,
			productionHost: "mic.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "fairlend-mic",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: FIXTURE_TIME,
		});
		await ctx.db.patch(micInvestorUser._id, {
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
			interestRate: 8.5,
			isRenewal: undefined,
			lastTransitionAt: undefined,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: undefined,
			maturityDate: "2027-01-01",
			orgId: MIC_INVESTOR.org_id,
			paymentAmount: 1250,
			paymentFrequency: "monthly",
			principal: 250_000,
			priorMortgageId: undefined,
			propertyId,
			rateType: "fixed",
			simulationId: undefined,
			status: "active",
			termMonths: 12,
			termStartDate: "2026-01-01",
		});

		const micLenderUser = await ctx.db.get(micLenderUserId);
		if (!micLenderUser?.authId) {
			throw new Error("Expected MIC lender auth id");
		}

		return {
			micLenderAuthId: micLenderUser.authId,
			mortgageId,
			portalId,
		};
	});
}

describe("mic portfolio queries", () => {
	it("derives the MIC portfolio from the portal-mapped lender", async () => {
		const t = createHarness();
		await seedFromIdentity(t, FAIRLEND_ADMIN);
		const admin = t.withIdentity(FAIRLEND_ADMIN);
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const fixture = await createMicPortfolioFixture(t);

		await initializeLedger(admin);
		await mintMortgage(admin, String(fixture.mortgageId));
		await issueShares(
			admin,
			String(fixture.mortgageId),
			fixture.micLenderAuthId
		);

		const commandCenter = await micInvestor.query(
			api.micPortfolio.queries.getMicPortfolioCommandCenter,
			{
				portalId: fixture.portalId,
			}
		);
		expect(commandCenter.positions.rows).toHaveLength(1);
		expect(commandCenter.positions.rows[0]?.mortgageId).toBe(
			String(fixture.mortgageId)
		);
		expect(commandCenter.positions.rows[0]?.propertyLabel).toContain(
			"123 King St W"
		);

		const detail = await micInvestor.query(
			api.micPortfolio.queries.getMicPortfolioMortgageDetailPage,
			{
				mortgageId: fixture.mortgageId as Id<"mortgages">,
				portalId: fixture.portalId,
			}
		);
		expect(detail.positionDetail.mortgage.mortgageId).toBe(
			String(fixture.mortgageId)
		);
		expect(detail.sourceOfTruth.cockpitMetrics).toContain("ledger");
	});

	it("fails closed when the MIC portal is missing a lender mapping", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		await seedFromIdentity(t, MIC_INVESTOR);

		const portalId = await t.run(async (ctx) => {
			const viewerUser = await ctx.db
				.query("users")
				.withIndex("authId", (query) =>
					query.eq("authId", MIC_INVESTOR.subject)
				)
				.unique();
			if (!viewerUser) {
				throw new Error("Expected viewer user");
			}

			const brokerUserId = await ctx.db.insert("users", {
				authId: "user_missing_mic_broker",
				email: "missing-broker@fairlendmic.ca",
				firstName: "Missing",
				lastName: "Broker",
			});
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: FIXTURE_TIME,
				orgId: MIC_INVESTOR.org_id,
				status: "active",
				userId: brokerUserId,
			});
			const insertedPortalId = await ctx.db.insert("portals", {
				brokerId,
				createdAt: FIXTURE_TIME,
				defaultPostAuthPath: "/portal",
				isPublished: true,
				landingPageId: undefined,
				lenderId: undefined,
				localHost: "missing-mic.localhost:3000",
				orgId: MIC_INVESTOR.org_id ?? "org_fairlend_mic",
				portalType: "mic",
				pricingPolicyId: undefined,
				productionHost: "missing-mic.fairlend.ca",
				publicTeaserEnabled: true,
				slug: "missing-mic",
				status: "active",
				teaserListingLimit: 12,
				updatedAt: FIXTURE_TIME,
			});
			await ctx.db.patch(viewerUser._id, {
				homePortalId: insertedPortalId,
			});
			return insertedPortalId;
		});

		await expect(
			micInvestor.query(api.micPortfolio.queries.getMicPortfolioCommandCenter, {
				portalId,
			})
		).rejects.toThrow("MIC portal is missing a lender mapping");
	});
});
