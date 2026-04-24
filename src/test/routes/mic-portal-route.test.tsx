/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from "vitest";
import {
	micPortfolioCommandCenterQueryOptions,
	micPortfolioMortgageDetailPageQueryOptions,
} from "#/components/mic/portal/query-options";
import { Route as MicPortalIndexRoute } from "#/routes/portal";
import { Route as MicMortgageDetailRoute } from "#/routes/portal/mortgages/$mortgageId";
import { Route as MicPortalRoute } from "#/routes/portal/route";

vi.mock("#/components/mic/portal/query-options", async () => {
	const actual = await vi.importActual<
		typeof import("#/components/mic/portal/query-options")
	>("#/components/mic/portal/query-options");

	return {
		...actual,
		micPortfolioCommandCenterQueryOptions: vi.fn(),
		micPortfolioMortgageDetailPageQueryOptions: vi.fn(),
	};
});

const PORTAL_ID = "portal_mic" as never;

const ROOT_CONTEXT = {
	portalContext: {
		availability: "active",
		cacheKey: "portal:portal_mic:active:local:mic.localhost:3000",
		canonicalHost: "mic.localhost:3000",
		kind: "portal",
		matchedHostType: "local",
		portal: {
			portalId: PORTAL_ID,
		},
		requestedHost: "mic.localhost:3000",
	},
};

describe("MIC portal routes", () => {
	it("prefetches the MIC command-center query in the /portal loader", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue(null);
		vi.mocked(micPortfolioCommandCenterQueryOptions).mockReturnValue({
			queryKey: ["mic-portfolio"],
		} as never);

		await MicPortalIndexRoute.options.loader?.({
			context: {
				portalContext: ROOT_CONTEXT.portalContext,
				queryClient: { ensureQueryData },
			},
		} as never);

		expect(micPortfolioCommandCenterQueryOptions).toHaveBeenCalledWith(PORTAL_ID);
		expect(ensureQueryData).toHaveBeenCalled();
	});

	it("redirects unauthorized users before the /portal route loads", () => {
		let thrown: unknown = null;

		try {
			MicPortalRoute.options.beforeLoad?.({
				context: {
					orgId: "org_mic",
					permissions: [],
					role: "member",
					roles: ["member"],
					token: "token",
					userId: "user_member",
				},
				location: {
					href: "/portal",
					pathname: "/portal",
				},
			} as never);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toMatchObject({
			options: {
				statusCode: 307,
				to: "/unauthorized",
			},
		});
	});

	it("prefetches the MIC full-detail query in the mortgage detail loader", async () => {
		const ensureQueryData = vi.fn().mockResolvedValue(null);
		vi.mocked(micPortfolioMortgageDetailPageQueryOptions).mockReturnValue({
			queryKey: ["mic-portfolio-detail", "mortgage_1"],
		} as never);

		await MicMortgageDetailRoute.options.loader?.({
			context: {
				portalContext: ROOT_CONTEXT.portalContext,
				queryClient: { ensureQueryData },
			},
			params: {
				mortgageId: "mortgage_1",
			},
		} as never);

		expect(micPortfolioMortgageDetailPageQueryOptions).toHaveBeenCalledWith(
			PORTAL_ID,
			"mortgage_1"
		);
		expect(ensureQueryData).toHaveBeenCalled();
	});
});
