import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	type MockIdentity,
	seedFromIdentity,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_ADMIN, MEMBER } from "../../../src/test/auth/identities";
import { api, internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const micPortfolioApi = anyApi.micPortfolio.queries;

const FIXTURE_TIME = Date.UTC(2026, 0, 15, 12, 0, 0);
const SYS_SOURCE = { type: "system" as const, channel: "test" };
const TRANSFER_FIXTURE_SOURCE = {
	actorId: "mic_portal_fixture",
	actorType: "admin" as const,
	channel: "admin_dashboard" as const,
};

const MIC_INVESTOR: MockIdentity = createMockViewer({
	email: "mic.investor@test.fairlend.ca",
	firstName: "Mic",
	lastName: "Investor",
	orgId: "org_mic_investors",
	orgName: "MIC Investors",
	permissions: ["mic:access"],
	roles: ["micinvestor"],
	subject: "user_mic_investor_test",
});

const MIC_LENDER_AUTH_ID = "user_mic_lender_mapping";
const OTHER_LENDER_AUTH_ID = "user_non_mic_lender";
const UNSUPPORTED_METRIC_KEY_PATTERN =
	/treasury|reserve|cashOnHand|nav|capTable|unitOwnership/i;

function createHarness() {
	return convexTest(schema, convexModules);
}

function collectObjectKeys(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.flatMap((entry) => collectObjectKeys(entry));
	}
	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, nestedValue]) => [
			key,
			...collectObjectKeys(nestedValue),
		]);
	}
	return [];
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
	await admin.mutation(api.ledger.mutations.mintMortgage, {
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
	await admin.mutation(internal.ledger.mutations.issueShares, {
		amount,
		effectiveDate: "2026-01-01",
		idempotencyKey,
		lenderId,
		mortgageId,
		source: SYS_SOURCE,
	});
}

function buildListingDoc(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">> = {}
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
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
		description: "MIC listing fixture",
		displayOrder: undefined,
		featured: false,
		heroImages: [],
		interestRate: 8.5,
		lastTransitionAt: undefined,
		lienPosition: 1,
		loanType: "conventional",
		ltvRatio: 0.65,
		machineContext: undefined,
		marketplaceCopy: "MIC marketplace copy",
		marketplacePropertyType: "Detached Home",
		maturityDate: "2027-01-01",
		monthlyPayment: 1250,
		mortgageId: undefined,
		paymentFrequency: "monthly",
		paymentHistory: undefined,
		principal: 250_000,
		propertyId: undefined,
		propertyType: "residential",
		province: "ON",
		publicDocumentIds: [],
		publishedAt: FIXTURE_TIME,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 12,
		title: "MIC Listing",
		updatedAt: FIXTURE_TIME,
		viewCount: 0,
		...overrides,
	};
}

async function createMicFixture(
	t: ReturnType<typeof createHarness>,
	options?: {
		firstPaymentDate?: string;
		includeMicPosition?: boolean;
		isPublished?: boolean;
		micLenderAuthId?: string;
		obligationDueDateMs?: number;
		portalStatus?: Doc<"portals">["status"];
		settledInterestCents?: number;
		termStartDate?: string;
	}
) {
	await seedFromIdentity(t, MIC_INVESTOR);

	const ids = await t.run(async (ctx) => {
		const brokerUserId = await ctx.db.insert("users", {
			authId: "user_mic_broker",
			email: "mic-broker@test.fairlend.ca",
			firstName: "Morgan",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "MIC Brokerage",
			createdAt: FIXTURE_TIME,
			orgId: "org_mic_investors",
			status: "active",
			userId: brokerUserId,
		});
		const micLenderUserId = await ctx.db.insert("users", {
			authId: MIC_LENDER_AUTH_ID,
			email: "mic-lender@test.fairlend.ca",
			firstName: "Mapped",
			lastName: "Lender",
		});
		const micLenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: FIXTURE_TIME,
			onboardingEntryPath: "admin_seed",
			orgId: "org_mic_investors",
			status: "active",
			userId: micLenderUserId,
		});
		const otherLenderUserId = await ctx.db.insert("users", {
			authId: OTHER_LENDER_AUTH_ID,
			email: "other-lender@test.fairlend.ca",
			firstName: "Other",
			lastName: "Lender",
		});
		await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: FIXTURE_TIME,
			onboardingEntryPath: "admin_seed",
			orgId: "org_mic_investors",
			status: "active",
			userId: otherLenderUserId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId: undefined,
			createdAt: FIXTURE_TIME,
			defaultPostAuthPath: "/mic",
			isPublished: options?.isPublished ?? true,
			landingPageId: undefined,
			localHost: "mic.localhost:3000",
			micLenderAuthId: options?.micLenderAuthId ?? MIC_LENDER_AUTH_ID,
			orgId: "org_mic_investors",
			portalType: "mic",
			pricingPolicyId: undefined,
			productionHost: "mic.fairlend.ca",
			publicTeaserEnabled: false,
			slug: "mic",
			status: options?.portalStatus ?? "active",
			teaserListingLimit: undefined,
			updatedAt: FIXTURE_TIME,
		});

		const borrowerUserId = await ctx.db.insert("users", {
			authId: "user_mic_borrower",
			email: "borrower@test.fairlend.ca",
			firstName: "Bailey",
			lastName: "Borrower",
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			createdAt: FIXTURE_TIME,
			lastTransitionAt: undefined,
			orgId: "org_mic_investors",
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
			unit: undefined,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: brokerId,
			brokerOfRecordId: brokerId,
			createdAt: FIXTURE_TIME,
			firstPaymentDate: options?.firstPaymentDate ?? "2026-02-01",
			fundedAt: undefined,
			interestAdjustmentDate: "2026-01-01",
			interestRate: 8.5,
			isRenewal: undefined,
			lastTransitionAt: undefined,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: undefined,
			maturityDate: "2027-01-01",
			orgId: "org_mic_investors",
			paymentAmount: 1250,
			paymentFrequency: "monthly",
			principal: 250_000,
			priorMortgageId: undefined,
			propertyId,
			rateType: "fixed",
			simulationId: undefined,
			status: "active",
			termMonths: 12,
			termStartDate: options?.termStartDate ?? "2026-01-01",
		});
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: FIXTURE_TIME,
			borrowerId,
			mortgageId,
			role: "primary",
		});
		await ctx.db.insert(
			"listings",
			buildListingDoc({
				mortgageId,
				propertyId,
				title: "Mapped MIC Mortgage",
			})
		);
		const settledInterestCents = options?.settledInterestCents ?? 0;
		const hasSettledInterest = settledInterestCents > 0;
		const overdueObligationId = await ctx.db.insert("obligations", {
			amount: 125_000,
			amountSettled: settledInterestCents,
			borrowerId,
			createdAt: FIXTURE_TIME + 100,
			dueDate: options?.obligationDueDateMs ?? Date.UTC(2026, 1, 1),
			feeCode: undefined,
			gracePeriodEnd: Date.UTC(2026, 1, 5),
			lastTransitionAt: undefined,
			machineContext: undefined,
			mortgageFeeId: undefined,
			mortgageId,
			orgId: "org_mic_investors",
			paymentNumber: 1,
			postingGroupId: undefined,
			settledAt: hasSettledInterest ? FIXTURE_TIME + 140 : undefined,
			sourceObligationId: undefined,
			status: settledInterestCents >= 125_000 ? "settled" : "overdue",
			type: "regular_interest",
		});
		const planEntryId = await ctx.db.insert("collectionPlanEntries", {
			amount: 125_000,
			collectionAttemptId: undefined,
			createdAt: FIXTURE_TIME + 110,
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
			confirmedAt: hasSettledInterest ? FIXTURE_TIME + 135 : undefined,
			executionIdempotencyKey: undefined,
			executionReason: undefined,
			executionRequestedAt: undefined,
			failedAt: hasSettledInterest ? undefined : FIXTURE_TIME + 130,
			failureReason: hasSettledInterest ? undefined : "NSF",
			initiatedAt: FIXTURE_TIME + 120,
			lastTransitionAt: FIXTURE_TIME + 130,
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
			settledAt: hasSettledInterest ? FIXTURE_TIME + 140 : undefined,
			status: hasSettledInterest ? "settled" : "failed",
			transferRequestId: undefined,
			triggerSource: "admin_manual",
		});

		return { micLenderId, mortgageId, overdueObligationId, portalId };
	});

	const admin = t.withIdentity(FAIRLEND_ADMIN);
	await initializeLedger(admin);
	await mintMortgage(
		admin,
		String(ids.mortgageId),
		`mic-fixture-mint-${String(ids.mortgageId)}`
	);
	if (options?.includeMicPosition !== false) {
		await issueShares(
			admin,
			String(ids.mortgageId),
			MIC_LENDER_AUTH_ID,
			6000,
			`mic-fixture-issue-mic-${String(ids.mortgageId)}`
		);
	}
	await issueShares(
		admin,
		String(ids.mortgageId),
		OTHER_LENDER_AUTH_ID,
		3000,
		`mic-fixture-issue-other-${String(ids.mortgageId)}`
	);

	return ids;
}

describe("MIC portfolio queries", () => {
	it("builds dashboard data from the portal mapped MIC lender ledger position only", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { mortgageId, portalId } = await createMicFixture(t);

		const dashboard = await micInvestor.query(
			micPortfolioApi.getMicDashboardSnapshot,
			{ portalId }
		);

		expect(dashboard.sourceOfTruth).toBe(
			"mortgage_ledger_lender_participation"
		);
		expect(dashboard.dataCompleteness).toBe("partial");
		expect(dashboard.warnings.join(" ")).toContain("cash-on-hand");
		expect(dashboard.metrics).toMatchObject({
			activePositionCount: 1,
			arrearsExposure: 1500,
			delinquencyExposure: 1500,
			inferredLendingFeeIncome: 25,
			lendingFeeIncomeSharePercent: 58.53,
			outstandingPrincipal: 1500,
			totalReturnIncome: 42.71,
			weightedAverageLtv: 0.65,
			weightedAverageYield: 8.5,
		});
		expect(dashboard.returnSeries).toEqual([
			{
				cumulativeFeeIncome: 25,
				cumulativeInterestIncome: 17.71,
				cumulativeTotalReturn: 42.71,
				feeIncome: 25,
				feeIncomeSharePercent: 58.53,
				interestIncome: 17.71,
				originatedPrincipal: 2500,
				period: "2026-01",
				totalReturn: 42.71,
			},
		]);
		expect(dashboard.lendingFeeMetrics).toEqual({
			feeBasisPoints: 100,
			inferredLendingFeeIncome: 25,
			lendingFeeIncomeSharePercent: 58.53,
			mortgageOriginatedCount: 1,
			originatedPrincipal: 2500,
			totalInterestIncome: 17.71,
			totalReturnIncome: 42.71,
		});
		expect(dashboard.positions).toHaveLength(1);
		expect(dashboard.positions[0]).toMatchObject({
			borrowerLabel: "Bailey Borrower",
			currentPayment: {
				amount: 750,
				dueDate: "2026-02-01",
				status: "exception",
			},
			ltv: 0.65,
			mortgageId: String(mortgageId),
			outstandingPrincipal: 1500,
			positionUnits: 6000,
			propertyLabel: "123 King St W, Toronto",
			rateYield: 8.5,
			status: "active",
			thumbnailUrl: null,
		});
		expect(dashboard.positions[0]?.arrearsSignal).toMatchObject({
			overdueAmount: 750,
			overdueCount: 1,
			status: "exception",
		});
		expect(dashboard.concentration.byBorrower).toEqual([
			{
				count: 1,
				key: "Bailey Borrower",
				label: "Bailey Borrower",
				outstandingPrincipal: 1500,
				sharePercent: 100,
			},
		]);
		expect(collectObjectKeys(dashboard).join(" ")).not.toMatch(
			UNSUPPORTED_METRIC_KEY_PATTERN
		);
	});

	it("keeps return projection independent of settlement state", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { portalId } = await createMicFixture(t, {
			settledInterestCents: 125_000,
		});

		const dashboard = await micInvestor.query(
			micPortfolioApi.getMicDashboardSnapshot,
			{ portalId }
		);

		expect(dashboard.lendingFeeMetrics).toMatchObject({
			inferredLendingFeeIncome: 25,
			lendingFeeIncomeSharePercent: 58.53,
			totalInterestIncome: 17.71,
			totalReturnIncome: 42.71,
		});
		expect(dashboard.returnSeries).toEqual([
			expect.objectContaining({
				cumulativeInterestIncome: 17.71,
				cumulativeTotalReturn: 42.71,
				feeIncome: 25,
				feeIncomeSharePercent: 58.53,
				interestIncome: 17.71,
				totalReturn: 42.71,
			}),
		]);
	});

	it("projects each period from originated fees plus monthly interest on active mortgages", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { portalId } = await createMicFixture(t, {
			firstPaymentDate: "2026-04-01",
			obligationDueDateMs: Date.UTC(2026, 3, 1),
			termStartDate: "2026-04-01",
		});

		const dashboard = await micInvestor.query(
			micPortfolioApi.getMicDashboardSnapshot,
			{ portalId }
		);

		expect(dashboard.returnSeries).toEqual([
			expect.objectContaining({
				cumulativeFeeIncome: 25,
				cumulativeInterestIncome: 17.71,
				cumulativeTotalReturn: 42.71,
				feeIncome: 25,
				interestIncome: 17.71,
				period: "2026-04",
				totalReturn: 42.71,
			}),
		]);
	});

	it("returns empty position contracts without fabricating cash metrics", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { portalId } = await createMicFixture(t, {
			includeMicPosition: false,
		});

		const dashboard = await micInvestor.query(
			micPortfolioApi.getMicDashboardSnapshot,
			{ portalId }
		);

		expect(dashboard.metrics.activePositionCount).toBe(0);
		expect(dashboard.metrics.outstandingPrincipal).toBe(0);
		expect(dashboard.positions).toEqual([]);
		expect(dashboard.concentration).toEqual({
			byBorrower: [],
			byGeography: [],
			byPropertyType: [],
			byStatus: [],
		});
		expect(collectObjectKeys(dashboard).join(" ")).not.toMatch(
			UNSUPPORTED_METRIC_KEY_PATTERN
		);
	});

	it("returns positions, detail, payments, and concentration contracts", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { mortgageId, overdueObligationId, portalId } =
			await createMicFixture(t);

		const positions = await micInvestor.query(micPortfolioApi.getMicPositions, {
			filters: { province: "ON", searchQuery: "king" },
			portalId,
		});
		expect(positions.rows).toHaveLength(1);
		expect(positions.filters).toEqual({ province: "ON", searchQuery: "king" });

		const detail = await micInvestor.query(
			micPortfolioApi.getMicPositionDetail,
			{ mortgageId, portalId }
		);
		expect(detail.position?.mortgage.mortgageId).toBe(String(mortgageId));
		expect(detail.position?.payments[0]?.obligationId).toBe(
			String(overdueObligationId)
		);

		const payments = await micInvestor.query(
			micPortfolioApi.getMicPaymentsHistory,
			{ mortgageId, portalId }
		);
		expect(payments.rows).toHaveLength(1);
		expect(payments.rows[0]).toMatchObject({
			micShareAmount: 750,
			micSharePercentOfGross: 60,
			obligationId: String(overdueObligationId),
			rowStatus: "exception",
		});

		const concentration = await micInvestor.query(
			micPortfolioApi.getMicConcentrationExposure,
			{ portalId }
		);
		expect(concentration.concentration.byStatus).toEqual([
			{
				count: 1,
				key: "active",
				label: "active",
				outstandingPrincipal: 1500,
				sharePercent: 100,
			},
		]);
	});

	it("fails closed for missing mapping, inactive portal, and missing permission", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const missingMapping = await createMicFixture(t, { micLenderAuthId: "" });
		const inactive = await createMicFixture(t, {
			portalStatus: "suspended",
		});

		await expect(
			micInvestor.query(micPortfolioApi.getMicDashboardSnapshot, {
				portalId: missingMapping.portalId,
			})
		).rejects.toThrow();
		await expect(
			micInvestor.query(micPortfolioApi.getMicDashboardSnapshot, {
				portalId: inactive.portalId,
			})
		).rejects.toThrow();

		const member = t.withIdentity(MEMBER);
		await expect(
			member.query(micPortfolioApi.getMicDashboardSnapshot, {
				portalId: inactive.portalId,
			})
		).rejects.toThrow();
	});

	it("enriches position detail with ownership, histories, and redacted audit rows", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { mortgageId, portalId } = await createMicFixture(t);

		await t.run(async (ctx) => {
			await ctx.db.insert("deals", {
				buyerId: "buyer_fixture",
				closingDate: undefined,
				createdAt: FIXTURE_TIME + 500,
				createdBy: "test_actor",
				fractionalShare: 2500,
				mortgageId,
				orgId: "org_mic_investors",
				sellerId: "seller_fixture",
				status: "lawyerOnboarding.pending",
			});
			await ctx.db.insert("deals", {
				buyerId: "buyer_fixture_2",
				closingDate: undefined,
				createdAt: FIXTURE_TIME + 600,
				createdBy: "test_actor",
				fractionalShare: 500,
				mortgageId,
				orgId: "org_mic_investors",
				sellerId: "seller_fixture_2",
				status: "confirmed",
			});
			await ctx.db.insert("transferRequests", {
				amount: 9900,
				counterpartyId: "cp_fixture",
				counterpartyType: "borrower",
				createdAt: FIXTURE_TIME + 700,
				currency: "CAD",
				direction: "inbound",
				idempotencyKey: "mic-portal-detail-transfer-fixture",
				lastTransitionAt: FIXTURE_TIME + 700,
				mortgageId,
				obligationId: undefined,
				providerCode: "manual",
				source: TRANSFER_FIXTURE_SOURCE,
				status: "initiated",
				transferType: "borrower_interest_collection",
			});
			await ctx.db.insert("auditJournal", {
				actorId: "test_actor",
				channel: "admin_dashboard",
				effectiveDate: "2026-01-15",
				entityId: String(mortgageId),
				entityType: "mortgage",
				eventCategory: "mic_portal_test",
				eventId: "mic-portal-audit-fixture",
				eventType: "MIC_PORTAL_TEST_EVENT",
				mortgageId: String(mortgageId),
				newState: "active",
				originSystem: "test",
				outcome: "transitioned",
				payload: { sensitive: "must-not-leak" },
				previousState: "draft",
				reason: undefined,
				sequenceNumber: 42n,
				timestamp: FIXTURE_TIME + 800,
			});
		});

		const detail = await micInvestor.query(
			micPortfolioApi.getMicPositionDetail,
			{
				mortgageId,
				portalId,
			}
		);

		expect(detail.position?.micOwnership).toEqual({
			percent: 60,
			totalUnits: 10_000,
			units: 6000,
		});
		expect(detail.position?.dealHistory.length).toBe(2);
		expect(detail.position?.ongoingDeals).toEqual([
			expect.objectContaining({
				isTerminal: false,
				status: "lawyerOnboarding.pending",
			}),
		]);
		expect(detail.position?.transferHistory).toEqual([
			expect.objectContaining({
				amount: 99,
				status: "initiated",
			}),
		]);
		expect(detail.position?.auditHistory).toEqual([
			expect.objectContaining({
				eventType: "MIC_PORTAL_TEST_EVENT",
				newState: "active",
				outcome: "transitioned",
				previousState: "draft",
				sequenceNumber: "42",
			}),
		]);
		const keys = collectObjectKeys(detail.position);
		expect(keys.join(" ")).not.toContain("payload");
		expect(keys.join(" ")).not.toContain("beforeState");
		expect(keys.join(" ")).not.toContain("afterState");
	});

	it("fails closed when the mapped MIC lender account cannot be resolved", async () => {
		const t = createHarness();
		const micInvestor = t.withIdentity(MIC_INVESTOR);
		const { portalId } = await createMicFixture(t, {
			micLenderAuthId: "missing_lender_auth_id",
		});

		await expect(
			micInvestor.query(micPortfolioApi.getMicDashboardSnapshot, {
				portalId,
			})
		).rejects.toThrow("MIC lender mapping cannot be resolved");
	});
});
