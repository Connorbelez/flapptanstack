import { convexTest } from "convex-test";
import { afterEach, describe, expect, it } from "vitest";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

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
