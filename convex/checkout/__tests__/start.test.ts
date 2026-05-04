import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { buildCheckoutStripeMetadata } from "../metadata";

const BUYER_AUTH_ID = "checkout-buyer-auth";
const SELLER_LEDGER_LENDER_ID = "seller-domain-lender";

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function asAdmin(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: "checkout-admin",
		issuer: "https://api.workos.com",
		org_id: FAIRLEND_STAFF_ORG_ID,
		organization_name: "FairLend Staff",
		role: "admin",
		roles: JSON.stringify(["admin"]),
		permissions: JSON.stringify(["admin:access", "ledger:correct"]),
		user_email: "checkout-admin@fairlend.ca",
		user_first_name: "Checkout",
		user_last_name: "Admin",
	});
}

function asCheckoutBuyer(t: ReturnType<typeof createHarness>) {
	return t.withIdentity({
		subject: BUYER_AUTH_ID,
		issuer: "https://api.workos.com",
		org_id: "org_checkout",
		organization_name: "Checkout Broker",
		role: "lender",
		roles: JSON.stringify(["lender"]),
		permissions: JSON.stringify(["listing:invest", "listing:view"]),
		user_email: "buyer@fairlend.ca",
		user_first_name: "Buyer",
		user_last_name: "Lender",
	});
}

const originalFetch = globalThis.fetch;
const originalStripeSecretKey = process.env.STRIPE_SECRET_KEY;
const originalStripeSuccessUrl = process.env.STRIPE_CHECKOUT_SUCCESS_URL;
const originalStripeCancelUrl = process.env.STRIPE_CHECKOUT_CANCEL_URL;

function restoreEnv(name: string, value: string | undefined) {
	if (value === undefined) {
		process.env[name] = "";
		return;
	}
	process.env[name] = value;
}

afterEach(() => {
	Object.defineProperty(globalThis, "fetch", {
		configurable: true,
		writable: true,
		value: originalFetch,
	});
	restoreEnv("STRIPE_SECRET_KEY", originalStripeSecretKey);
	restoreEnv("STRIPE_CHECKOUT_SUCCESS_URL", originalStripeSuccessUrl);
	restoreEnv("STRIPE_CHECKOUT_CANCEL_URL", originalStripeCancelUrl);
});

function listingFixture(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">>
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
	return {
		adminNotes: undefined,
		approximateLatitude: 43.6532,
		approximateLongitude: -79.3832,
		borrowerSignal: undefined,
		city: "Toronto",
		createdAt: 1_710_000_000_000,
		dataSource: "mortgage_pipeline",
		delistReason: undefined,
		delistedAt: undefined,
		description: "Listing description",
		displayOrder: undefined,
		featured: false,
		heroImages: [],
		interestRate: 8.5,
		lastTransitionAt: undefined,
		lienPosition: 1,
		loanType: "conventional",
		ltvRatio: 0.65,
		machineContext: undefined,
		marketplaceCopy: "Marketplace copy",
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
		publishedAt: 1_710_000_000_000,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 12,
		title: "Toronto Income Property",
		updatedAt: 1_710_000_000_000,
		viewCount: 10,
		...overrides,
	};
}

async function insertMortgage(t: ReturnType<typeof createHarness>) {
	return await t.run(async (ctx) => {
		const brokerUserId = await ctx.db.insert("users", {
			authId: "checkout-broker-auth",
			email: "checkout-broker@fairlend.ca",
			firstName: "Checkout",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1_710_000_000_000,
			orgId: "org_checkout",
			status: "active",
			userId: brokerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: 1_710_000_000_000,
			postalCode: "M5V1E3",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: undefined,
			brokerOfRecordId: brokerId,
			createdAt: 1_710_000_000_000,
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
			orgId: "org_checkout",
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
		return mortgageId;
	});
}

async function setupCheckoutFixture(t: ReturnType<typeof createHarness>) {
	const admin = asAdmin(t);
	await admin.mutation(
		api.ledger.sequenceCounter.initializeSequenceCounter,
		{}
	);
	const mortgageId = await insertMortgage(t);
	await admin.mutation(api.ledger.mutations.mintMortgage, {
		mortgageId: String(mortgageId),
		effectiveDate: "2026-01-01",
		idempotencyKey: `mint-${String(mortgageId)}`,
		source: { type: "system", channel: "checkout-test" },
	});
	await admin.mutation(internal.ledger.mutations.issueShares, {
		mortgageId: String(mortgageId),
		lenderId: SELLER_LEDGER_LENDER_ID,
		amount: 5000,
		effectiveDate: "2026-01-01",
		idempotencyKey: `issue-${String(mortgageId)}`,
		source: { type: "system", channel: "checkout-test" },
	});

	return await t.run(async (ctx) => {
		const buyerUserId = await ctx.db.insert("users", {
			authId: BUYER_AUTH_ID,
			email: "buyer@fairlend.ca",
			firstName: "Buyer",
			lastName: "Lender",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1_710_000_000_000,
			orgId: "org_checkout",
			status: "active",
			userId: buyerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: 1_710_000_000_000,
			onboardingEntryPath: "self_signup",
			orgId: "org_checkout",
			status: "active",
			userId: buyerUserId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: 1_710_000_000_000,
			defaultPostAuthPath: "/listings",
			isPublished: true,
			landingPageId: undefined,
			localHost: "checkout.localhost:3000",
			orgId: "org_checkout",
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "checkout.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "checkout",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: 1_710_000_000_000,
		});
		await ctx.db.patch(buyerUserId, { homePortalId: portalId });
		const listingId = await ctx.db.insert(
			"listings",
			listingFixture({ mortgageId })
		);
		return { lenderId, listingId, mortgageId, portalId };
	});
}

function selectedLawyer() {
	return {
		type: "platform_lawyer" as const,
		lawyerId: "lawyer_123",
		name: "Pat Lawyer",
		email: "pat@example.com",
	};
}

async function prepare(
	t: ReturnType<typeof createHarness>,
	args: {
		listingId: Id<"listings">;
		portalId: Id<"portals">;
		requestedFractions?: number;
		selectedLawyer?: ReturnType<typeof selectedLawyer>;
		viewerAuthId?: string;
	}
) {
	return await t.mutation(
		internal.checkout.mutations.prepareMarketplaceCheckout,
		{
			listingId: args.listingId,
			portalId: args.portalId,
			requestedFractions: args.requestedFractions ?? 1000,
			selectedLawyer: args.selectedLawyer ?? selectedLawyer(),
			viewerAuthId: args.viewerAuthId ?? BUYER_AUTH_ID,
			viewerIsFairLendAdmin: false,
		}
	);
}

async function insertAdditionalPortalLender(
	t: ReturnType<typeof createHarness>,
	args: { authId: string; portalId: Id<"portals"> }
) {
	return await t.run(async (ctx) => {
		const portal = await ctx.db.get(args.portalId);
		if (!portal?.brokerId) {
			throw new Error("Expected broker portal");
		}
		const userId = await ctx.db.insert("users", {
			authId: args.authId,
			email: `${args.authId}@fairlend.ca`,
			firstName: "Second",
			lastName: "Buyer",
			homePortalId: args.portalId,
		});
		return await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId: portal.brokerId,
			createdAt: 1_710_000_000_000,
			onboardingEntryPath: "self_signup",
			orgId: portal.orgId,
			status: "active",
			userId,
		});
	});
}

describe("checkout start internal mutations", () => {
	it("prepares a reservation and checkout session in one transaction", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);

		const result = await prepare(t, fixture);

		expect(result.ok).toBe(true);
		if (!result.ok) {
			throw new Error(result.message);
		}
		expect(result.idempotencyKey).toBe(
			`marketplace-checkout:${String(result.checkoutSessionId)}`
		);

		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(result.checkoutSessionId);
			const reservation = await ctx.db.get(result.reservationId);
			const sellerAccount = reservation
				? await ctx.db.get(reservation.sellerAccountId)
				: null;
			return { checkoutSession, reservation, sellerAccount };
		});

		expect(snapshot.checkoutSession).toMatchObject({
			status: "preparing_provider_session",
			listingId: fixture.listingId,
			portalId: fixture.portalId,
			lenderId: fixture.lenderId,
			requestedFractions: 1000,
			lockFeeAmount: 25_000,
			lockFeeCurrency: "CAD",
		});
		expect(snapshot.reservation).toMatchObject({
			status: "pending",
			amount: 1000,
			mortgageId: String(fixture.mortgageId),
		});
		expect(snapshot.sellerAccount?.pendingCredits).toBe(1_000n);
	});

	it("attaches provider identifiers before hosted checkout success", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		const prepared = await prepare(t, fixture);
		if (!prepared.ok) {
			throw new Error(prepared.message);
		}

		const attached = await t.mutation(
			internal.checkout.mutations.attachProviderSession,
			{
				checkoutSessionId: prepared.checkoutSessionId,
				stripeCheckoutSessionId: "cs_test_123",
				stripePaymentIntentId: "pi_test_123",
			}
		);

		expect(attached.ok).toBe(true);
		const checkoutSession = await t.run(async (ctx) =>
			ctx.db.get(prepared.checkoutSessionId)
		);
		expect(checkoutSession).toMatchObject({
			status: "hosted_checkout_open",
			stripeCheckoutSessionId: "cs_test_123",
			stripePaymentIntentId: "pi_test_123",
		});
	});

	it("compensates provider-start failure by voiding the reservation", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		const prepared = await prepare(t, fixture);
		if (!prepared.ok) {
			throw new Error(prepared.message);
		}

		await t.mutation(internal.checkout.mutations.markProviderStartFailed, {
			checkoutSessionId: prepared.checkoutSessionId,
			failureReason: "stripe timeout",
		});

		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			const reservation = await ctx.db.get(prepared.reservationId);
			const sellerAccount = reservation
				? await ctx.db.get(reservation.sellerAccountId)
				: null;
			return { checkoutSession, reservation, sellerAccount };
		});

		expect(snapshot.checkoutSession).toMatchObject({
			status: "provider_start_failed",
			failureReason: "stripe timeout",
		});
		expect(snapshot.reservation).toMatchObject({ status: "voided" });
		expect(snapshot.sellerAccount?.pendingCredits).toBe(0n);
	});

	it("rejects demo listings before creating locks", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		await t.run(async (ctx) => {
			await ctx.db.patch(fixture.listingId, {
				dataSource: "demo",
				mortgageId: undefined,
			});
		});

		const result = await prepare(t, fixture);

		expect(result).toMatchObject({
			ok: false,
			code: "demo_listing_not_supported",
		});
		const counts = await t.run(async (ctx) => ({
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
			checkouts: (await ctx.db.query("checkoutSessions").collect()).length,
		}));
		expect(counts).toEqual({ reservations: 0, checkouts: 0 });
	});

	it("rejects requests above server-derived availability", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);

		const result = await prepare(t, {
			...fixture,
			requestedFractions: 5001,
		});

		expect(result).toMatchObject({
			ok: false,
			code: "insufficient_fractions",
		});
	});

	it("rejects malformed lawyer snapshots before creating locks", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);

		const result = await prepare(t, {
			...fixture,
			selectedLawyer: {
				...selectedLawyer(),
				email: "",
			},
		});

		expect(result).toMatchObject({
			ok: false,
			code: "invalid_lawyer",
		});
		const counts = await t.run(async (ctx) => ({
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
			checkouts: (await ctx.db.query("checkoutSessions").collect()).length,
		}));
		expect(counts).toEqual({ reservations: 0, checkouts: 0 });
	});

	it("replays duplicate active starts without creating a second reservation", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);

		const first = await prepare(t, fixture);
		const second = await prepare(t, fixture);

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!(first.ok && second.ok)) {
			throw new Error("expected successful duplicate prepare");
		}
		expect(second.checkoutSessionId).toBe(first.checkoutSessionId);
		const counts = await t.run(async (ctx) => ({
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
			checkouts: (await ctx.db.query("checkoutSessions").collect()).length,
		}));
		expect(counts).toEqual({ reservations: 1, checkouts: 1 });
	});

	it("does not replay a duplicate start with a different lawyer snapshot", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);

		const first = await prepare(t, fixture);
		const second = await prepare(t, {
			...fixture,
			selectedLawyer: {
				...selectedLawyer(),
				lawyerId: "lawyer_456",
				name: "Casey Lawyer",
				email: "casey@example.com",
			},
		});

		expect(first.ok).toBe(true);
		expect(second.ok).toBe(true);
		if (!(first.ok && second.ok)) {
			throw new Error("expected successful prepares");
		}
		expect(second.checkoutSessionId).not.toBe(first.checkoutSessionId);
		const counts = await t.run(async (ctx) => ({
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
			checkouts: (await ctx.db.query("checkoutSessions").collect()).length,
		}));
		expect(counts).toEqual({ reservations: 2, checkouts: 2 });
	});

	it("prevents oversell when two lenders request the last available fractions", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		const secondBuyerAuthId = "checkout-buyer-auth-2";
		await insertAdditionalPortalLender(t, {
			authId: secondBuyerAuthId,
			portalId: fixture.portalId,
		});

		const [first, second] = await Promise.all([
			prepare(t, { ...fixture, requestedFractions: 3000 }),
			prepare(t, {
				...fixture,
				requestedFractions: 3000,
				viewerAuthId: secondBuyerAuthId,
			}),
		]);

		const successes = [first, second].filter((result) => result.ok);
		const failures = [first, second].filter((result) => !result.ok);
		expect(successes).toHaveLength(1);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatchObject({
			ok: false,
			code: "insufficient_fractions",
		});
		const reservations = await t.run(async (ctx) =>
			ctx.db.query("ledger_reservations").collect()
		);
		expect(reservations).toHaveLength(1);
		expect(reservations[0]?.amount).toBe(3000);
	});

	it("starts hosted checkout only after provider identifiers are attached", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		process.env.STRIPE_SECRET_KEY = "sk_test_checkout";
		process.env.STRIPE_CHECKOUT_SUCCESS_URL =
			"https://portal.example.com/success";
		process.env.STRIPE_CHECKOUT_CANCEL_URL =
			"https://portal.example.com/cancel";
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: async () =>
				new Response(
					JSON.stringify({
						id: "cs_test_action",
						url: "https://checkout.stripe.test/action",
						payment_intent: "pi_test_action",
					}),
					{ status: 200 }
				),
		});

		const result = await asCheckoutBuyer(t).action(
			api.checkout.actions.startMarketplaceCheckout,
			{
				listingId: fixture.listingId,
				portalId: fixture.portalId,
				requestedFractions: 1000,
				selectedLawyer: selectedLawyer(),
			}
		);

		expect(result).toMatchObject({
			ok: true,
			stripeCheckoutUrl: "https://checkout.stripe.test/action",
		});
		if (!result.ok) {
			throw new Error(result.message);
		}
		const checkoutSession = await t.run(async (ctx) =>
			ctx.db.get(result.checkoutSessionId)
		);
		expect(checkoutSession).toMatchObject({
			status: "hosted_checkout_open",
			stripeCheckoutSessionId: "cs_test_action",
			stripePaymentIntentId: "pi_test_action",
		});
	});

	it("compensates the reservation when provider configuration is missing", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		process.env.STRIPE_SECRET_KEY = "";
		process.env.STRIPE_CHECKOUT_SUCCESS_URL =
			"https://portal.example.com/success";
		process.env.STRIPE_CHECKOUT_CANCEL_URL =
			"https://portal.example.com/cancel";

		const result = await asCheckoutBuyer(t).action(
			api.checkout.actions.startMarketplaceCheckout,
			{
				listingId: fixture.listingId,
				portalId: fixture.portalId,
				requestedFractions: 1000,
				selectedLawyer: selectedLawyer(),
			}
		);

		expect(result).toMatchObject({
			ok: false,
			code: "provider_start_failed",
		});
		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = (
				await ctx.db.query("checkoutSessions").collect()
			)[0];
			const reservation = checkoutSession
				? await ctx.db.get(checkoutSession.reservationId)
				: null;
			return { checkoutSession, reservation };
		});
		expect(snapshot.checkoutSession).toMatchObject({
			status: "provider_start_failed",
			failureReason: "STRIPE_SECRET_KEY is not configured",
		});
		expect(snapshot.reservation).toMatchObject({ status: "voided" });
	});
});

describe("checkout Stripe reconciliation", () => {
	async function prepareHostedCheckout(t: ReturnType<typeof createHarness>) {
		const fixture = await setupCheckoutFixture(t);
		const prepared = await prepare(t, fixture);
		if (!prepared.ok) {
			throw new Error(prepared.message);
		}
		await t.mutation(internal.checkout.mutations.attachProviderSession, {
			checkoutSessionId: prepared.checkoutSessionId,
			stripeCheckoutSessionId: "cs_test_reconcile",
			stripePaymentIntentId: "pi_test_reconcile",
		});
		const metadata = buildCheckoutStripeMetadata({
			checkoutSessionId: String(prepared.checkoutSessionId),
			idempotencyKey: prepared.idempotencyKey,
			lenderAuthId: prepared.lenderAuthId,
			lenderId: prepared.lenderId,
			listingId: prepared.listingId,
			mortgageId: prepared.mortgageId,
			portalId: prepared.portalId,
			requestedFractions: prepared.requestedFractions,
			reservationId: prepared.reservationId,
			selectedLawyer: prepared.selectedLawyer,
		});
		return { fixture, metadata, prepared };
	}

	async function insertStripeWebhookEvent(
		t: ReturnType<typeof createHarness>,
		providerEventId: string
	) {
		return await t.run(async (ctx) =>
			ctx.db.insert("webhookEvents", {
				provider: "stripe",
				providerEventId,
				rawBody: JSON.stringify({ id: providerEventId }),
				status: "pending",
				receivedAt: Date.now(),
				attempts: 0,
				signatureVerified: true,
				normalizedEventType: "FUNDS_SETTLED",
			})
		);
	}

	it("reconciles one active Stripe success into one confirmed lock-fee transfer", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_success_001");

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_success_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({ ok: true, status: "completed" });
		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			const transfers = await ctx.db.query("transferRequests").collect();
			const webhookEvent = await ctx.db.get(webhookEventId);
			return { checkoutSession, transfers, webhookEvent };
		});
		expect(snapshot.checkoutSession).toMatchObject({
			status: "completed",
			stripeCheckoutSessionId: "cs_test_reconcile",
			stripePaymentIntentId: "pi_test_reconcile",
		});
		expect(snapshot.transfers).toHaveLength(1);
		expect(snapshot.transfers[0]).toMatchObject({
			amount: 25_000,
			counterpartyId: String(prepared.lenderId),
			direction: "inbound",
			providerCode: "stripe",
			providerRef: "pi_test_reconcile",
			status: "confirmed",
			transferType: "locking_fee_collection",
		});
		expect(snapshot.webhookEvent).toMatchObject({
			status: "processed",
			transferRequestId: snapshot.transfers[0]?._id,
		});
	});

	it("rejects Stripe success with a mismatched lock fee amount", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_bad_amount_001"
		);

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 10_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_bad_amount_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			transfers: await ctx.db.query("transferRequests").collect(),
			webhookEvent: await ctx.db.get(webhookEventId),
		}));
		expect(result).toMatchObject({
			ok: false,
			error: "stripe_checkout_amount_mismatch",
		});
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.checkoutSession).toMatchObject({
			status: "hosted_checkout_open",
			failureReason: "stripe_checkout_amount_mismatch",
		});
		expect(snapshot.webhookEvent).toMatchObject({
			status: "failed",
			error: "stripe_checkout_amount_mismatch",
		});
	});

	it("rejects Stripe success with a mismatched lock fee currency", async () => {
		const t = createHarness();
		const { metadata } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_bad_currency_001"
		);

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "usd",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_bad_currency_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({
			ok: false,
			error: "stripe_checkout_currency_mismatch",
		});
	});

	it("replays duplicate Stripe success without duplicating transfer records", async () => {
		const t = createHarness();
		const { metadata } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_success_dupe"
		);
		const args = {
			amount: 25_000,
			currency: "cad",
			kind: "success" as const,
			metadata,
			occurredAt: 1_711_929_600_000,
			providerEventId: "evt_success_dupe",
			stripeCheckoutSessionId: "cs_test_reconcile",
			stripePaymentIntentId: "pi_test_reconcile",
			webhookEventId,
		};

		await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			args
		);
		await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			args
		);

		const counts = await t.run(async (ctx) => ({
			transfers: (await ctx.db.query("transferRequests").collect()).length,
			webhookEvent: await ctx.db.get(webhookEventId),
		}));
		expect(counts.transfers).toBe(1);
		expect(counts.webhookEvent).toMatchObject({
			status: "processed",
			attempts: 2,
		});
	});

	it("keeps a failed payment retryable while reservation TTL is active", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_failed_001");

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				failureReason: "card_declined",
				kind: "failure",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_failed_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({
			ok: true,
			status: "payment_failed_retryable",
		});
		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			const reservation = checkoutSession
				? await ctx.db.get(checkoutSession.reservationId)
				: null;
			return { checkoutSession, reservation };
		});
		expect(snapshot.checkoutSession).toMatchObject({
			status: "payment_failed_retryable",
			failureReason: "card_declined",
		});
		expect(snapshot.reservation).toMatchObject({ status: "pending" });
	});

	it("keeps a PaymentIntent failure retryable without a Checkout Session event id", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_pi_failed_001"
		);

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				failureReason: "card_declined",
				kind: "failure",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_pi_failed_001",
				stripePaymentIntentId: "pi_test_reconcile_failed",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({
			ok: true,
			status: "payment_failed_retryable",
		});
		const checkoutSession = await t.run((ctx) =>
			ctx.db.get(prepared.checkoutSessionId)
		);
		expect(checkoutSession).toMatchObject({
			status: "payment_failed_retryable",
			stripeCheckoutSessionId: "cs_test_reconcile",
			stripePaymentIntentId: "pi_test_reconcile_failed",
		});
	});

	it("records late-success refund intent without creating a transfer", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_late_001");
		await t.run(async (ctx) => {
			await ctx.db.patch(prepared.checkoutSessionId, {
				status: "expired",
				resolvedAt: Date.now(),
			});
		});

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_late_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({ ok: true, status: "refund_required" });
		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			transfers: await ctx.db.query("transferRequests").collect(),
		}));
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.checkoutSession).toMatchObject({
			status: "refunded_late_success",
			lateSuccessRefund: {
				status: "intent_recorded",
				amount: 25_000,
				paymentIntentId: "pi_test_reconcile",
				providerEventId: "evt_late_001",
			},
		});
	});

	it("does not create a second refund intent for a second late-success event", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const firstWebhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_late_dupe_first"
		);
		const secondWebhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_late_dupe_second"
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(prepared.checkoutSessionId, {
				status: "expired",
				resolvedAt: Date.now(),
			});
		});
		const firstArgs = {
			amount: 25_000,
			currency: "cad",
			kind: "success" as const,
			metadata,
			occurredAt: 1_711_929_600_000,
			providerEventId: "evt_late_dupe_first",
			stripeCheckoutSessionId: "cs_test_reconcile",
			stripePaymentIntentId: "pi_test_reconcile",
			webhookEventId: firstWebhookEventId,
		};

		const first = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			firstArgs
		);
		const second = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				...firstArgs,
				providerEventId: "evt_late_dupe_second",
				webhookEventId: secondWebhookEventId,
			}
		);

		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			firstWebhook: await ctx.db.get(firstWebhookEventId),
			secondWebhook: await ctx.db.get(secondWebhookEventId),
			transfers: await ctx.db.query("transferRequests").collect(),
		}));
		expect(first).toMatchObject({ ok: true, status: "refund_required" });
		expect(second).toMatchObject({
			ok: true,
			status: "refund_already_recorded",
		});
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.checkoutSession?.lateSuccessRefund).toMatchObject({
			idempotencyKey:
				"checkout-late-success-refund:" +
				String(prepared.checkoutSessionId) +
				":pi_test_reconcile",
			providerEventId: "evt_late_dupe_first",
		});
		expect(snapshot.firstWebhook).toMatchObject({ status: "pending" });
		expect(snapshot.secondWebhook).toMatchObject({ status: "processed" });
	});

	it("fails a second late-success event with a different PaymentIntent", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const firstWebhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_late_intent_first"
		);
		const secondWebhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_late_intent_second"
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(prepared.checkoutSessionId, {
				status: "expired",
				resolvedAt: Date.now(),
			});
		});
		const first = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_late_intent_first",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId: firstWebhookEventId,
			}
		);
		const second = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_late_intent_second",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_other",
				webhookEventId: secondWebhookEventId,
			}
		);

		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			secondWebhook: await ctx.db.get(secondWebhookEventId),
			transfers: await ctx.db.query("transferRequests").collect(),
		}));
		expect(first).toMatchObject({ ok: true, status: "refund_required" });
		expect(second).toMatchObject({
			ok: false,
			error: "late_success_refund_payment_intent_mismatch",
		});
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.checkoutSession?.lateSuccessRefund).toMatchObject({
			paymentIntentId: "pi_test_reconcile",
			providerEventId: "evt_late_intent_first",
		});
		expect(snapshot.secondWebhook).toMatchObject({
			status: "failed",
			error: "late_success_refund_payment_intent_mismatch",
		});
	});

	it("retries failed late-success refunds with the stored idempotency key", async () => {
		process.env.STRIPE_SECRET_KEY = "sk_test_retry";
		const calls: Array<{ body: string; headers: HeadersInit | undefined }> = [];
		Object.defineProperty(globalThis, "fetch", {
			configurable: true,
			writable: true,
			value: async (_url: string, init?: RequestInit) => {
				calls.push({
					body: String(init?.body),
					headers: init?.headers,
				});
				return new Response(JSON.stringify({ id: "re_retry_001" }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
		});
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_late_retry");
		await t.run(async (ctx) => {
			await ctx.db.patch(prepared.checkoutSessionId, {
				status: "expired",
				resolvedAt: Date.now(),
			});
		});
		const reconciled = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_late_retry",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_retry",
				webhookEventId,
			}
		);
		if (!(reconciled.ok && reconciled.status === "refund_required")) {
			throw new Error("expected refund-required reconciliation result");
		}
		await t.mutation(internal.checkout.refunds.failLateSuccessRefund, {
			checkoutSessionId: prepared.checkoutSessionId,
			error: "temporary_stripe_outage",
			providerEventId: "evt_late_retry",
			webhookEventId,
		});

		const retry = await asAdmin(t).action(
			api.checkout.refunds.retryLateSuccessRefundAdmin,
			{ checkoutSessionId: prepared.checkoutSessionId }
		);

		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			webhookEvent: await ctx.db.get(webhookEventId),
		}));
		expect(retry).toMatchObject({
			ok: true,
			stripeRefundId: "re_retry_001",
		});
		expect(calls).toHaveLength(1);
		expect(calls[0]?.body).toContain("payment_intent=pi_test_retry");
		expect(calls[0]?.headers).toMatchObject({
			"Idempotency-Key":
				"checkout-late-success-refund:" +
				String(prepared.checkoutSessionId) +
				":pi_test_retry",
		});
		expect(snapshot.checkoutSession?.lateSuccessRefund).toMatchObject({
			status: "completed",
			stripeRefundId: "re_retry_001",
		});
		expect(snapshot.checkoutSession?.lateSuccessRefund).not.toHaveProperty(
			"error"
		);
		expect(snapshot.webhookEvent).toMatchObject({
			status: "processed",
		});
		expect(snapshot.webhookEvent).not.toHaveProperty("error");
	});

	it("exposes a safe owned checkout status polling path", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_poll_001");

		const before = await asCheckoutBuyer(t).query(
			api.checkout.queries.getMarketplaceCheckoutStatus,
			{ checkoutSessionId: prepared.checkoutSessionId }
		);
		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_poll_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);
		const after = await asCheckoutBuyer(t).query(
			api.checkout.queries.getMarketplaceCheckoutStatus,
			{ checkoutSessionId: prepared.checkoutSessionId }
		);
		const repeated = await asCheckoutBuyer(t).query(
			api.checkout.queries.getMarketplaceCheckoutStatus,
			{ checkoutSessionId: prepared.checkoutSessionId }
		);
		const counts = await t.run(async (ctx) => ({
			transfers: (await ctx.db.query("transferRequests").collect()).length,
			webhookEvents: (await ctx.db.query("webhookEvents").collect()).length,
		}));

		expect(before).toMatchObject({
			checkoutSessionId: prepared.checkoutSessionId,
			status: "hosted_checkout_open",
		});
		expect(result).toMatchObject({ ok: true, status: "completed" });
		expect(after).toMatchObject({
			checkoutSessionId: prepared.checkoutSessionId,
			status: "completed",
			stripeCheckoutSessionId: "cs_test_reconcile",
		});
		expect(repeated).toEqual(after);
		expect(counts).toEqual({ transfers: 1, webhookEvents: 1 });
	});

	it("records active-but-expired success as late-success refund intent", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_active_expired_001"
		);
		await t.run(async (ctx) => {
			await ctx.db.patch(prepared.checkoutSessionId, {
				expiresAt: Date.now() - 1,
			});
		});

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata,
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_active_expired_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			transfers: await ctx.db.query("transferRequests").collect(),
		}));
		expect(result).toMatchObject({ ok: true, status: "refund_required" });
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.checkoutSession).toMatchObject({
			status: "refunded_late_success",
			lateSuccessRefund: {
				status: "intent_recorded",
				amount: 25_000,
				paymentIntentId: "pi_test_reconcile",
				providerEventId: "evt_active_expired_001",
			},
		});
	});

	it("fails unknown checkout sessions without creating a transfer", async () => {
		const t = createHarness();
		const { metadata } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(t, "evt_unknown_001");

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata: { ...metadata, checkoutSessionId: "missing_checkout" },
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_unknown_001",
				stripeCheckoutSessionId: "cs_unknown_reconcile",
				stripePaymentIntentId: "pi_unknown_reconcile",
				webhookEventId,
			}
		);

		const snapshot = await t.run(async (ctx) => ({
			transfers: await ctx.db.query("transferRequests").collect(),
			webhookEvent: await ctx.db.get(webhookEventId),
		}));
		expect(result).toMatchObject({
			ok: false,
			error: "checkout_session_not_found",
		});
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.webhookEvent).toMatchObject({
			status: "failed",
			error: "checkout_session_not_found",
		});
	});

	it("rejects conflicting metadata without completing checkout", async () => {
		const t = createHarness();
		const { metadata, prepared } = await prepareHostedCheckout(t);
		const webhookEventId = await insertStripeWebhookEvent(
			t,
			"evt_conflict_001"
		);

		const result = await t.mutation(
			internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
			{
				amount: 25_000,
				currency: "cad",
				kind: "success",
				metadata: { ...metadata, lenderId: "different_lender" },
				occurredAt: 1_711_929_600_000,
				providerEventId: "evt_conflict_001",
				stripeCheckoutSessionId: "cs_test_reconcile",
				stripePaymentIntentId: "pi_test_reconcile",
				webhookEventId,
			}
		);

		expect(result).toMatchObject({
			ok: false,
			error: "Stripe checkout metadata lenderId mismatch",
		});
		const snapshot = await t.run(async (ctx) => ({
			checkoutSession: await ctx.db.get(prepared.checkoutSessionId),
			transfers: await ctx.db.query("transferRequests").collect(),
			webhookEvent: await ctx.db.get(webhookEventId),
		}));
		expect(snapshot.checkoutSession).toMatchObject({
			status: "hosted_checkout_open",
			failureReason: "Stripe checkout metadata lenderId mismatch",
		});
		expect(snapshot.transfers).toHaveLength(0);
		expect(snapshot.webhookEvent).toMatchObject({ status: "failed" });
	});
});
