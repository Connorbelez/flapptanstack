import { describe, expect, it } from "vitest";
import {
	MIC_PORTAL_LOCAL_HOST,
	MIC_PORTAL_PRODUCTION_HOST,
	MIC_PORTAL_SLUG,
	buildPortalHosts,
	isReservedPortalSlug,
	parsePortalHostCandidate,
} from "../../shared/portal/contracts";

describe("portal host contracts", () => {
	it("treats mic as a normal non-reserved portal slug", () => {
		expect(isReservedPortalSlug(MIC_PORTAL_SLUG)).toBe(false);
		expect(buildPortalHosts(MIC_PORTAL_SLUG)).toEqual({
			localHost: MIC_PORTAL_LOCAL_HOST,
			productionHost: MIC_PORTAL_PRODUCTION_HOST,
		});
	});

	it("parses MIC local and production hosts through the standard portal parser", () => {
		expect(parsePortalHostCandidate("MIC.localhost:3000.")).toEqual({
			hostType: "local",
			slug: MIC_PORTAL_SLUG,
		});
		expect(parsePortalHostCandidate(MIC_PORTAL_PRODUCTION_HOST)).toEqual({
			hostType: "production",
			slug: MIC_PORTAL_SLUG,
		});
	});
});
