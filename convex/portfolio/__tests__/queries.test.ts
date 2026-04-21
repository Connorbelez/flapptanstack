import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { seedFromIdentity } from "../../../src/test/auth/helpers";
import {
	FAIRLEND_ADMIN,
	LENDER,
	MEMBER,
} from "../../../src/test/auth/identities";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { deriveMarketplacePropertyType } from "../../listings/marketplaceShared";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const modules = convexModules;
const portfolioApi = anyApi.portfolio.queries;

const SYS_SOURCE = { type: "system" as const, channel: "test" };
const FIXTURE_TIME = 1_710_000_500_000;

function createHarness() {
	return convexTest(schema, modules);
}

function buildListingDoc(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">> = {}
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
	const propertyType = overrides.propertyType ?? "residential";
	const marketplacePropertyType =
		overrides.marketplacePropertyType ??
		deriveMarketplacePropertyType(propertyType);

	return {
		adminNotes: undefined,
		approximateLatitude: 43.6532,
		approximateLongitude: -79.3832,
		borrowerSignal: undefined,
		city: "Toronto",
		createdAt: FIXTURE_TIME,
		dataSource: "mortgage_pipeline",
		delistReason: undefined,
		delistedAt: undefined,
		description: "Portfolio listing fixture",
		displayOrder: undefined,
		featured: false,
		heroImages: [],
		interestRate: 8.5,
		lastTransitionAt: undefined,
		lienPosition: 1,
		loanType: "conventional",
		ltvRatio: 0.65,
		machineContext: undefined,
		marketplaceCopy: "Fixture marketplace copy",
		maturityDate: "2027-01-01",
		monthlyPayment: 1250,
		mortgageId: undefined,
		paymentFrequency: "monthly",
		paymentHistory: undefined,
		principal: 250_000,
		propertyId: undefined,
		propertyType,
		marketplacePropertyType,
		province: "ON",
		publicDocumentIds: [],
		publishedAt: FIXTURE_TIME,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 12,
		title: "Fixture Listing",
		updatedAt: FIXTURE_TIME,
		viewCount: 0,
		...overrides,
	};
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

async function createPortfolioFixture(t: ReturnType<typeof createHarness>) {
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
			authId: "user_portfolio_broker",
			email: "broker@fairlend.ca",
			firstName: "Morgan",
			lastName: "Broker",
			phoneNumber: "416-555-0100",
		});
		const otherBrokerUserId = await ctx.db.insert("users", {
			authId: "user_other_portfolio_broker",
			email: "other-broker@fairlend.ca",
			firstName: "Jordan",
			lastName: "Broker",
		});
		const borrowerUserId = await ctx.db.insert("users", {
			authId: "user_portfolio_borrower",
			email: "borrower@fairlend.ca",
			firstName: "Bailey",
			lastName: "Borrower",
		});

		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "Meridian Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: LENDER.org_id,
			status: "active",
			userId: brokerUserId,
		});
		const otherBrokerId = await ctx.db.insert("brokers", {
			brokerageName: "Other Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: LENDER.org_id,
			status: "active",
			userId: otherBrokerUserId,
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
			localHost: "meridian.localhost:3000",
			orgId: LENDER.org_id,
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "meridian.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "meridian",
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
		const otherPortalId = await ctx.db.insert("portals", {
			brokerId: otherBrokerId,
			createdAt: FIXTURE_TIME,
			defaultPostAuthPath: "/lender/portfolio",
			isPublished: true,
			landingPageId: undefined,
			localHost: "other.localhost:3000",
			orgId: LENDER.org_id,
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "other.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "other-meridian",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: FIXTURE_TIME,
		});
		const otherPricingPolicyId = await ctx.db.insert("portalPricingPolicies", {
			brokerSplitPercent: 10,
			createdAt: FIXTURE_TIME,
			effectiveFrom: FIXTURE_TIME - 1000,
			effectiveTo: undefined,
			portalId: otherPortalId,
			status: "active",
			updatedAt: FIXTURE_TIME,
		});
		await ctx.db.patch(otherPortalId, {
			pricingPolicyId: otherPricingPolicyId,
			updatedAt: FIXTURE_TIME,
		});

		const borrowerId = await ctx.db.insert("borrowers", {
			createdAt: FIXTURE_TIME,
			lastTransitionAt: undefined,
			orgId: LENDER.org_id,
			portalId,
			status: "active",
			userId: borrowerUserId,
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
			orgId: LENDER.org_id,
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

		const ownedListingId = await ctx.db.insert(
			"listings",
			buildListingDoc({
				mortgageId,
				propertyId,
				publishedAt: FIXTURE_TIME + 10,
				title: "Owned Mortgage Listing",
			})
		);
		const suggestionListingId = await ctx.db.insert(
			"listings",
			buildListingDoc({
				interestRate: 9.1,
				ltvRatio: 0.6,
				maturityDate: "2027-09-01",
				principal: 300_000,
				publishedAt: FIXTURE_TIME + 20,
				title: "Fresh Opportunity",
			})
		);
		const secondSuggestionListingId = await ctx.db.insert(
			"listings",
			buildListingDoc({
				interestRate: 8.9,
				ltvRatio: 0.58,
				maturityDate: "2027-06-01",
				principal: 280_000,
				publishedAt: FIXTURE_TIME + 15,
				title: "Second Opportunity",
			})
		);

		await ctx.db.insert("lenderFilterConstraints", {
			allowedMortgageTypes: ["First"],
			allowedPropertyTypes: ["Detached Home"],
			brokerId,
			createdAt: FIXTURE_TIME,
			interestRateRange: undefined,
			lastUpdatedBy: "test",
			lenderId,
			loanAmountRange: { max: 350_000, min: 200_000 },
			ltvRange: { max: 0.7, min: 0.5 },
			maturityDateMax: "2027-12-31",
			setByOnboardingId: undefined,
			updatedAt: FIXTURE_TIME,
		});

		const overdueObligationId = await ctx.db.insert("obligations", {
			amount: 125_000,
			amountSettled: 0,
			borrowerId,
			createdAt: FIXTURE_TIME + 100,
			dueDate: Date.UTC(2026, 1, 1),
			feeCode: undefined,
			gracePeriodEnd: Date.UTC(2026, 1, 5),
			lastTransitionAt: undefined,
			machineContext: undefined,
			mortgageFeeId: undefined,
			mortgageId,
			orgId: LENDER.org_id,
			paymentNumber: 1,
			postingGroupId: undefined,
			settledAt: undefined,
			sourceObligationId: undefined,
			status: "overdue",
			type: "regular_interest",
		});
		const upcomingObligationId = await ctx.db.insert("obligations", {
			amount: 125_000,
			amountSettled: 0,
			borrowerId,
			createdAt: FIXTURE_TIME + 200,
			dueDate: Date.UTC(2026, 2, 1),
			feeCode: undefined,
			gracePeriodEnd: Date.UTC(2026, 2, 5),
			lastTransitionAt: undefined,
			machineContext: undefined,
			mortgageFeeId: undefined,
			mortgageId,
			orgId: LENDER.org_id,
			paymentNumber: 2,
			postingGroupId: undefined,
			settledAt: undefined,
			sourceObligationId: undefined,
			status: "upcoming",
			type: "regular_interest",
		});
		const planEntryId = await ctx.db.insert("collectionPlanEntries", {
			amount: 125_000,
			collectionAttemptId: undefined,
			createdAt: FIXTURE_TIME + 220,
			method: "mock_pad",
			mortgageId,
			obligationIds: [overdueObligationId],
			scheduledDate: Date.UTC(2026, 1, 1),
			source: "admin",
			status: "completed",
		});
		await ctx.db.insert("collectionAttempts", {
			amount: 125_000,
			cancelledAt: undefined,
			confirmedAt: undefined,
			executionIdempotencyKey: undefined,
			executionReason: undefined,
			executionRequestedAt: undefined,
			failedAt: FIXTURE_TIME + 260,
			failureReason: "NSF",
			initiatedAt: FIXTURE_TIME + 240,
			lastTransitionAt: FIXTURE_TIME + 260,
			machineContext: undefined,
			method: "mock_pad",
			mortgageId,
			obligationIds: [overdueObligationId],
			planEntryId,
			providerLastReportedAt: undefined,
			providerLastReportedVia: undefined,
			providerLifecycleReason: undefined,
			providerLifecycleStatus: undefined,
			providerOccurrenceKey: undefined,
			requestedByActorId: undefined,
			requestedByActorType: undefined,
			reversedAt: undefined,
			settledAt: undefined,
			status: "failed",
			transferRequestId: undefined,
			triggerSource: "admin_manual",
		});

		await ctx.db.insert("deals", {
			buyerId: "buyer-1",
			closingDate: Date.UTC(2026, 2, 15),
			createdAt: FIXTURE_TIME + 300,
			createdBy: "test",
			fractionalShare: 10,
			lastTransitionAt: undefined,
			lawyerId: undefined,
			lawyerType: undefined,
			lenderId,
			lockingFeeAmount: undefined,
			machineContext: undefined,
			mortgageId,
			orgId: LENDER.org_id,
			reservationId: undefined,
			sellerId: "seller-1",
			status: "pending_documents",
		});

		await ctx.db.insert("lenderRenewalIntents", {
			borrowerRenewalIntentId: undefined,
			brokerAcknowledgedAt: undefined,
			brokerId,
			brokerNotes: undefined,
			createdAt: FIXTURE_TIME + 400,
			fractionCount: 6000,
			intent: "renew",
			lastTransitionAt: undefined,
			lenderId,
			machineContext: undefined,
			maturityDate: Date.UTC(2027, 0, 1),
			mortgageId,
			notes: undefined,
			partialExitFractions: undefined,
			positionAccountId: "position-account-fixture",
			signalDeadline: Date.UTC(2026, 11, 15),
			signalledAt: undefined,
			status: "pending_signal",
		});

		return {
			lenderId,
			mortgageId,
			overdueObligationId,
			ownedListingId,
			otherPortalId,
			portalId,
			secondSuggestionListingId,
			suggestionListingId,
			upcomingObligationId,
		};
	});

	const admin = t.withIdentity(FAIRLEND_ADMIN);
	await initializeLedger(admin);
	await mintMortgage(admin, String(ids.mortgageId), "portfolio-fixture-mint");
	await issueShares(
		admin,
		String(ids.mortgageId),
		LENDER.subject,
		6000,
		"portfolio-fixture-issue"
	);

	return ids;
}

async function createEmptyPortfolioFixture(
	t: ReturnType<typeof createHarness>
) {
	await seedFromIdentity(t, LENDER);

	return await t.run(async (ctx) => {
		const lenderUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", LENDER.subject))
			.unique();
		if (!(lenderUser && LENDER.org_id)) {
			throw new Error("Expected seeded lender identity");
		}

		const brokerUserId = await ctx.db.insert("users", {
			authId: "user_empty_portfolio_broker",
			email: "empty-broker@fairlend.ca",
			firstName: "Taylor",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "Empty State Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: LENDER.org_id,
			status: "active",
			userId: brokerUserId,
		});
		await ctx.db.insert("lenders", {
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
			localHost: "empty.localhost:3000",
			orgId: LENDER.org_id,
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "empty.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "empty-meridian",
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

		return { portalId };
	});
}

describe("portfolio portal queries", () => {
	it("returns empty-state-safe command center sections when the lender has no active positions", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const { portalId } = await createEmptyPortfolioFixture(t);

		const result = await lender.query(
			portfolioApi.getLenderPortfolioCommandCenter,
			{
				portalId,
			}
		);

		expect(result.cockpit.metrics.activePositionCount).toBe(0);
		expect(result.actionsRequired).toEqual({ allClear: true, items: [] });
		expect(result.positions.rows).toEqual([]);
		expect(result.paymentActivity.rows).toEqual([]);
		expect(result.suggestedOpportunities.rows).toEqual([]);
		expect(result.emptyStates).toEqual({
			hasActions: false,
			hasPayments: false,
			hasPositions: false,
			hasSuggestions: false,
		});
	});

	it("builds the lender command center from positions, obligations, and constrained suggestions", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const {
			mortgageId,
			overdueObligationId,
			portalId,
			secondSuggestionListingId,
			suggestionListingId,
			upcomingObligationId,
		} = await createPortfolioFixture(t);

		const result = await lender.query(
			portfolioApi.getLenderPortfolioCommandCenter,
			{
				portalId,
			}
		);

		expect(result.cockpit.metrics.activePositionCount).toBe(1);
		expect(result.positions.rows).toHaveLength(1);
		expect(result.positions.rows[0]).toMatchObject({
			fractionCount: 6,
			mortgageId: String(mortgageId),
			positionPercent: 60,
			propertyLabel: "123 King St W, Toronto",
			renewalIntentStatus: "pending_signal",
		});
		expect(
			result.paymentActivity.rows.map((row) => row.obligationId).sort()
		).toEqual(
			[String(overdueObligationId), String(upcomingObligationId)].sort()
		);
		expect(result.actionsRequired.items.map((item) => item.kind)).toEqual(
			expect.arrayContaining([
				"payment_exception",
				"renewal_prompt",
				"deal_action",
			])
		);
		expect(result.limitsStrip).toMatchObject({
			hasConstraints: true,
			suggestionSeedCount: 2,
			constraints: {
				allowedMortgageTypes: ["First"],
				allowedPropertyTypes: ["Detached Home"],
			},
		});
		expect(result.suggestedOpportunities.excludedOwnedMortgageCount).toBe(1);
		expect(
			result.suggestedOpportunities.rows.map((row) => row.listingId)
		).toEqual([String(suggestionListingId), String(secondSuggestionListingId)]);
		expect(result.suggestedOpportunities.rows[0]).toMatchObject({
			title: "Fresh Opportunity",
		});
		expect(
			result.suggestedOpportunities.rows[0]?.explanationTags.length
		).toBeGreaterThan(0);
		expect(result.brokerCoordination.assignedBroker).toMatchObject({
			brokerageName: "Meridian Brokerage",
			email: "broker@fairlend.ca",
			name: "Morgan Broker",
		});
	});

	it("treats empty stored allowlists as deny-all for portfolio suggestions", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const { lenderId, portalId } = await createPortfolioFixture(t);

		await t.run(async (ctx) => {
			const [constraint] = await ctx.db
				.query("lenderFilterConstraints")
				.withIndex("by_lender", (query) => query.eq("lenderId", lenderId))
				.collect();
			if (!constraint) {
				throw new Error("Expected lender constraint fixture");
			}
			await ctx.db.patch(constraint._id, {
				allowedMortgageTypes: [],
				allowedPropertyTypes: [],
				updatedAt: FIXTURE_TIME + 1,
			});
		});

		const result = await lender.query(
			portfolioApi.getLenderPortfolioCommandCenter,
			{
				portalId,
			}
		);

		expect(result.limitsStrip.effectiveFilters).toEqual({
			interestRate: undefined,
			ltv: { max: 0.7, min: 0.5 },
			maturityDate: { end: "2027-12-31" },
			mortgageTypes: [],
			principalAmount: { max: 350_000, min: 200_000 },
			propertyTypes: [],
			searchQuery: undefined,
		});
		expect(result.suggestedOpportunities).toEqual({
			excludedOwnedMortgageCount: 0,
			rows: [],
		});
		expect(result.emptyStates.hasSuggestions).toBe(false);
	});

	it("backfills portfolio suggestions after excluding already-owned listings", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const {
			mortgageId,
			portalId,
			secondSuggestionListingId,
			suggestionListingId,
		} = await createPortfolioFixture(t);

		const additionalSuggestionIds = await t.run(async (ctx) => {
			for (let index = 0; index < 24; index += 1) {
				await ctx.db.insert(
					"listings",
					buildListingDoc({
						mortgageId,
						publishedAt: FIXTURE_TIME + 1000 + index,
						title: `Owned filler ${String(index)}`,
					})
				);
			}

			const suggestionIds: Id<"listings">[] = [];
			for (let index = 0; index < 5; index += 1) {
				suggestionIds.push(
					await ctx.db.insert(
						"listings",
						buildListingDoc({
							publishedAt: FIXTURE_TIME + 14 - index,
							title: `Extra eligible suggestion ${String(index)}`,
						})
					)
				);
			}

			return suggestionIds;
		});

		const result = await lender.query(
			portfolioApi.getLenderPortfolioCommandCenter,
			{
				portalId,
			}
		);

		expect(result.suggestedOpportunities.excludedOwnedMortgageCount).toBe(25);
		expect(
			result.suggestedOpportunities.rows.map((row) => row.listingId)
		).toEqual([
			String(suggestionListingId),
			String(secondSuggestionListingId),
			String(additionalSuggestionIds[0]),
			String(additionalSuggestionIds[1]),
			String(additionalSuggestionIds[2]),
		]);
		expect(result.suggestedOpportunities.rows).toHaveLength(5);
	});

	it("rejects lender portfolio reads when the portal does not belong to the lender's broker context", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const { otherPortalId } = await createPortfolioFixture(t);

		await expect(
			lender.query(portfolioApi.getLenderPortfolioCommandCenter, {
				portalId: otherPortalId,
			})
		).rejects.toThrow();
	});

	it("returns lender-owned position and payment detail contracts from portal-scoped ids", async () => {
		const t = createHarness();
		const lender = t.withIdentity(LENDER);
		const { mortgageId, overdueObligationId, portalId } =
			await createPortfolioFixture(t);

		const positionDetail = await lender.query(
			portfolioApi.getLenderPortfolioPositionDetail,
			{
				mortgageId,
				portalId,
			}
		);
		expect(positionDetail.mortgage.mortgageId).toBe(String(mortgageId));
		expect(positionDetail.quickActions.map((item) => item.kind)).toEqual(
			expect.arrayContaining([
				"broker_message",
				"renewal_prompt",
				"deal_action",
			])
		);
		expect(positionDetail.renewal).toMatchObject({
			intent: "renew",
			status: "pending_signal",
		});

		const paymentDetail = await lender.query(
			portfolioApi.getLenderPortfolioPaymentDetail,
			{
				obligationId: overdueObligationId,
				portalId,
			}
		);
		expect(paymentDetail.payment.obligationId).toBe(
			String(overdueObligationId)
		);
		expect(
			paymentDetail.collectionTimeline.map((event) => event.label)
		).toEqual(
			expect.arrayContaining([
				"Payment scheduled",
				"Collection attempt created",
			])
		);
		expect(paymentDetail.relatedActions.map((item) => item.kind)).toEqual(
			expect.arrayContaining(["broker_message", "payment_exception"])
		);
	});

	it("rejects non-lender viewers from portfolio endpoints", async () => {
		const t = createHarness();
		const member = t.withIdentity(MEMBER);
		const { portalId } = await createPortfolioFixture(t);

		await expect(
			member.query(portfolioApi.getLenderPortfolioCommandCenter, {
				portalId,
			})
		).rejects.toThrow();
	});
});
