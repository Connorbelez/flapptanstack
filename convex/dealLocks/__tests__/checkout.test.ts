import { anyApi } from "convex/server";
import { ConvexError } from "convex/values";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../_generated/dataModel";
import { auditLog } from "../../auditLog";
import { FAIRLEND_MIC_LENDER_EMAIL } from "../../platform/defaultOriginationOwnerContract";
import schema from "../../schema";
import { seedAuthIdFromEmail } from "../../seed/seedHelpers";
import { convexModules } from "../../test/moduleMaps";
import { DEAL_LOCK_FEE_AMOUNT_CENTS } from "../validators";

process.env.DISABLE_GT_HASHCHAIN = "true";

const modules = convexModules;
const api = anyApi.dealLocks.mutations;
const CANONICAL_MIC_LENDER_AUTH_ID = seedAuthIdFromEmail(
	FAIRLEND_MIC_LENDER_EMAIL
);
const NON_CANONICAL_MIC_PATTERN_LENDER_ID = "seed_maple_mic_lender_fairlend_ca";

function createHarness() {
	return convexTest(schema, modules);
}

async function seedCheckoutFixture(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const now = 1_777_000_000_000;
		const brokerUserId = await ctx.db.insert("users", {
			authId: "broker-auth",
			email: "broker@test.fairlend.ca",
			firstName: "Bryn",
			lastName: "Broker",
		});
		const buyerUserId = await ctx.db.insert("users", {
			authId: "buyer-auth",
			email: "buyer@test.fairlend.ca",
			firstName: "Bianca",
			lastName: "Buyer",
		});
		await ctx.db.insert("users", {
			authId: "lawyer-auth",
			email: "lawyer@test.fairlend.ca",
			firstName: "Laura",
			lastName: "Lawyer",
		});
		await ctx.db.insert("users", {
			authId: "unassigned-lawyer-auth",
			email: "unassigned-lawyer@test.fairlend.ca",
			firstName: "Una",
			lastName: "Assigned",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: now,
			status: "active",
			userId: brokerUserId,
		});
		await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: now,
			onboardingEntryPath: "self_signup",
			status: "active",
			userId: buyerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: now,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: now,
			firstPaymentDate: "2026-02-01",
			interestAdjustmentDate: "2026-01-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2031-01-01",
			paymentAmount: 2500,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			rateType: "fixed",
			status: "funded",
			termMonths: 60,
			termStartDate: "2026-01-01",
		});
		await ctx.db.insert("closingTeamAssignments", {
			assignedAt: now,
			assignedBy: "seed",
			mortgageId,
			role: "closing_lawyer",
			userId: "lawyer-auth",
		});
		const listingId = await ctx.db.insert("listings", {
			city: "Toronto",
			createdAt: now,
			dataSource: "mortgage_pipeline",
			featured: false,
			heroImages: [],
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			ltvRatio: 65,
			marketplacePropertyType: "Detached Home",
			maturityDate: "2031-01-01",
			monthlyPayment: 2500,
			mortgageId,
			paymentFrequency: "monthly",
			principal: 500_000,
			propertyId,
			propertyType: "residential",
			province: "ON",
			publicDocumentIds: [],
			rateType: "fixed",
			status: "published",
			termMonths: 60,
			title: "King West Mortgage",
			updatedAt: now,
			viewCount: 0,
		});
		const sellerAccountId = await ctx.db.insert("ledger_accounts", {
			createdAt: now,
			cumulativeCredits: 0n,
			cumulativeDebits: 10_000n,
			lenderId: CANONICAL_MIC_LENDER_AUTH_ID,
			mortgageId: String(mortgageId),
			pendingCredits: 0n,
			pendingDebits: 0n,
			type: "POSITION",
		});
		return { listingId, mortgageId, sellerAccountId };
	});
}

async function prepareCheckout(
	t: ReturnType<typeof createHarness>,
	args: {
		fractionalShareUnits?: number;
		idempotencyKey?: string;
		listingId: Id<"listings">;
	}
) {
	return await t.mutation(api.prepareCheckoutSession, {
		buyerAuthId: "buyer-auth",
		fractionalShareUnits: args.fractionalShareUnits ?? 2500,
		idempotencyKey: args.idempotencyKey ?? "checkout-test-key",
		listingId: args.listingId,
		selectedLawyerAuthId: "lawyer-auth",
		selectedLawyerType: "platform_lawyer",
	});
}

async function attachStripeSession(
	t: ReturnType<typeof createHarness>,
	checkoutSessionId: Id<"dealLockCheckoutSessions">,
	stripeCheckoutSessionId = "cs_test_listing_lock"
) {
	return await t.mutation(api.attachStripeCheckoutSession, {
		checkoutSessionId,
		stripeCheckoutSessionId,
		stripeCheckoutUrl: `https://checkout.stripe.test/${stripeCheckoutSessionId}`,
	});
}

describe("deal lock checkout start", () => {
	let t: ReturnType<typeof createHarness>;

	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-24T12:00:00Z"));
		vi.spyOn(auditLog, "log").mockResolvedValue(undefined);
		t = createHarness();
	});

	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	it("creates a durable session and temporary ledger reservation before Stripe redirect", async () => {
		const fixture = await seedCheckoutFixture(t);

		const session = await prepareCheckout(t, {
			listingId: fixture.listingId,
		});

		expect(session).toMatchObject({
			buyerAuthId: "buyer-auth",
			fractionalShareUnits: 2500,
			listingId: fixture.listingId,
			lockFeeAmountCents: DEAL_LOCK_FEE_AMOUNT_CENTS,
			lockFeeCurrency: "cad",
			mortgageId: fixture.mortgageId,
			selectedLawyerAuthId: "lawyer-auth",
			selectedLawyerType: "platform_lawyer",
			sellerAuthId: CANONICAL_MIC_LENDER_AUTH_ID,
			status: "created",
		});
		expect(session.reservationId).toBeDefined();
		expect(session.dealId).toBeUndefined();

		const reservation = await t.run(async (ctx) =>
			session.reservationId ? ctx.db.get(session.reservationId) : null
		);
		expect(reservation).toMatchObject({
			amount: 2500,
			mortgageId: String(fixture.mortgageId),
			status: "pending",
		});
		expect(reservation?.dealId).toBeUndefined();
	});

	it("reuses the existing session and reservation for a stable idempotency key", async () => {
		const fixture = await seedCheckoutFixture(t);

		const first = await prepareCheckout(t, {
			idempotencyKey: "same-selection",
			listingId: fixture.listingId,
		});
		const second = await prepareCheckout(t, {
			idempotencyKey: "same-selection",
			listingId: fixture.listingId,
		});

		expect(second._id).toEqual(first._id);
		expect(second.reservationId).toEqual(first.reservationId);
	});

	it("rejects invalid fraction units before creating a session or reservation", async () => {
		const fixture = await seedCheckoutFixture(t);

		await expect(
			prepareCheckout(t, {
				fractionalShareUnits: 0.5,
				listingId: fixture.listingId,
			})
		).rejects.toThrow(ConvexError);

		const counts = await t.run(async (ctx) => ({
			reservations: await ctx.db.query("ledger_reservations").collect(),
			sessions: await ctx.db.query("dealLockCheckoutSessions").collect(),
		}));
		expect(counts.reservations).toHaveLength(0);
		expect(counts.sessions).toHaveLength(0);
	});

	it("rejects unavailable fractions without creating a checkout session", async () => {
		const fixture = await seedCheckoutFixture(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.sellerAccountId, {
				pendingCredits: 9000n,
			});
		});

		await expect(
			prepareCheckout(t, {
				fractionalShareUnits: 2500,
				listingId: fixture.listingId,
			})
		).rejects.toThrow(ConvexError);

		const sessions = await t.run(async (ctx) =>
			ctx.db.query("dealLockCheckoutSessions").collect()
		);
		expect(sessions).toHaveLength(0);
	});

	it("rejects non-canonical MIC-pattern seller accounts", async () => {
		const fixture = await seedCheckoutFixture(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.sellerAccountId, {
				lenderId: NON_CANONICAL_MIC_PATTERN_LENDER_ID,
			});
		});

		await expect(
			prepareCheckout(t, {
				fractionalShareUnits: 2500,
				listingId: fixture.listingId,
			})
		).rejects.toThrow(ConvexError);

		const sessions = await t.run(async (ctx) =>
			ctx.db.query("dealLockCheckoutSessions").collect()
		);
		expect(sessions).toHaveLength(0);
	});

	it("rejects unassigned selected lawyers before creating a session", async () => {
		const fixture = await seedCheckoutFixture(t);

		await expect(
			t.mutation(api.prepareCheckoutSession, {
				buyerAuthId: "buyer-auth",
				fractionalShareUnits: 2500,
				idempotencyKey: "unassigned-lawyer",
				listingId: fixture.listingId,
				selectedLawyerAuthId: "unassigned-lawyer-auth",
				selectedLawyerType: "platform_lawyer",
			})
		).rejects.toThrow(ConvexError);

		const counts = await t.run(async (ctx) => ({
			reservations: await ctx.db.query("ledger_reservations").collect(),
			sessions: await ctx.db.query("dealLockCheckoutSessions").collect(),
		}));
		expect(counts.reservations).toHaveLength(0);
		expect(counts.sessions).toHaveLength(0);
	});

	it("rejects inactive buyer lender profiles before creating a session", async () => {
		const fixture = await seedCheckoutFixture(t);
		await t.run(async (ctx) => {
			const buyerUser = await ctx.db
				.query("users")
				.withIndex("authId", (q) => q.eq("authId", "buyer-auth"))
				.unique();
			if (!buyerUser) {
				throw new Error("Expected buyer user");
			}
			const buyerLender = await ctx.db
				.query("lenders")
				.withIndex("by_user", (q) => q.eq("userId", buyerUser._id))
				.unique();
			if (!buyerLender) {
				throw new Error("Expected buyer lender");
			}
			await ctx.db.patch(buyerLender._id, {
				accreditationStatus: "rejected",
				status: "inactive",
			});
		});

		await expect(
			prepareCheckout(t, {
				idempotencyKey: "inactive-buyer",
				listingId: fixture.listingId,
			})
		).rejects.toThrow(ConvexError);

		const sessions = await t.run(async (ctx) =>
			ctx.db.query("dealLockCheckoutSessions").collect()
		);
		expect(sessions).toHaveLength(0);
	});

	it("expires a created session and voids its pending reservation", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			listingId: fixture.listingId,
		});

		const expired = await t.mutation(api.markCheckoutSessionExpired, {
			checkoutSessionId: session._id,
		});

		expect(expired?.status).toBe("expired");
		expect(expired?.expiredAt).toBeDefined();
		const reservation = await t.run(async (ctx) =>
			session.reservationId ? ctx.db.get(session.reservationId) : null
		);
		expect(reservation?.status).toBe("voided");
		expect(reservation?.voidJournalEntryId).toBeDefined();
	});

	it("expires stale abandoned sessions in bounded cron batches", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			idempotencyKey: "stale-session",
			listingId: fixture.listingId,
		});

		const result = await t.mutation(api.expireStaleCheckoutSessions, {
			asOf: session.expiresAt + 1,
			limit: 10,
		});

		expect(result).toEqual({ expiredCount: 1, scannedCount: 1 });
		const state = await t.run(async (ctx) => ({
			reservation: session.reservationId
				? await ctx.db.get(session.reservationId)
				: null,
			session: await ctx.db.get(session._id),
		}));
		expect(state.session).toMatchObject({
			status: "expired",
		});
		expect(state.reservation?.status).toBe("voided");
	});

	it("creates exactly one locked deal from a valid Stripe checkout success", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			idempotencyKey: "paid-session",
			listingId: fixture.listingId,
		});
		await attachStripeSession(t, session._id);

		const result = await t.mutation(api.processStripeCheckoutSuccess, {
			providerEventId: "evt_checkout_paid",
			stripeCheckoutSessionId: "cs_test_listing_lock",
			stripePaymentIntentId: "pi_test_lock_fee",
			stripePaymentStatus: "paid",
		});
		const duplicate = await t.mutation(api.processStripeCheckoutSuccess, {
			providerEventId: "evt_checkout_paid_retry",
			stripeCheckoutSessionId: "cs_test_listing_lock",
			stripePaymentIntentId: "pi_test_lock_fee",
			stripePaymentStatus: "paid",
		});

		expect(result.outcome).toBe("deal_created");
		expect(duplicate.outcome).toBe("duplicate_success");
		const state = await t.run(async (ctx) => {
			const sessions = await ctx.db.query("dealLockCheckoutSessions").collect();
			const deals = await ctx.db.query("deals").collect();
			const access = await ctx.db.query("dealAccess").collect();
			const reservation = session.reservationId
				? await ctx.db.get(session.reservationId)
				: null;
			return { access, deals, reservation, sessions };
		});

		expect(state.sessions).toHaveLength(1);
		expect(state.sessions[0]).toMatchObject({
			status: "paid",
			stripePaymentIntentId: "pi_test_lock_fee",
			stripePaymentStatus: "paid",
		});
		expect(state.deals).toHaveLength(1);
		expect(state.deals[0]).toMatchObject({
			buyerId: "buyer-auth",
			dealLockCheckoutSessionId: session._id,
			fractionalShare: 2500,
			lawyerId: "lawyer-auth",
			lawyerType: "platform_lawyer",
			lockFeeCollectionProvider: "stripe_checkout",
			lockFeeCollectionStatus: "collected",
			lockingFeeAmount: DEAL_LOCK_FEE_AMOUNT_CENTS,
			purchasingLenderAuthId: "buyer-auth",
			reservationId: session.reservationId,
			sellerId: CANONICAL_MIC_LENDER_AUTH_ID,
			sellingLenderAuthId: CANONICAL_MIC_LENDER_AUTH_ID,
			status: "lawyerOnboarding.pending",
			stripeCheckoutSessionId: "cs_test_listing_lock",
		});
		expect(state.reservation?.dealId).toBe(String(state.deals[0]?._id));
		expect(state.access).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					persona: "purchasing_lender",
					role: "lender",
					userId: "buyer-auth",
				}),
				expect.objectContaining({
					persona: "selling_lender",
					role: "lender",
					userId: CANONICAL_MIC_LENDER_AUTH_ID,
				}),
				expect.objectContaining({
					persona: "primary_lawyer",
					role: "platform_lawyer",
					userId: "lawyer-auth",
				}),
			])
		);
	});

	it("marks late Stripe success refund-needed and does not create a deal", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			idempotencyKey: "late-session",
			listingId: fixture.listingId,
		});
		await attachStripeSession(t, session._id, "cs_test_late");
		await t.run(async (ctx) => {
			await ctx.db.patch(session._id, { expiresAt: 1 });
		});

		const result = await t.mutation(api.processStripeCheckoutSuccess, {
			providerEventId: "evt_checkout_late",
			stripeCheckoutSessionId: "cs_test_late",
			stripePaymentIntentId: "pi_late",
			stripePaymentStatus: "paid",
		});

		expect(result.outcome).toBe("late_success_refund_needed");
		const state = await t.run(async (ctx) => ({
			deals: await ctx.db.query("deals").collect(),
			reservation: session.reservationId
				? await ctx.db.get(session.reservationId)
				: null,
			session: await ctx.db.get(session._id),
		}));
		expect(state.deals).toHaveLength(0);
		expect(state.session).toMatchObject({
			refundStatus: "needed",
			status: "expired",
		});
		expect(state.reservation?.status).toBe("voided");
	});

	it("marks success after cron expiry refund-needed without creating a deal", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			idempotencyKey: "cron-expired-then-paid",
			listingId: fixture.listingId,
		});
		await attachStripeSession(t, session._id, "cs_test_cron_expired_paid");
		await t.mutation(api.expireStaleCheckoutSessions, {
			asOf: session.expiresAt + 1,
		});

		const result = await t.mutation(api.processStripeCheckoutSuccess, {
			providerEventId: "evt_checkout_cron_late",
			stripeCheckoutSessionId: "cs_test_cron_expired_paid",
			stripePaymentIntentId: "pi_cron_late",
			stripePaymentStatus: "paid",
		});

		expect(result.outcome).toBe("late_success_refund_needed");
		const state = await t.run(async (ctx) => ({
			deals: await ctx.db.query("deals").collect(),
			reservation: session.reservationId
				? await ctx.db.get(session.reservationId)
				: null,
			session: await ctx.db.get(session._id),
		}));
		expect(state.deals).toHaveLength(0);
		expect(state.session).toMatchObject({
			refundStatus: "needed",
			status: "expired",
			stripePaymentIntentId: "pi_cron_late",
			stripePaymentStatus: "paid",
		});
		expect(state.reservation?.status).toBe("voided");
	});

	it("rejects unpaid Stripe checkout success without creating a deal", async () => {
		const fixture = await seedCheckoutFixture(t);
		const session = await prepareCheckout(t, {
			idempotencyKey: "unpaid-session",
			listingId: fixture.listingId,
		});
		await attachStripeSession(t, session._id, "cs_test_unpaid");

		await expect(
			t.mutation(api.processStripeCheckoutSuccess, {
				providerEventId: "evt_checkout_unpaid",
				stripeCheckoutSessionId: "cs_test_unpaid",
				stripePaymentIntentId: "pi_unpaid",
				stripePaymentStatus: "unpaid",
			})
		).rejects.toThrow(ConvexError);

		const state = await t.run(async (ctx) => ({
			deals: await ctx.db.query("deals").collect(),
			session: await ctx.db.get(session._id),
		}));
		expect(state.deals).toHaveLength(0);
		expect(state.session).toMatchObject({
			status: "created",
		});
	});

	it("ignores unknown Stripe checkout sessions without creating a deal", async () => {
		const result = await t.mutation(api.processStripeCheckoutSuccess, {
			providerEventId: "evt_unknown",
			stripeCheckoutSessionId: "cs_unknown",
			stripePaymentIntentId: "pi_unknown",
			stripePaymentStatus: "paid",
		});

		expect(result.outcome).toBe("unknown_session");
		const deals = await t.run(async (ctx) => ctx.db.query("deals").collect());
		expect(deals).toHaveLength(0);
	});
});
