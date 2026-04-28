import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import schema from "../../../../convex/schema";
import { convexModules } from "../../../../convex/test/moduleMaps";

const adminIdentity = {
	org_id: "org_01KKF56VABM4NYFFSR039RTJBM",
	permissions: ["admin:access", "document:review"],
	role: "admin",
	roles: ["admin"],
	subject: "admin-auth",
};

describe("mortgage package applications", () => {
	it("applies a published package version future-only and archives prior active applications", async () => {
		const t = convexTest(schema, convexModules);
		const asAdmin = t.withIdentity(adminIdentity);
		const { firstPackageVersionId, mortgageId, secondPackageVersionId } =
			await seedMortgagePackageScenario(t);

		await asAdmin.mutation(api.documents.mortgagePackages.applyPackageVersion, {
			mortgageId,
			packageVersionId: firstPackageVersionId,
		});
		await asAdmin.mutation(api.documents.mortgagePackages.applyPackageVersion, {
			mortgageId,
			packageVersionId: secondPackageVersionId,
		});

		const applications = await asAdmin.query(
			api.documents.mortgagePackages.listApplications,
			{ includeArchived: true, mortgageId }
		);

		expect(applications).toHaveLength(2);
		expect(applications.filter((row) => row.status === "active")).toHaveLength(
			1
		);
		expect(
			applications.find(
				(row) => row.packageVersionId === firstPackageVersionId
			)?.status
		).toBe("archived");
	});
});

async function seedMortgagePackageScenario(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const userId = await ctx.db.insert("users", {
			authId: "broker-auth",
			email: "broker@example.com",
			firstName: "Broker",
			lastName: "User",
		});
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1,
			status: "active",
			userId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "1 King St W",
			createdAt: 1,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			brokerOfRecordId: brokerId,
			createdAt: 1,
			firstPaymentDate: "2026-01-01",
			interestAdjustmentDate: "2026-01-01",
			interestRate: 7.5,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: "2027-01-01",
			paymentAmount: 1250,
			paymentFrequency: "monthly",
			principal: 250000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-01-01",
		});
		const firstPackageVersionId = await seedPackageVersion(ctx, "First Package");
		const secondPackageVersionId = await seedPackageVersion(ctx, "Second Package");

		return { firstPackageVersionId, mortgageId, secondPackageVersionId };
	});
}

async function seedPackageVersion(
	ctx: Parameters<Parameters<ReturnType<typeof convexTest>["run"]>[0]>[0],
	name: string
) {
	const packageId = await ctx.db.insert("documentPackageDefinitions", {
		createdAt: 1,
		draft: { items: [] },
		hasDraftChanges: false,
		name,
		updatedAt: 1,
	});
	return ctx.db.insert("documentPackageVersions", {
		packageId,
		publishedAt: 1,
		snapshot: {
			envelopeBoundaries: [],
			items: [],
			name,
			requiredPlatformRoles: [],
			requiredVariableKeys: [],
		},
		version: 1,
	});
}
