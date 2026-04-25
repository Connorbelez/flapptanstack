import { createHmac } from "node:crypto";
import type { FunctionReference } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { createWebhookTestHarness } from "../../../src/test/convex/payments/webhooks/convexTestHarness";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import { api, internal } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { canAccessDeal } from "../../auth/resourceChecks";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import { buildCheckoutStripeMetadata } from "../metadata";

const BUYER_AUTH_ID = "handoff-buyer-auth";
const SELLER_LEDGER_LENDER_ID = "handoff-seller-lender";
const STARTED_AT = 1_711_929_000_000;
const TEST_STRIPE_SECRET = "whsec_handoff_test";

type TestHarness = ReturnType<typeof convexTest>;
type SelectedLawyerInput = Doc<"checkoutSessions">["selectedLawyer"];

type DealHandoffResult =
	| {
			ok: true;
			checkoutSessionId: Id<"checkoutSessions">;
			dealId: Id<"deals">;
			packageId?: Id<"dealDocumentPackages">;
			packageStatus?: Doc<"dealDocumentPackages">["status"];
			status: "created" | "already_created";
	  }
	| {
			ok: false;
			code: string;
			message: string;
	  };

const dealHandoffInternal = (
	internal.checkout as typeof internal.checkout & {
		dealHandoff: {
			createDealFromPaidCheckoutInternal: FunctionReference<
				"action",
				"internal",
				{ checkoutSessionId: Id<"checkoutSessions"> },
				DealHandoffResult
			>;
		};
	}
).dealHandoff;

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

function asAdmin(t: TestHarness) {
	return t.withIdentity({
		subject: "handoff-admin",
		issuer: "https://api.workos.com",
		org_id: FAIRLEND_STAFF_ORG_ID,
		organization_name: "FairLend Staff",
		role: "admin",
		roles: JSON.stringify(["admin"]),
		permissions: JSON.stringify(["admin:access", "ledger:correct"]),
		user_email: "handoff-admin@fairlend.ca",
		user_first_name: "Handoff",
		user_last_name: "Admin",
	});
}

function listingFixture(
	overrides: Partial<Omit<Doc<"listings">, "_creationTime" | "_id">>
): Omit<Doc<"listings">, "_creationTime" | "_id"> {
	return {
		adminNotes: undefined,
		approximateLatitude: 43.6532,
		approximateLongitude: -79.3832,
		borrowerSignal: undefined,
		city: "Toronto",
		createdAt: STARTED_AT,
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
		publishedAt: STARTED_AT,
		rateType: "fixed",
		seoSlug: undefined,
		status: "published",
		termMonths: 12,
		title: "Toronto Income Property",
		updatedAt: STARTED_AT,
		viewCount: 10,
		...overrides,
	};
}

function selectedPlatformLawyer() {
	return {
		type: "platform_lawyer" as const,
		lawyerId: "lawyer-auth-123",
		name: "Pat Platform",
		email: "pat.platform@example.com",
		firm: "Platform LLP",
	};
}

function selectedGuestLawyer() {
	return {
		type: "guest_lawyer" as const,
		name: "Gail Guest",
		email: "gail.guest@example.com",
		firm: "Guest LLP",
	};
}

async function insertMortgage(t: TestHarness) {
	return await t.run(async (ctx) => {
		const brokerUserId = await ctx.db.insert("users", {
			authId: "handoff-broker-auth",
			email: "handoff-broker@fairlend.ca",
			firstName: "Handoff",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: STARTED_AT,
			orgId: "org_handoff",
			status: "active",
			userId: brokerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: STARTED_AT,
			postalCode: "M5V1E3",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 240,
			assignedBrokerId: undefined,
			brokerOfRecordId: brokerId,
			createdAt: STARTED_AT,
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
			orgId: "org_handoff",
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

async function setupCheckoutFixture(t: TestHarness) {
	const admin = asAdmin(t);
	await admin.mutation(
		api.ledger.sequenceCounter.initializeSequenceCounter,
		{}
	);
	const mortgageId = await insertMortgage(t);
	await admin.mutation(api.ledger.mutations.mintMortgage, {
		mortgageId: String(mortgageId),
		effectiveDate: "2026-01-01",
		idempotencyKey: `handoff-mint-${String(mortgageId)}`,
		source: { type: "system", channel: "handoff-test" },
	});
	await admin.mutation(internal.ledger.mutations.issueShares, {
		mortgageId: String(mortgageId),
		lenderId: SELLER_LEDGER_LENDER_ID,
		amount: 5000,
		effectiveDate: "2026-01-01",
		idempotencyKey: `handoff-issue-${String(mortgageId)}`,
		source: { type: "system", channel: "handoff-test" },
	});

	return await t.run(async (ctx) => {
		const buyerUserId = await ctx.db.insert("users", {
			authId: BUYER_AUTH_ID,
			email: "buyer.handoff@fairlend.ca",
			firstName: "Buyer",
			lastName: "Handoff",
		});
		await ctx.db.insert("users", {
			authId: selectedPlatformLawyer().lawyerId,
			email: selectedPlatformLawyer().email,
			firstName: "Pat",
			lastName: "Platform",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: STARTED_AT,
			orgId: "org_handoff",
			status: "active",
			userId: buyerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: STARTED_AT,
			onboardingEntryPath: "self_signup",
			orgId: "org_handoff",
			status: "active",
			userId: buyerUserId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: STARTED_AT,
			defaultPostAuthPath: "/listings",
			isPublished: true,
			landingPageId: undefined,
			localHost: "handoff.localhost:3000",
			orgId: "org_handoff",
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "handoff.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "handoff",
			status: "active",
			teaserListingLimit: 12,
			updatedAt: STARTED_AT,
		});
		await ctx.db.patch(buyerUserId, { homePortalId: portalId });
		const listingId = await ctx.db.insert(
			"listings",
			listingFixture({ mortgageId })
		);
		return { lenderId, listingId, mortgageId, portalId };
	});
}

async function prepareCompletedCheckout(
	t: TestHarness,
	args?: { selectedLawyer?: SelectedLawyerInput }
) {
	const hosted = await prepareHostedCheckout(t, args);
	const webhookEventId = await t.run(async (ctx) =>
		ctx.db.insert("webhookEvents", {
			provider: "stripe",
			providerEventId: "evt_handoff_123",
			rawBody: JSON.stringify({ id: "evt_handoff_123" }),
			status: "pending",
			receivedAt: STARTED_AT,
			attempts: 0,
			signatureVerified: true,
			normalizedEventType: "FUNDS_SETTLED",
		})
	);
	await t.mutation(
		internal.checkout.reconciliation.reconcileStripeCheckoutWebhook,
		{
			amount: 25_000,
			currency: "cad",
			kind: "success",
			metadata: hosted.metadata,
			occurredAt: STARTED_AT + 10_000,
			providerEventId: "evt_handoff_123",
			stripeCheckoutSessionId: "cs_handoff_123",
			stripePaymentIntentId: "pi_handoff_123",
			webhookEventId,
		}
	);
	return hosted;
}

async function prepareHostedCheckout(
	t: TestHarness,
	args?: { selectedLawyer?: SelectedLawyerInput }
) {
	const fixture = await setupCheckoutFixture(t);
	const selectedLawyer = args?.selectedLawyer ?? selectedPlatformLawyer();
	const prepared = await t.mutation(
		internal.checkout.mutations.prepareMarketplaceCheckout,
		{
			listingId: fixture.listingId,
			portalId: fixture.portalId,
			requestedFractions: 1000,
			selectedLawyer,
			viewerAuthId: BUYER_AUTH_ID,
			viewerIsFairLendAdmin: false,
		}
	);
	if (!prepared.ok) {
		throw new Error(prepared.message);
	}
	await t.mutation(internal.checkout.mutations.attachProviderSession, {
		checkoutSessionId: prepared.checkoutSessionId,
		stripeCheckoutSessionId: "cs_handoff_123",
		stripePaymentIntentId: "pi_handoff_123",
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
		selectedLawyer,
	});
	return { fixture, metadata, prepared, selectedLawyer };
}

async function insertFailingStaticBlueprint(
	t: TestHarness,
	args: { mortgageId: Id<"mortgages"> }
) {
	await t.run(async (ctx) => {
		const createdByUserId = (await ctx.db.query("users").first())?._id;
		if (!createdByUserId) {
			throw new Error("Expected user fixture");
		}
		await ctx.db.insert("mortgageDocumentBlueprints", {
			archivedAt: undefined,
			archivedByUserId: undefined,
			assetId: undefined,
			category: "private",
			class: "private_static",
			createdAt: STARTED_AT,
			createdByUserId,
			description: "Missing asset blueprint",
			displayName: "Missing Asset",
			displayOrder: 0,
			mortgageId: args.mortgageId,
			packageKey: "closing",
			packageLabel: "Closing",
			sourceDraftId: undefined,
			sourceKind: "asset",
			status: "active",
			templateId: undefined,
			templateSnapshotMeta: undefined,
			templateVersion: undefined,
		});
	});
}

async function runDealHandoff(
	t: TestHarness,
	checkoutSessionId: Id<"checkoutSessions">
) {
	vi.useFakeTimers();
	try {
		const result = await t.action(
			dealHandoffInternal.createDealFromPaidCheckoutInternal,
			{ checkoutSessionId }
		);
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());
		return result;
	} finally {
		vi.clearAllTimers();
		vi.useRealTimers();
	}
}

function buildStripeSignature(body: string) {
	const timestamp = Math.floor(Date.now() / 1000);
	const payload = `${timestamp}.${body}`;
	return `t=${timestamp},v1=${createHmac("sha256", TEST_STRIPE_SECRET)
		.update(payload)
		.digest("hex")}`;
}

async function runStripeWebhook(
	t: TestHarness,
	args: {
		metadata: Record<string, string>;
		providerEventId: string;
	}
) {
	const previousSecret = process.env.STRIPE_WEBHOOK_SECRET;
	process.env.STRIPE_WEBHOOK_SECRET = TEST_STRIPE_SECRET;
	const event = {
		id: args.providerEventId,
		type: "checkout.session.completed",
		created: Math.floor((STARTED_AT + 10_000) / 1000),
		data: {
			object: {
				id: "cs_handoff_123",
				amount_total: 25_000,
				currency: "cad",
				metadata: args.metadata,
				payment_intent: "pi_handoff_123",
			},
		},
	};
	const body = JSON.stringify(event);
	vi.useFakeTimers();
	try {
		const response = await t.fetch("/webhooks/stripe", {
			body,
			headers: {
				"content-type": "application/json",
				"stripe-signature": buildStripeSignature(body),
			},
			method: "POST",
		});
		await t.finishAllScheduledFunctions(() => vi.runAllTimers());
		return response;
	} finally {
		if (previousSecret === undefined) {
			process.env.STRIPE_WEBHOOK_SECRET = undefined;
		} else {
			process.env.STRIPE_WEBHOOK_SECRET = previousSecret;
		}
		vi.clearAllTimers();
		vi.useRealTimers();
	}
}

describe("paid checkout to deal handoff", () => {
	it("creates one deal with checkout, payment, reservation, lender, lawyer, access, and package links", async () => {
		const t = createHarness();
		const { prepared, selectedLawyer } = await prepareCompletedCheckout(t);

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({ ok: true, status: "created" });
		if (!result.ok) {
			throw new Error(result.message);
		}
		const snapshot = await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			const deal = await ctx.db.get(result.dealId);
			const transfer = checkoutSession?.lockFeeTransferRequestId
				? await ctx.db.get(checkoutSession.lockFeeTransferRequestId)
				: null;
			const access = await ctx.db
				.query("dealAccess")
				.withIndex("by_deal", (q) => q.eq("dealId", result.dealId))
				.collect();
			const packages = await ctx.db.query("dealDocumentPackages").collect();
			return { access, checkoutSession, deal, packages, transfer };
		});

		expect(snapshot.checkoutSession?.dealId).toBe(result.dealId);
		expect(snapshot.transfer?.dealId).toBe(result.dealId);
		expect(snapshot.deal).toMatchObject({
			checkoutSessionId: prepared.checkoutSessionId,
			reservationId: prepared.reservationId,
			lockFeeTransferRequestId:
				snapshot.checkoutSession?.lockFeeTransferRequestId,
			stripeCheckoutSessionId: "cs_handoff_123",
			stripePaymentIntentId: "pi_handoff_123",
			lenderId: prepared.lenderId,
			lawyerId: selectedLawyer.lawyerId,
			lawyerType: selectedLawyer.type,
		});
		expect(snapshot.access).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					userId: BUYER_AUTH_ID,
					role: "lender",
					status: "active",
				}),
				expect.objectContaining({
					userId: SELLER_LEDGER_LENDER_ID,
					role: "lender",
					status: "active",
				}),
				expect.objectContaining({
					userId: selectedLawyer.lawyerId,
					role: "platform_lawyer",
					status: "active",
				}),
			])
		);
		expect(snapshot.packages).toHaveLength(1);
		expect(snapshot.packages[0]).toMatchObject({
			dealId: result.dealId,
			status: "ready",
		});
	});

	it("replays duplicate handoff without duplicate deal, package, access, or reservation rows", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t);

		const first = await runDealHandoff(t, prepared.checkoutSessionId);
		expect(first).toMatchObject({ ok: true, status: "created" });
		if (!first.ok) {
			throw new Error("Expected successful handoffs");
		}
		const retryCountAfterFirst = await t.run(async (ctx) => {
			const packageRow = await ctx.db.query("dealDocumentPackages").first();
			return packageRow?.retryCount;
		});
		const second = await runDealHandoff(t, prepared.checkoutSessionId);
		expect(second).toMatchObject({ ok: true, status: "already_created" });
		if (!second.ok) {
			throw new Error("Expected successful handoffs");
		}
		expect(second.dealId).toBe(first.dealId);
		const counts = await t.run(async (ctx) => ({
			access: (await ctx.db.query("dealAccess").collect()).length,
			deals: (await ctx.db.query("deals").collect()).length,
			instances: (await ctx.db.query("dealDocumentInstances").collect()).length,
			packageRows: await ctx.db.query("dealDocumentPackages").collect(),
			packages: (await ctx.db.query("dealDocumentPackages").collect()).length,
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
		}));
		expect(counts.access).toBe(3);
		expect(counts.deals).toBe(1);
		expect(counts.instances).toBe(0);
		expect(counts.packages).toBe(1);
		expect(counts.packageRows[0]?.retryCount).toBe(retryCountAfterFirst);
		expect(counts.reservations).toBe(1);
	});

	it("repairs missing deal checkout links on replay", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t);
		const first = await runDealHandoff(t, prepared.checkoutSessionId);
		if (!first.ok) {
			throw new Error(first.message);
		}
		await t.run(async (ctx) => {
			await ctx.db.patch(first.dealId, {
				checkoutSessionId: undefined,
				lenderId: undefined,
				lockFeeTransferRequestId: undefined,
				reservationId: undefined,
				selectedLawyer: undefined,
				stripeCheckoutSessionId: undefined,
				stripePaymentIntentId: undefined,
			});
		});

		const second = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(second).toMatchObject({ ok: true, status: "already_created" });
		const repairedDeal = await t.run(async (ctx) =>
			first.ok ? ctx.db.get(first.dealId) : null
		);
		expect(repairedDeal).toMatchObject({
			checkoutSessionId: prepared.checkoutSessionId,
			lenderId: prepared.lenderId,
			lockFeeTransferRequestId: expect.any(String),
			reservationId: prepared.reservationId,
			stripeCheckoutSessionId: "cs_handoff_123",
			stripePaymentIntentId: "pi_handoff_123",
		});
	});

	it("rejects replay when an existing checkout deal has conflicting buyer ownership", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t);
		const first = await runDealHandoff(t, prepared.checkoutSessionId);
		if (!first.ok) {
			throw new Error(first.message);
		}
		await t.run(async (ctx) => {
			await ctx.db.patch(first.dealId, { buyerId: "different-buyer-auth" });
		});

		const second = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(second).toMatchObject({
			ok: false,
			code: "deal_link_conflict",
		});
	});

	it("locks an initiated existing deal on replay after partial handoff recovery", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t);
		const first = await runDealHandoff(t, prepared.checkoutSessionId);
		if (!first.ok) {
			throw new Error(first.message);
		}
		await t.run(async (ctx) => {
			await ctx.db.patch(first.dealId, {
				lastTransitionAt: undefined,
				status: "initiated",
			});
		});

		const second = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(second).toMatchObject({ ok: true, status: "already_created" });
		const deal = await t.run((ctx) =>
			first.ok ? ctx.db.get(first.dealId) : null
		);
		expect(deal?.status).toBe("lawyerOnboarding.pending");
	});

	it("rejects handoff when the lock-fee transfer is already linked to another deal", async () => {
		const t = createHarness();
		const { fixture, prepared } = await prepareCompletedCheckout(t);
		await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			if (!checkoutSession?.lockFeeTransferRequestId) {
				throw new Error("Expected lock fee transfer");
			}
			const conflictingDealId = await ctx.db.insert("deals", {
				buyerId: "other-buyer-auth",
				closingDate: undefined,
				createdAt: STARTED_AT,
				createdBy: "test",
				fractionalShare: 1,
				lastTransitionAt: undefined,
				lawyerId: undefined,
				lawyerType: undefined,
				lenderId: undefined,
				lockFeeTransferRequestId: undefined,
				lockingFeeAmount: undefined,
				machineContext: undefined,
				mortgageId: fixture.mortgageId,
				orgId: "org_handoff",
				reservationId: undefined,
				selectedLawyer: undefined,
				sellerId: "other-seller-auth",
				status: "initiated",
				stripeCheckoutSessionId: undefined,
				stripePaymentIntentId: undefined,
				checkoutSessionId: undefined,
			});
			await ctx.db.patch(checkoutSession.lockFeeTransferRequestId, {
				dealId: conflictingDealId,
			});
		});

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({
			ok: false,
			code: "transfer_link_conflict",
		});
		const checkoutSession = await t.run((ctx) =>
			ctx.db.get(prepared.checkoutSessionId)
		);
		expect(checkoutSession?.dealId).toBeUndefined();
	});

	it("rejects non-completed checkout sessions without creating a deal", async () => {
		const t = createHarness();
		const fixture = await setupCheckoutFixture(t);
		const prepared = await t.mutation(
			internal.checkout.mutations.prepareMarketplaceCheckout,
			{
				listingId: fixture.listingId,
				portalId: fixture.portalId,
				requestedFractions: 1000,
				selectedLawyer: selectedPlatformLawyer(),
				viewerAuthId: BUYER_AUTH_ID,
				viewerIsFairLendAdmin: false,
			}
		);
		if (!prepared.ok) {
			throw new Error(prepared.message);
		}

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({
			ok: false,
			code: "checkout_not_completed",
		});
		const deals = await t.run(async (ctx) => ctx.db.query("deals").collect());
		expect(deals).toHaveLength(0);
	});

	it("uses guest lawyer snapshot for deal access and package signatories", async () => {
		const t = createHarness();
		const { prepared, selectedLawyer } = await prepareCompletedCheckout(t, {
			selectedLawyer: {
				...selectedGuestLawyer(),
				email: "Gail.Guest@Example.COM",
			},
		});

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({ ok: true });
		if (!result.ok) {
			throw new Error(result.message);
		}
		const snapshot = await t.run(async (ctx) => {
			const deal = await ctx.db.get(result.dealId);
			const access = await ctx.db
				.query("dealAccess")
				.withIndex("by_deal", (q) => q.eq("dealId", result.dealId))
				.collect();
			return { access, deal };
		});
		const signatories = await t.query(
			internal.documents.dealPackages.resolveDealDocumentSignatoriesInternal,
			{ dealId: result.dealId }
		);
		const guestLawyerCanAccess = await t.run((ctx) =>
			canAccessDeal(
				ctx,
				{
					authId: "guest-lawyer-workos-auth",
					email: selectedLawyer.email.toLowerCase(),
					firstName: "Gail",
					isFairLendAdmin: false,
					lastName: "Guest",
					orgId: undefined,
					orgName: undefined,
					permissions: new Set(),
					role: undefined,
					roles: new Set(),
				},
				result.dealId
			)
		);

		expect(snapshot.deal).toMatchObject({
			lawyerId: selectedLawyer.email.toLowerCase(),
			lawyerType: "guest_lawyer",
		});
		expect(snapshot.access).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					userId: selectedLawyer.email.toLowerCase(),
					role: "guest_lawyer",
					status: "active",
				}),
			])
		);
		expect(signatories).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					platformRole: "lawyer_primary",
					email: selectedLawyer.email,
					name: selectedLawyer.name,
				}),
			])
		);
		expect(guestLawyerCanAccess).toBe(true);
	});

	it("rejects completed checkouts when the lock-fee transfer is missing or not confirmed", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t);
		await t.run(async (ctx) => {
			const checkoutSession = await ctx.db.get(prepared.checkoutSessionId);
			if (!checkoutSession?.lockFeeTransferRequestId) {
				throw new Error("Expected lock fee transfer");
			}
			await ctx.db.patch(checkoutSession.lockFeeTransferRequestId, {
				status: "pending",
			});
		});

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({
			ok: false,
			code: "invalid_lock_fee_transfer",
		});
		const deals = await t.run(async (ctx) => ctx.db.query("deals").collect());
		expect(deals).toHaveLength(0);
	});

	it("rejects platform lawyer selections without a lawyer auth principal", async () => {
		const t = createHarness();
		const { prepared } = await prepareCompletedCheckout(t, {
			selectedLawyer: {
				type: "platform_lawyer",
				name: "Missing Lawyer",
				email: "missing.lawyer@example.com",
				firm: "No Principal LLP",
			},
		});

		const result = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(result).toMatchObject({
			ok: false,
			code: "missing_platform_lawyer_auth_id",
		});
	});

	it("creates and replays checkout handoff through Stripe webhooks without duplicate deal rows", async () => {
		const t = createWebhookTestHarness();
		const { metadata } = await prepareHostedCheckout(t);

		const firstResponse = await runStripeWebhook(t, {
			metadata,
			providerEventId: "evt_handoff_webhook_1",
		});
		const secondResponse = await runStripeWebhook(t, {
			metadata,
			providerEventId: "evt_handoff_webhook_2",
		});

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		await expect(firstResponse.json()).resolves.toMatchObject({
			accepted: true,
			processed: true,
		});
		await expect(secondResponse.json()).resolves.toMatchObject({
			accepted: true,
			processed: true,
		});
		const counts = await t.run(async (ctx) => ({
			access: (await ctx.db.query("dealAccess").collect()).length,
			deals: (await ctx.db.query("deals").collect()).length,
			packages: (await ctx.db.query("dealDocumentPackages").collect()).length,
			reservations: (await ctx.db.query("ledger_reservations").collect())
				.length,
			webhookEvents: (await ctx.db.query("webhookEvents").collect()).length,
		}));
		expect(counts).toEqual({
			access: 3,
			deals: 1,
			packages: 1,
			reservations: 1,
			webhookEvents: 2,
		});
	});

	it("records package failure and retries without duplicating the deal", async () => {
		const t = createHarness();
		const { fixture, prepared } = await prepareCompletedCheckout(t);
		await insertFailingStaticBlueprint(t, { mortgageId: fixture.mortgageId });

		const first = await runDealHandoff(t, prepared.checkoutSessionId);
		const second = await runDealHandoff(t, prepared.checkoutSessionId);

		expect(first).toMatchObject({ ok: true, packageStatus: "failed" });
		expect(second).toMatchObject({ ok: true, status: "already_created" });
		if (!(first.ok && second.ok)) {
			throw new Error("Expected successful handoffs");
		}
		expect(second.dealId).toBe(first.dealId);
		const snapshot = await t.run(async (ctx) => ({
			audits: (await ctx.db.query("auditJournal").collect()).filter(
				(entry) =>
					entry.eventType === "CHECKOUT_DEAL_HANDOFF_FAILED" &&
					entry.reason?.includes("Document package generation finished")
			),
			deals: await ctx.db.query("deals").collect(),
			failedInstances: (
				await ctx.db.query("dealDocumentInstances").collect()
			).filter((instance) => instance.status === "generation_failed"),
			packages: await ctx.db.query("dealDocumentPackages").collect(),
		}));
		expect(snapshot.deals).toHaveLength(1);
		expect(snapshot.audits.length).toBeGreaterThanOrEqual(1);
		expect(snapshot.packages).toHaveLength(1);
		expect(snapshot.packages[0]).toMatchObject({
			dealId: first.dealId,
			status: "failed",
			lastError: "Static blueprint is missing its source asset",
		});
		expect(snapshot.packages[0]?.retryCount).toBeGreaterThanOrEqual(1);
		expect(snapshot.failedInstances.length).toBeGreaterThanOrEqual(1);
	});
});
