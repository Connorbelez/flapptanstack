import { describe, expect, it } from "vitest";
import {
	getAdminEntityByTableName,
	getAdminEntityByType,
	getAdminNavigationSections,
} from "#/components/admin/shell/entity-registry";

describe("MIC investor access admin registry", () => {
	it("registers MIC access requests as an admin table and detail surface", () => {
		const entity = getAdminEntityByType("micInvestorAccessRequests");

		expect(entity).toMatchObject({
			domain: "marketplace",
			entityType: "micInvestorAccessRequests",
			iconName: "users",
			pluralLabel: "MIC Access Requests",
			route: "/admin/micInvestorAccessRequests",
			singularLabel: "MIC Access Request",
			supportsDetailPage: true,
			supportsTableView: true,
			tableName: "micInvestorAccessRequests",
		});
		expect(getAdminEntityByTableName("micInvestorAccessRequests")).toBe(entity);
	});

	it("includes MIC access requests in marketplace navigation", () => {
		const sections = getAdminNavigationSections();
		const marketplaceSection = sections.find(
			(section) => section.domain === "marketplace"
		);

		expect(
			marketplaceSection?.items.some(
				(item) => item.entityType === "micInvestorAccessRequests"
			)
		).toBe(true);
	});
});
