import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
	seedFromIdentity,
} from "../../../src/test/auth/helpers";
import {
	BORROWER,
	BROKER,
	FAIRLEND_ADMIN,
	LENDER,
} from "../../../src/test/auth/identities";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";

const NOW = Date.now();

const MISMATCHED_BORROWER = createMockViewer({
	roles: ["borrower"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_borrower_portal_mismatch",
	email: "borrower-portal-mismatch@test.fairlend.ca",
	firstName: "Borrower",
	lastName: "Mismatch",
});

const MISMATCHED_LENDER = createMockViewer({
	roles: ["lender"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_lender_portal_mismatch",
	email: "lender-portal-mismatch@test.fairlend.ca",
	firstName: "Lender",
	lastName: "Mismatch",
});

const MISSING_ORG_BORROWER = createMockViewer({
	roles: ["borrower"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_borrower_missing_org",
	email: "borrower-missing-org@test.fairlend.ca",
	firstName: "Borrower",
	lastName: "MissingOrg",
});

const UNMAPPED_ORG_BORROWER = createMockViewer({
	roles: ["borrower"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_borrower_unmapped_org",
	email: "borrower-unmapped-org@test.fairlend.ca",
	firstName: "Borrower",
	lastName: "UnmappedOrg",
});

const MULTI_PORTAL_BORROWER = createMockViewer({
	roles: ["borrower"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_borrower_multi_portal",
	email: "borrower-multi-portal@test.fairlend.ca",
	firstName: "Borrower",
	lastName: "MultiPortal",
});

const SAME_ORG_WRONG_BROKER_LENDER = createMockViewer({
	roles: ["lender"],
	orgId: BROKER.org_id,
	orgName: BROKER.organization_name,
	subject: "user_lender_same_org_wrong_broker",
	email: "lender-same-org-wrong-broker@test.fairlend.ca",
	firstName: "Lender",
	lastName: "WrongBroker",
});

function createHarness() {
	return createTestConvex();
}

function buildPortalRecord(overrides: {
	brokerId?: Id<"brokers">;
	isPublished?: boolean;
	localHost: string;
	orgId: string;
	portalType?: "broker" | "fairlend";
	productionHost: string;
	slug: string;
	status?: "active" | "archived" | "draft" | "suspended";
}) {
	return {
		slug: overrides.slug,
		portalType: overrides.portalType ?? "broker",
		brokerId: overrides.brokerId,
		orgId: overrides.orgId,
		productionHost: overrides.productionHost,
		localHost: overrides.localHost,
		status: overrides.status ?? "active",
		isPublished: overrides.isPublished ?? true,
		publicTeaserEnabled: true,
		teaserListingLimit: 12,
		defaultPostAuthPath: "/",
		createdAt: NOW,
		updatedAt: NOW,
	};
}

async function seedPortalFixture(t: ReturnType<typeof createHarness>) {
	await Promise.all([
		seedFromIdentity(t, FAIRLEND_ADMIN),
		seedFromIdentity(t, BROKER),
		seedFromIdentity(t, BORROWER),
		seedFromIdentity(t, LENDER),
		seedFromIdentity(t, MISMATCHED_BORROWER),
		seedFromIdentity(t, MISMATCHED_LENDER),
		seedFromIdentity(t, MISSING_ORG_BORROWER),
		seedFromIdentity(t, UNMAPPED_ORG_BORROWER),
		seedFromIdentity(t, MULTI_PORTAL_BORROWER),
		seedFromIdentity(t, SAME_ORG_WRONG_BROKER_LENDER),
	]);

	return t.run(async (ctx) => {
		const findUser = async (authId: string) => {
			const user = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", authId))
				.unique();
			if (!user) {
				throw new Error(`Expected user for authId ${authId}`);
			}
			return user;
		};

		const brokerUser = await findUser(BROKER.subject);
		const borrowerUser = await findUser(BORROWER.subject);
		const lenderUser = await findUser(LENDER.subject);
		const mismatchedBorrowerUser = await findUser(MISMATCHED_BORROWER.subject);
		const mismatchedLenderUser = await findUser(MISMATCHED_LENDER.subject);
		const missingOrgBorrowerUser = await findUser(MISSING_ORG_BORROWER.subject);
		const unmappedOrgBorrowerUser = await findUser(
			UNMAPPED_ORG_BORROWER.subject
		);
		const multiPortalBorrowerUser = await findUser(
			MULTI_PORTAL_BORROWER.subject
		);
		const sameOrgWrongBrokerLenderUser = await findUser(
			SAME_ORG_WRONG_BROKER_LENDER.subject
		);

		const brokerAId = await ctx.db.insert("brokers", {
			userId: brokerUser._id,
			status: "active",
			orgId: BROKER.org_id,
			createdAt: NOW,
		});

		const brokerBUserId = await ctx.db.insert("users", {
			authId: "user_broker_portal_b",
			email: "broker-b@test.fairlend.ca",
			firstName: "Broker",
			lastName: "PortalB",
		});

		const brokerBId = await ctx.db.insert("brokers", {
			userId: brokerBUserId,
			status: "active",
			orgId: "org_brokerage_portal_b",
			createdAt: NOW,
		});

		const portalAId = await ctx.db.insert(
			"portals",
			buildPortalRecord({
				slug: "alpha",
				brokerId: brokerAId,
				orgId: BROKER.org_id ?? "org_brokerage_test",
				productionHost: "alpha.fairlend.ca",
				localHost: "alpha.localhost:3000",
			})
		);

		const portalBId = await ctx.db.insert(
			"portals",
			buildPortalRecord({
				slug: "beta",
				brokerId: brokerBId,
				orgId: "org_brokerage_portal_b",
				productionHost: "beta.fairlend.ca",
				localHost: "beta.localhost:3000",
			})
		);

		const suspendedPortalId = await ctx.db.insert(
			"portals",
			buildPortalRecord({
				slug: "suspended",
				brokerId: brokerBId,
				orgId: "org_brokerage_portal_b",
				productionHost: "suspended.fairlend.ca",
				localHost: "suspended.localhost:3000",
				status: "suspended",
			})
		);

		const unpublishedPortalId = await ctx.db.insert(
			"portals",
			buildPortalRecord({
				slug: "unpublished",
				brokerId: brokerBId,
				orgId: "org_brokerage_portal_b",
				productionHost: "unpublished.fairlend.ca",
				localHost: "unpublished.localhost:3000",
				isPublished: false,
			})
		);

		await Promise.all([
			ctx.db.patch(brokerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(borrowerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(lenderUser._id, { homePortalId: portalAId }),
			ctx.db.patch(mismatchedBorrowerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(mismatchedLenderUser._id, { homePortalId: portalAId }),
			ctx.db.patch(missingOrgBorrowerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(unmappedOrgBorrowerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(multiPortalBorrowerUser._id, { homePortalId: portalAId }),
			ctx.db.patch(sameOrgWrongBrokerLenderUser._id, {
				homePortalId: portalAId,
			}),
		]);

		const borrowerId = await ctx.db.insert("borrowers", {
			userId: borrowerUser._id,
			status: "active",
			orgId: BROKER.org_id,
			portalId: portalAId,
			createdAt: NOW,
		});

		await ctx.db.insert("borrowers", {
			userId: mismatchedBorrowerUser._id,
			status: "active",
			orgId: BROKER.org_id,
			portalId: portalBId,
			createdAt: NOW,
		});

		await ctx.db.insert("borrowers", {
			userId: missingOrgBorrowerUser._id,
			status: "active",
			createdAt: NOW,
		});

		await ctx.db.insert("borrowers", {
			userId: unmappedOrgBorrowerUser._id,
			status: "active",
			orgId: "org_unmapped_portal",
			createdAt: NOW,
		});

		await ctx.db.insert("borrowers", {
			userId: multiPortalBorrowerUser._id,
			status: "active",
			orgId: "org_brokerage_portal_b",
			portalId: portalBId,
			createdAt: NOW,
		});

		const multiPortalBorrowerPortalAId = await ctx.db.insert("borrowers", {
			userId: multiPortalBorrowerUser._id,
			status: "active",
			orgId: BROKER.org_id,
			portalId: portalAId,
			createdAt: NOW,
		});

		const lenderId = await ctx.db.insert("lenders", {
			userId: lenderUser._id,
			brokerId: brokerAId,
			orgId: BROKER.org_id,
			accreditationStatus: "accredited",
			onboardingEntryPath: "self_signup",
			status: "active",
			createdAt: NOW,
		});

		await ctx.db.insert("lenders", {
			userId: mismatchedLenderUser._id,
			brokerId: brokerBId,
			orgId: "org_brokerage_portal_b",
			accreditationStatus: "accredited",
			onboardingEntryPath: "self_signup",
			status: "active",
			createdAt: NOW,
		});

		await ctx.db.insert("lenders", {
			userId: sameOrgWrongBrokerLenderUser._id,
			brokerId: brokerBId,
			orgId: BROKER.org_id,
			accreditationStatus: "accredited",
			onboardingEntryPath: "self_signup",
			status: "active",
			createdAt: NOW,
		});

		const propertyId = await ctx.db.insert("properties", {
			streetAddress: "1 Portal Lane",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V1A1",
			propertyType: "residential",
			createdAt: NOW,
		});

		const mortgageId = await ctx.db.insert("mortgages", {
			status: "active",
			propertyId,
			principal: 500_000,
			interestRate: 5.5,
			rateType: "fixed",
			termMonths: 60,
			amortizationMonths: 300,
			paymentAmount: 3000,
			paymentFrequency: "monthly",
			loanType: "conventional",
			lienPosition: 1,
			interestAdjustmentDate: "2026-01-01",
			termStartDate: "2026-01-15",
			maturityDate: "2031-01-15",
			firstPaymentDate: "2026-02-15",
			brokerOfRecordId: brokerAId,
			createdAt: NOW,
		});

		await ctx.db.insert("mortgageBorrowers", {
			mortgageId,
			borrowerId,
			role: "primary",
			addedAt: NOW,
		});

		return {
			lenderId,
			mortgageId,
			multiPortalBorrowerPortalAId,
			portalAId,
			portalBId,
			suspendedPortalId,
			unpublishedPortalId,
		};
	});
}

describe("portal middleware proof consumers", () => {
	it("proof handlers rely on builder-injected portal context instead of manual helper composition", () => {
		const proofSource = readFileSync(
			new URL("../proof.ts", import.meta.url),
			"utf8"
		);

		expect(proofSource).not.toContain("loadPortalContext(");
		expect(proofSource).not.toContain("resolvePortalAccess(");
		expect(proofSource).not.toContain("resolvePortalBorrower(");
		expect(proofSource).not.toContain("resolvePortalLender(");
	});

	it("loads public portal context for an active portal", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const result = await t.query(
			internal.portals.proof.getPortalPublicContextProof,
			{
				portalId: fixture.portalAId,
			}
		);

		expect(result.portal.portalId).toBe(fixture.portalAId);
		expect(result.portal.slug).toBe("alpha");
	});

	it("rejects suspended and unpublished portals before handlers run", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		await expect(
			t.query(internal.portals.proof.getPortalPublicContextProof, {
				portalId: fixture.suspendedPortalId,
			})
		).rejects.toThrow("Forbidden: portal unavailable");

		await expect(
			t.query(internal.portals.proof.getPortalPublicContextProof, {
				portalId: fixture.unpublishedPortalId,
			})
		).rejects.toThrow("Forbidden: portal unavailable");
	});

	it("allows same-portal users and preserves proof seams", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const result = await t
			.withIdentity(BROKER)
			.query(internal.portals.proof.getPortalMortgageAccessProof, {
				portalId: fixture.portalAId,
				mortgageId: fixture.mortgageId,
			});

		expect(result.accessMode).toBe("same-portal");
		expect(result.mortgageAllowed).toBe(true);
		expect(result.filterBounds.portalId).toBe(fixture.portalAId);
		expect(result.pricingProjection.portalId).toBe(fixture.portalAId);
	});

	it("denies cross-portal users before resource-level checks can grant access", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		await expect(
			t
				.withIdentity(BROKER)
				.query(internal.portals.proof.getPortalMortgageAccessProof, {
					portalId: fixture.portalBId,
					mortgageId: fixture.mortgageId,
				})
		).rejects.toThrow("Forbidden: wrong portal");
	});

	it("allows FairLend admins through the explicit override path", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const result = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(internal.portals.proof.getPortalMortgageAccessProof, {
				portalId: fixture.portalBId,
				mortgageId: fixture.mortgageId,
			});

		expect(result.accessMode).toBe("admin-override");
		expect(result.mortgageAllowed).toBe(true);
	});

	it("resolves borrower portal attribution and fails closed on mismatches", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const success = await t
			.withIdentity(BORROWER)
			.query(internal.portals.proof.getPortalBorrowerContextProof, {
				portalId: fixture.portalAId,
			});

		expect(success.accessMode).toBe("same-portal");
		expect(success.portalId).toBe(fixture.portalAId);

		await expect(
			t
				.withIdentity(MISMATCHED_BORROWER)
				.query(internal.portals.proof.getPortalBorrowerContextProof, {
					portalId: fixture.portalAId,
				})
		).rejects.toThrow("Forbidden: borrower does not belong to this portal");
	});

	it("resolves the borrower row scoped to the requested portal", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const success = await t
			.withIdentity(MULTI_PORTAL_BORROWER)
			.query(api.portals.proof.getPortalBorrowerContextProof, {
				portalId: fixture.portalAId,
			});

		expect(success.accessMode).toBe("same-portal");
		expect(success.portalId).toBe(fixture.portalAId);
		expect(success.borrowerId).toBe(fixture.multiPortalBorrowerPortalAId);
	});
	it("fails closed when borrower portal attribution is missing", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		await expect(
			t
				.withIdentity(MISSING_ORG_BORROWER)
				.query(internal.portals.proof.getPortalBorrowerContextProof, {
					portalId: fixture.portalAId,
				})
		).rejects.toThrow("Forbidden: borrower does not belong to this portal");

		await expect(
			t
				.withIdentity(UNMAPPED_ORG_BORROWER)
				.query(internal.portals.proof.getPortalBorrowerContextProof, {
					portalId: fixture.portalAId,
				})
		).rejects.toThrow("Forbidden: borrower does not belong to this portal");
	});

	it("resolves lender portal attribution and fails closed on mismatches", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		const success = await t
			.withIdentity(LENDER)
			.query(internal.portals.proof.getPortalLenderContextProof, {
				portalId: fixture.portalAId,
			});

		expect(success.accessMode).toBe("same-portal");
		expect(success.portalId).toBe(fixture.portalAId);
		expect(success.lenderId).toBeDefined();

		await expect(
			t
				.withIdentity(MISMATCHED_LENDER)
				.query(internal.portals.proof.getPortalLenderContextProof, {
					portalId: fixture.portalAId,
				})
		).rejects.toThrow("Forbidden: lender does not belong to this portal");
	});

	it("denies lenders whose org matches the portal but broker alignment does not", async () => {
		const t = createHarness();
		const fixture = await seedPortalFixture(t);

		await expect(
			t
				.withIdentity(SAME_ORG_WRONG_BROKER_LENDER)
				.query(internal.portals.proof.getPortalLenderContextProof, {
					portalId: fixture.portalAId,
				})
		).rejects.toThrow("Forbidden: lender does not belong to this portal");
	});
});
