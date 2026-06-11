import { describe, expect, it } from "vitest";
import { buildAdminNavigationHref } from "#/lib/portal/admin-navigation";

describe("admin navigation href", () => {
	it("points app-local navigation at the local admin host with the closed detail sheet", () => {
		expect(buildAdminNavigationHref("app.localhost:3000")).toBe(
			"http://admin.localhost:3000/admin?detailOpen=false"
		);
	});

	it("points production portal navigation at the production admin host with the closed detail sheet", () => {
		expect(buildAdminNavigationHref("app.fairlend.ca")).toBe(
			"https://admin.fairlend.ca/admin?detailOpen=false"
		);
	});
});
