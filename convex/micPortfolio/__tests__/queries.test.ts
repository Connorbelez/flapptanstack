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
		includeMicPosition?: boolean;
		isPublished?: boolean;
		micLenderAuthId?: string;
		portalStatus?: Doc<"portals">["status"];
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
			termStartDate: "2026-01-01",
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
			orgId: "org_mic_investors",
			paymentNumber: 1,
			postingGroupId: undefined,
			settledAt: undefined,
			sourceObligationId: undefined,
			status: "overdue",
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
			confirmedAt: undefined,
			executionIdempotencyKey: undefined,
			executionReason: undefined,
			executionRequestedAt: undefined,
			failedAt: FIXTURE_TIME + 130,
			failureReason: "NSF",
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
			settledAt: undefined,
			status: "failed",
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
			arrearsExposure: 150_000,
			delinquencyExposure: 150_000,
			outstandingPrincipal: 150_000,
			weightedAverageLtv: 0.65,
			weightedAverageYield: 8.5,
		});
		expect(dashboard.positions).toHaveLength(1);
		expect(dashboard.positions[0]).toMatchObject({
			borrowerLabel: "Bailey Borrower",
			ltv: 0.65,
			mortgageId: String(mortgageId),
			outstandingPrincipal: 150_000,
			positionUnits: 6000,
			propertyLabel: "123 King St W, Toronto",
			rateYield: 8.5,
			status: "active",
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
				outstandingPrincipal: 150_000,
				sharePercent: 100,
			},
		]);
		expect(collectObjectKeys(dashboard).join(" ")).not.toMatch(
			UNSUPPORTED_METRIC_KEY_PATTERN
		);
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
				outstandingPrincipal: 150_000,
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
