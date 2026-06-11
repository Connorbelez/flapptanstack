import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const modules = convexModules;
const lenderLandingApi = anyApi.onboarding.lenderLanding;

const LENDER_IDENTITY = {
	subject: "user_lender_landing",
	issuer: "https://api.workos.com",
	org_id: "org_meridian",
	organization_name: "Meridian Capital",
	role: "member",
	roles: JSON.stringify(["member"]),
	permissions: JSON.stringify([]),
	user_email: "Investor@Example.com",
	user_first_name: "Iris",
	user_last_name: "Investor",
};

function createHarness() {
	return convexTest(schema, modules);
}

async function insertBrokerPortal(
	t: ReturnType<typeof createHarness>,
	overrides: {
		isPublished?: boolean;
		status?: string;
	} = {}
) {
	return await t.run(async (ctx) => {
		const now = 1_710_000_000_000;
		const userId = await ctx.db.insert("users", {
			authId: "broker-meridian",
			email: "broker@meridian.test",
			firstName: "Meridian",
			lastName: "Broker",
		});
		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "Meridian Capital",
			createdAt: now,
			lastTransitionAt: undefined,
			licenseId: "12847",
			licenseProvince: "FSRA",
			orgId: "org_meridian",
			status: "active",
			userId,
		});
		const portalId = await ctx.db.insert("portals", {
			brokerId,
			createdAt: now,
			defaultPostAuthPath: "/",
			isPublished: overrides.isPublished ?? true,
			landingPageId: undefined,
			localHost: "meridian.localhost:3000",
			orgId: "org_meridian",
			portalType: "broker",
			pricingPolicyId: undefined,
			productionHost: "meridian.fairlend.ca",
			publicTeaserEnabled: true,
			slug: "meridian",
			status: overrides.status ?? "active",
			teaserListingLimit: 12,
			updatedAt: now,
		});

		return { brokerId, portalId };
	});
}

describe("lender landing handoff", () => {
	it("creates a broker-attributed lender onboarding record from landing intent", async () => {
		const t = createHarness();
		const { brokerId, portalId } = await insertBrokerPortal(t);

		const result = await t
			.withIdentity(LENDER_IDENTITY)
			.mutation(lenderLandingApi.completeLandingStart, {
				entryPath:
					"/start-lending?source=featured-listing&listingId=listing_123",
				listingId: "listing_123",
				portalId,
			});

		expect(result.wasCreated).toBe(true);
		const onboarding = await t.run((ctx) => ctx.db.get(result.onboardingId));
		expect(onboarding).toMatchObject({
			brokerId,
			email: "investor@example.com",
			entryPath: "/start-lending?source=featured-listing&listingId=listing_123",
			fullName: "Iris Investor",
			status: "started",
			subdomain: "meridian",
		});
		expect(onboarding?.machineContext).toEqual({
			landingSource: {
				listingId: "listing_123",
				portalId: String(portalId),
			},
		});
	});

	it("resumes an existing active onboarding for the same broker and subdomain", async () => {
		const t = createHarness();
		const { portalId } = await insertBrokerPortal(t);
		const authed = t.withIdentity(LENDER_IDENTITY);

		const first = await authed.mutation(lenderLandingApi.completeLandingStart, {
			entryPath: "/start-lending?source=switchboard",
			portalId,
		});
		const second = await authed.mutation(
			lenderLandingApi.completeLandingStart,
			{
				entryPath: "/start-lending?source=view-all",
				portalId,
			}
		);

		expect(second).toMatchObject({
			onboardingId: first.onboardingId,
			wasCreated: false,
		});
		const onboarding = await t.run((ctx) => ctx.db.get(first.onboardingId));
		expect(onboarding?.entryPath).toBe("/start-lending?source=view-all");
		expect(onboarding?.machineContext).toEqual({
			landingSource: {
				portalId: String(portalId),
			},
		});
	});

	it("refreshes listing attribution when resuming an existing onboarding", async () => {
		const t = createHarness();
		const { portalId } = await insertBrokerPortal(t);
		const authed = t.withIdentity(LENDER_IDENTITY);

		const first = await authed.mutation(lenderLandingApi.completeLandingStart, {
			entryPath: "/start-lending?source=switchboard",
			portalId,
		});
		await authed.mutation(lenderLandingApi.completeLandingStart, {
			entryPath: "/start-lending?source=featured-listing&listingId=listing_123",
			listingId: "listing_123",
			portalId,
		});

		const onboarding = await t.run((ctx) => ctx.db.get(first.onboardingId));
		expect(onboarding?.machineContext).toEqual({
			landingSource: {
				listingId: "listing_123",
				portalId: String(portalId),
			},
		});
	});

	it("fails closed when the portal is unavailable", async () => {
		const t = createHarness();
		const { portalId } = await insertBrokerPortal(t, { status: "suspended" });

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath: "/start-lending?source=switchboard",
					portalId,
				})
		).rejects.toThrow("Cannot start lender onboarding from this portal");
	});

	it("rejects listing intent that does not match the entry path", async () => {
		const t = createHarness();
		const { portalId } = await insertBrokerPortal(t);

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath: "/start-lending?source=featured-listing",
					listingId: "listing_123",
					portalId,
				})
		).rejects.toThrow("listingId must match the entryPath");

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath:
						"/start-lending?source=featured-listing&listingId=listing_456",
					listingId: "listing_123",
					portalId,
				})
		).rejects.toThrow("listingId must match the entryPath");
	});

	it("rejects non-canonical entry paths and sources", async () => {
		const t = createHarness();
		const { portalId } = await insertBrokerPortal(t);

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath: "https://evil.test/start-lending?source=switchboard",
					portalId,
				})
		).rejects.toThrow("must be a relative portal path");

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath: "/start-lendingevil?source=switchboard",
					portalId,
				})
		).rejects.toThrow("canonical /start-lending path");

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath: "/start-lending?source=unknown",
					portalId,
				})
		).rejects.toThrow("entryPath source is invalid");

		await expect(
			t
				.withIdentity(LENDER_IDENTITY)
				.mutation(lenderLandingApi.completeLandingStart, {
					entryPath:
						"/start-lending?source=switchboard&redirect=https://evil.test",
					portalId,
				})
		).rejects.toThrow("entryPath query parameter is unsupported");
	});
});
