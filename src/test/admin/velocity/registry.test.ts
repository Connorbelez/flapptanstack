import { describe, expect, it } from "vitest";
import {
	getAdminEntityByType,
	getAdminNavigationSections,
} from "#/components/admin/shell/entity-registry";

describe("Velocity admin registry", () => {
	it("registers Velocity packages as a dedicated admin detail surface", () => {
		const entity = getAdminEntityByType("velocity");

		expect(entity).toMatchObject({
			domain: "payments",
			entityType: "velocity",
			iconName: "file-text",
			pluralLabel: "Velocity Packages",
			route: "/admin/velocity",
			singularLabel: "Velocity Package",
			supportsDetailPage: true,
			supportsTableView: false,
			tableName: "velocityPackageWorkspaces",
		});
	});

	it("includes Velocity packages in the admin payments navigation section", () => {
		const sections = getAdminNavigationSections();
		const paymentsSection = sections.find(
			(section) => section.domain === "payments"
		);

		expect(
			paymentsSection?.items.some((item) => item.entityType === "velocity")
		).toBe(true);
	});
});
