import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import {
	EXTERNAL_ORG_ADMIN,
	FAIRLEND_ADMIN,
} from "../../../src/test/auth/identities";
import { registerAuditLogComponent } from "../../../src/test/convex/registerAuditLogComponent";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const platformLawyersApi = anyApi.legalRepresentation.platformLawyers;

function createHarness() {
	const t = convexTest(schema, convexModules);
	registerAuditLogComponent(t, "auditLog");
	return t;
}

async function insertCanonicalLawyerIdentity(
	t: ReturnType<typeof createHarness>,
	args: {
		readonly authId: string;
		readonly email: string;
		readonly roleSlug?: string;
		readonly status?: string;
	}
) {
	await t.run(async (ctx) => {
		await ctx.db.insert("users", {
			authId: args.authId,
			email: args.email,
			firstName: "Platform",
			lastName: "Lawyer",
		});
		await ctx.db.insert("organizationMemberships", {
			organizationName: "Test Law Firm",
			organizationWorkosId: "org_test_lawfirm",
			roleSlug: args.roleSlug ?? "platform_lawyer",
			roleSlugs: [args.roleSlug ?? "platform_lawyer"],
			status: args.status ?? "active",
			userWorkosId: args.authId,
			workosId: `om_${args.authId}`,
		});
	});
}

describe("platform lawyer management", () => {
	it("allows FairLend admins to create active eligible platform lawyers for checkout", async () => {
		const t = createHarness();
		await insertCanonicalLawyerIdentity(t, {
			authId: "user_platform_lawyer_active",
			email: "avery.chen@example.test",
		});
		const profileId = await t
			.withIdentity(FAIRLEND_ADMIN)
			.mutation(platformLawyersApi.createOrDesignatePlatformLawyer, {
				authId: "user_platform_lawyer_active",
				barNumber: "LSO-123456",
				displayName: "Avery Chen",
				email: "avery.chen@example.test",
				firmName: "FairLend Panel Law",
				jurisdiction: "ON",
				platformStatus: "active",
			});

		const options = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(platformLawyersApi.listCheckoutPlatformLawyerOptions, {});

		expect(options).toEqual([
			expect.objectContaining({
				email: "avery.chen@example.test",
				eligibilityStatus: "eligible",
				lawyerId: "user_platform_lawyer_active",
				lawyerProfileId: profileId,
				platformStatus: "active",
			}),
		]);
	});

	it("rejects platform lawyer mutations from non-FairLend admins", async () => {
		const t = createHarness();

		await expect(
			t
				.withIdentity(EXTERNAL_ORG_ADMIN)
				.mutation(platformLawyersApi.createOrDesignatePlatformLawyer, {
					authId: "user_external_platform_lawyer",
					displayName: "External Admin",
					email: "external-lawyer@example.test",
					platformStatus: "active",
				})
		).rejects.toThrow("Forbidden: fair lend admin role required");
	});

	it("rejects active platform lawyers without a synced WorkOS lawyer role", async () => {
		const t = createHarness();

		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(platformLawyersApi.createOrDesignatePlatformLawyer, {
					authId: "user_missing_lawyer_role",
					displayName: "Missing Lawyer Role",
					email: "missing-lawyer-role@example.test",
					platformStatus: "active",
				})
		).rejects.toThrow("synced WorkOS user");

		await insertCanonicalLawyerIdentity(t, {
			authId: "user_broker_not_lawyer",
			email: "broker-not-lawyer@example.test",
			roleSlug: "broker",
		});
		await expect(
			t
				.withIdentity(FAIRLEND_ADMIN)
				.mutation(platformLawyersApi.createOrDesignatePlatformLawyer, {
					authId: "user_broker_not_lawyer",
					displayName: "Broker Not Lawyer",
					email: "broker-not-lawyer@example.test",
					platformStatus: "active",
				})
		).rejects.toThrow("active WorkOS platform lawyer role");
	});

	it("removes active platform lawyers from checkout options when WorkOS role sync drifts", async () => {
		const t = createHarness();
		await insertCanonicalLawyerIdentity(t, {
			authId: "user_platform_lawyer_drift",
			email: "drift@example.test",
		});
		const auth = t.withIdentity(FAIRLEND_ADMIN);
		await auth.mutation(platformLawyersApi.createOrDesignatePlatformLawyer, {
			authId: "user_platform_lawyer_drift",
			displayName: "Drift Lawyer",
			email: "drift@example.test",
			platformStatus: "active",
		});
		expect(
			await auth.query(platformLawyersApi.listCheckoutPlatformLawyerOptions, {})
		).toHaveLength(1);

		await t.run(async (ctx) => {
			const memberships = await ctx.db
				.query("organizationMemberships")
				.withIndex("byUser", (query) =>
					query.eq("userWorkosId", "user_platform_lawyer_drift")
				)
				.collect();
			for (const membership of memberships) {
				await ctx.db.patch(membership._id, {
					roleSlug: "member",
					roleSlugs: ["member"],
				});
			}
		});

		expect(
			await auth.query(platformLawyersApi.listCheckoutPlatformLawyerOptions, {})
		).toEqual([]);
	});

	it("keeps duplicate auth ID creation idempotent instead of creating ambiguous active profiles", async () => {
		const t = createHarness();
		await insertCanonicalLawyerIdentity(t, {
			authId: "user_platform_lawyer_duplicate",
			email: "duplicate@example.test",
		});
		const auth = t.withIdentity(FAIRLEND_ADMIN);
		const firstId = await auth.mutation(
			platformLawyersApi.createOrDesignatePlatformLawyer,
			{
				authId: "user_platform_lawyer_duplicate",
				displayName: "Duplicate Lawyer",
				email: "duplicate@example.test",
				platformStatus: "active",
			}
		);
		const secondId = await auth.mutation(
			platformLawyersApi.createOrDesignatePlatformLawyer,
			{
				authId: "user_platform_lawyer_duplicate",
				displayName: "Duplicate Lawyer Updated",
				email: "duplicate@example.test",
				platformStatus: "active",
			}
		);

		const rows = await t.run(async (ctx) =>
			ctx.db.query("lawyerProfiles").collect()
		);

		expect(secondId).toBe(firstId);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			authId: "user_platform_lawyer_duplicate",
			displayName: "Duplicate Lawyer Updated",
			normalizedEmail: "duplicate@example.test",
		});
	});

	it("keeps suspended and requires-review platform lawyers out of checkout options while visible to admins", async () => {
		const t = createHarness();
		const auth = t.withIdentity(FAIRLEND_ADMIN);

		await auth.mutation(platformLawyersApi.seedPlatformLawyerRoster, {});

		const checkoutOptions = await auth.query(
			platformLawyersApi.listCheckoutPlatformLawyerOptions,
			{}
		);
		const adminRows = await auth.query(
			platformLawyersApi.listPlatformLawyersForAdmin,
			{}
		);

		expect(checkoutOptions.map((option) => option.name)).toEqual([
			"Avery Chen",
			"Morgan Patel",
		]);
		expect(adminRows.map((row) => row.profile.displayName).sort()).toEqual([
			"Avery Chen",
			"Morgan Patel",
			"Riley Review",
			"Sam Suspended",
		]);
		expect(
			adminRows.find((row) => row.profile.displayName === "Sam Suspended")
				?.option?.eligibilityStatus
		).toBe("blocked");
		expect(
			adminRows.find((row) => row.profile.displayName === "Riley Review")
				?.option?.eligibilityStatus
		).toBe("requires_review");
	});
});
