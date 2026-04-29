import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	buildLenderRenewalTimeline,
	LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS,
} from "../../../../convex/renewals/constants";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { BROKER, LENDER } from "../../auth/identities";

const NOW = new Date("2026-04-21T16:00:00.000Z");
const MATURITY_DATE = "2026-08-15";
const POSITION_FRACTIONS = 400n;

function createHarness() {
	return createTestConvex();
}

async function seedRenewalFixture(
	t: ReturnType<typeof createHarness>,
	options?: {
		maturityDate?: string;
		positionFractions?: bigint;
	}
) {
	await Promise.all([
		ensureSeededIdentity(t, BROKER),
		ensureSeededIdentity(t, LENDER),
	]);

	return t.run(async (ctx) => {
		const brokerUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", BROKER.subject))
			.unique();
		const lenderUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", LENDER.subject))
			.unique();
		if (!brokerUser || !lenderUser) {
			throw new Error("Expected seeded broker and lender users");
		}

		const createdAt = Date.now();
		const brokerId = await ctx.db.insert("brokers", {
			status: "active",
			userId: brokerUser._id,
			brokerageName: "Meridian Mortgage Group",
			orgId: BROKER.org_id,
			onboardedAt: createdAt,
			createdAt,
		});
		const portalId = await ctx.db.insert("portals", {
			slug: "meridian",
			portalType: "broker",
			brokerId,
			orgId: BROKER.org_id ?? "org_brokerage_test",
			productionHost: "meridian.fairlend.ca",
			localHost: "meridian.localhost:3000",
			status: "active",
			isPublished: true,
			publicTeaserEnabled: true,
			teaserListingLimit: 12,
			defaultPostAuthPath: "/portfolio",
			createdAt,
			updatedAt: createdAt,
		});
		await ctx.db.patch(brokerUser._id, { homePortalId: portalId });
		await ctx.db.patch(lenderUser._id, { homePortalId: portalId });

		const lenderId = await ctx.db.insert("lenders", {
			userId: lenderUser._id,
			orgId: BROKER.org_id,
			brokerId,
			accreditationStatus: "accredited",
			idvStatus: "verified",
			kycStatus: "approved",
			onboardingEntryPath: "broker_invite",
			status: "active",
			activatedAt: createdAt,
			createdAt,
		});

		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "123 Renewal Street",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V1E1",
			propertyType: "residential",
			createdAt,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			status: "active",
			machineContext: {
				lastPaymentAt: 0,
				missedPayments: 0,
			},
			lastTransitionAt: createdAt,
			propertyId,
			principal: 500_000_00,
			interestRate: 5.5,
			rateType: "fixed",
			termMonths: 12,
			amortizationMonths: 300,
			paymentAmount: 3_000_00,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-15",
			maturityDate: options?.maturityDate ?? MATURITY_DATE,
			firstPaymentDate: "2026-02-15",
			brokerOfRecordId: brokerId,
			createdAt,
		});
		const positionAccountId = await ctx.db.insert("ledger_accounts", {
			type: "POSITION",
			mortgageId,
			lenderId: LENDER.subject,
			cumulativeDebits: options?.positionFractions ?? POSITION_FRACTIONS,
			cumulativeCredits: 0n,
			pendingDebits: 0n,
			pendingCredits: 0n,
			createdAt,
		});

		return {
			brokerId,
			lenderId,
			mortgageId,
			portalId,
			positionAccountId,
		};
	});
}

async function seedAdditionalWindowMortgages(
	t: ReturnType<typeof createHarness>,
	args: {
		brokerId: Id<"brokers">;
		count: number;
		maturityDate?: string;
		positionFractions?: bigint;
	}
) {
	return t.run(async (ctx) => {
		for (let index = 0; index < args.count; index += 1) {
			const createdAt = Date.now() + index + 1;
			const propertyId = await ctx.db.insert("properties", {
				streetAddress: `${index + 200} Renewal Street`,
				city: "Toronto",
				province: "ON",
				postalCode: "M5V1E1",
				propertyType: "residential",
				createdAt,
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				status: "active",
				machineContext: {
					lastPaymentAt: 0,
					missedPayments: 0,
				},
				lastTransitionAt: createdAt,
				propertyId,
				principal: 500_000_00,
				interestRate: 5.5,
				rateType: "fixed",
				termMonths: 12,
				amortizationMonths: 300,
				paymentAmount: 3_000_00,
				paymentFrequency: "monthly",
				loanType: "conventional",
				lienPosition: 1,
				interestAdjustmentDate: "2026-01-01",
				termStartDate: "2026-01-15",
				maturityDate: args.maturityDate ?? MATURITY_DATE,
				firstPaymentDate: "2026-02-15",
				brokerOfRecordId: args.brokerId,
				createdAt,
			});
			await ctx.db.insert("ledger_accounts", {
				type: "POSITION",
				mortgageId,
				lenderId: LENDER.subject,
				cumulativeDebits: args.positionFractions ?? POSITION_FRACTIONS,
				cumulativeCredits: 0n,
				pendingDebits: 0n,
				pendingCredits: 0n,
				createdAt,
			});
		}
	});
}

async function getStoredIntent(
	t: ReturnType<typeof createHarness>,
	args: {
		lenderId: Id<"lenders">;
		mortgageId: Id<"mortgages">;
	}
) {
	return t.run(async (ctx) => {
		const matches = await ctx.db
			.query("lenderRenewalIntents")
			.withIndex("by_mortgage_and_lender", (query) =>
				query.eq("mortgageId", args.mortgageId).eq("lenderId", args.lenderId)
			)
			.collect();
		expect(matches).toHaveLength(1);
		return matches[0];
	});
}

async function getRenewalJournalRows(
	t: ReturnType<typeof createHarness>,
	intentId: Id<"lenderRenewalIntents">
) {
	return t.run(async (ctx) => {
		return ctx.db
			.query("auditJournal")
			.withIndex("by_entity", (query) =>
				query
					.eq("entityType", "lenderRenewalIntent")
					.eq("entityId", intentId)
			)
			.collect();
	});
}

describe("lender renewal portal runtime", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("rejects unauthenticated portal renewal queries", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);

		await expect(
			t.query(api.renewals.portal.listLenderRenewalIntents, {
				portalId: fixture.portalId,
			})
		).rejects.toThrow("Unauthorized: sign in required");
	});

	it("creates pending intents idempotently and projects actionable lender summaries", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);
		const timeline = buildLenderRenewalTimeline(MATURITY_DATE);

		const firstRun = await t.action(
			internal.renewals.internal.createRenewalIntentsInWindow,
			{
				asOf: Date.now(),
			}
		);
		expect(firstRun).toMatchObject({
			candidatesChecked: 1,
			created: 1,
			skipped: 0,
			updated: 0,
		});

		const secondRun = await t.action(
			internal.renewals.internal.createRenewalIntentsInWindow,
			{
				asOf: Date.now(),
			}
		);
		expect(secondRun).toMatchObject({
			candidatesChecked: 1,
			created: 0,
			skipped: 0,
			updated: 0,
		});

		const summary = await t.withIdentity(LENDER).query(
			api.renewals.portal.listLenderRenewalIntents,
			{
				portalId: fixture.portalId,
			}
		);
		expect(summary).toHaveLength(1);
		expect(summary[0]).toMatchObject({
			actionBlockedReason: null,
			actionRequired: true,
			availableChoices: ["renew", "exit", "partial_exit"],
			canChangeIntent: false,
			currentHeldFractions: Number(POSITION_FRACTIONS),
			fractionCount: Number(POSITION_FRACTIONS),
			intent: null,
			mortgageId: fixture.mortgageId,
			partialExitAvailable: true,
			partialExitMinimumFractions:
				LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS,
			positionAccountId: fixture.positionAccountId,
			signalDeadline: timeline.signalDeadlineAt,
			status: "pending_signal",
		});

		const storedIntent = await getStoredIntent(t, fixture);
		expect(storedIntent.signalDeadline).toBe(timeline.signalDeadlineAt);
		expect(storedIntent.maturityDate).toBe(timeline.maturityAt);
		expect(storedIntent.fractionCount).toBe(Number(POSITION_FRACTIONS));
		expect(storedIntent.positionAccountId).toBe(fixture.positionAccountId);
		expect(storedIntent.intent).toBeUndefined();
	});

	it("scans the full renewal window instead of stopping at the first batch", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);

		await seedAdditionalWindowMortgages(t, {
			brokerId: fixture.brokerId,
			count: 130,
		});

		const creationResult = await t.action(
			internal.renewals.internal.createRenewalIntentsInWindow,
			{
				asOf: Date.now(),
			}
		);
		expect(creationResult).toMatchObject({
			candidatesChecked: 131,
			created: 131,
			skipped: 0,
			updated: 0,
		});

		const intentCount = await t.run(async (ctx) => {
			return (
				await ctx.db
					.query("lenderRenewalIntents")
					.withIndex("by_lender", (query) => query.eq("lenderId", fixture.lenderId))
					.collect()
			).length;
		});
		expect(intentCount).toBe(131);
	});

	it("rejects partial exits below the configured minimum", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);

		await expect(
			t.withIdentity(LENDER).mutation(
				api.renewals.portal.signalLenderRenewalIntent,
				{
					portalId: fixture.portalId,
					mortgageId: fixture.mortgageId,
					intent: "partial_exit",
					partialExitFractions:
						LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS - 1,
				}
			)
		).rejects.toThrow(
			`partialExitFractions must be at least ${LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS}`
		);
	});

	it("lazy-creates missing intents and supports lender change-mind flows", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);

		const exiting = await t.withIdentity(LENDER).mutation(
			api.renewals.portal.signalLenderRenewalIntent,
			{
				portalId: fixture.portalId,
				mortgageId: fixture.mortgageId,
				intent: "partial_exit",
				partialExitFractions: 150,
				notes: "Trim exposure before maturity",
			}
		);
		expect(exiting).toMatchObject({
			actionRequired: false,
			availableChoices: ["renew", "exit"],
			canChangeIntent: true,
			intent: "partial_exit",
			notes: "Trim exposure before maturity",
			partialExitFractions: 150,
			status: "exiting",
		});

		const renewed = await t.withIdentity(LENDER).mutation(
			api.renewals.portal.signalLenderRenewalIntent,
			{
				portalId: fixture.portalId,
				mortgageId: fixture.mortgageId,
				intent: "renew",
				notes: "Actually staying in",
			}
		);
		expect(renewed).toMatchObject({
			actionRequired: false,
			availableChoices: ["exit", "partial_exit"],
			canChangeIntent: true,
			intent: "renew",
			notes: "Actually staying in",
			partialExitFractions: null,
			status: "renewed",
		});

		const storedIntent = await getStoredIntent(t, fixture);
		expect(storedIntent.status).toBe("renewed");
		expect(storedIntent.intent).toBe("renew");
		expect(storedIntent.partialExitFractions).toBeUndefined();
		expect(storedIntent.signalledAt).toBe(Date.now());

		const journalRows = await getRenewalJournalRows(t, storedIntent._id);
		expect(journalRows.map((row) => row.eventType)).toEqual([
			"LENDER_SIGNALS_PARTIAL_EXIT",
			"LENDER_CHANGES_MIND",
		]);
		expect(journalRows.at(-1)).toMatchObject({
			actorId: LENDER.subject,
			actorType: "member",
			channel: "broker_portal",
			newState: "renewed",
		});

		const reloaded = await t.withIdentity(LENDER).query(
			api.renewals.portal.getLenderRenewalIntentByMortgage,
			{
				portalId: fixture.portalId,
				mortgageId: fixture.mortgageId,
			}
		);
		expect(reloaded).toMatchObject({
			intent: "renew",
			status: "renewed",
		});
	});

	it("expires pending intents past deadline through the scheduler entrypoint", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);
		const timeline = buildLenderRenewalTimeline(MATURITY_DATE);

		await t.action(internal.renewals.internal.createRenewalIntentsInWindow, {
			asOf: Date.now(),
		});
		vi.setSystemTime(new Date(timeline.signalDeadlineAt + 60_000));

		const expiryResult = await t.action(
			internal.renewals.internal.expireLenderRenewalIntentsPastDeadline,
			{
				asOf: Date.now(),
			}
		);
		expect(expiryResult).toMatchObject({
			candidatesChecked: 1,
			expired: 1,
			rejected: 0,
		});

		const storedIntent = await getStoredIntent(t, fixture);
		expect(storedIntent.status).toBe("expired");

		const journalRows = await getRenewalJournalRows(t, storedIntent._id);
		expect(journalRows.at(-1)).toMatchObject({
			actorId: "system",
			actorType: "system",
			channel: "scheduler",
			eventType: "DEADLINE_PASSED",
			newState: "expired",
		});
	});

	it("persists expiry when a lender tries to signal after the deadline", async () => {
		const t = createHarness();
		const fixture = await seedRenewalFixture(t);
		const timeline = buildLenderRenewalTimeline(MATURITY_DATE);

		await t.action(internal.renewals.internal.createRenewalIntentsInWindow, {
			asOf: Date.now(),
		});
		vi.setSystemTime(new Date(timeline.signalDeadlineAt + 60_000));

		const expired = await t.withIdentity(LENDER).mutation(
			api.renewals.portal.signalLenderRenewalIntent,
			{
				portalId: fixture.portalId,
				mortgageId: fixture.mortgageId,
				intent: "renew",
			}
		);
		expect(expired).toMatchObject({
			actionBlockedReason: "expired",
			actionRequired: false,
			availableChoices: [],
			intent: null,
			status: "expired",
		});

		const storedIntent = await getStoredIntent(t, fixture);
		expect(storedIntent.status).toBe("expired");

		const journalRows = await getRenewalJournalRows(t, storedIntent._id);
		expect(journalRows.at(-1)).toMatchObject({
			actorId: "system",
			actorType: "system",
			channel: "scheduler",
			eventType: "DEADLINE_PASSED",
			newState: "expired",
		});
	});
});
