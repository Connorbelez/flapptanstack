/**
 * @vitest-environment jsdom
 */

import { useAction, useMutation, useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../convex/_generated/api";
import { OnboardRoutePage, Route } from "#/routes/onboard/index";
import { Route as RootRoute } from "#/routes/__root";
import { cleanup, fireEvent, render, screen } from "./onboard.render";
import { createOnboardingReadModel, PORTAL_CONTEXT } from "./onboard.test-helpers";

const useAppAuthMock = vi.fn();

function useTestRootRouteContext() {
	return {
		portalContext: PORTAL_CONTEXT,
	};
}

vi.mock("lucide-react", () => {
	const Icon = () => null;
	return {
		AlertTriangle: Icon,
		ArrowRight: Icon,
		ArrowLeft: Icon,
		Bug: Icon,
		Building2: Icon,
		CheckCircle2: Icon,
		Check: Icon,
		ChevronDown: Icon,
		ChevronRight: Icon,
		Clipboard: Icon,
		ExternalLink: Icon,
		Globe: Icon,
		Globe2: Icon,
		Home: Icon,
		Lock: Icon,
		MessageSquarePlus: Icon,
		PlayCircle: Icon,
		RefreshCw: Icon,
		RotateCcw: Icon,
		Save: Icon,
		Search: Icon,
		SendHorizonal: Icon,
		ServerCrash: Icon,
		ShieldAlert: Icon,
		ShieldCheck: Icon,
		Timer: Icon,
		Zap: Icon,
	};
});

vi.mock("radix-ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("radix-ui")>();
	return {
		...actual,
		Progress: {
			Indicator: (props: React.ComponentProps<"div">) => <div {...props} />,
			Root: (props: React.ComponentProps<"div">) => <div {...props} />,
		},
	};
});

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("@workos/authkit-tanstack-react-start/client", () => ({
	useAuth: () => useAppAuthMock(),
}));

vi.mock("#/components/ui/progress", () => ({
	Progress: ({ value }: { value?: number }) => (
		<div aria-valuenow={value ?? 0} role="progressbar" />
	),
}));

vi.mock("../../../src/components/ui/progress", () => ({
	Progress: ({ value }: { value?: number }) => (
		<div aria-valuenow={value ?? 0} role="progressbar" />
	),
}));

vi.mock("../../../src/routes/__root", () => ({
	Route: {
		useRouteContext: vi.fn(useTestRootRouteContext),
	},
}));

afterEach(() => {
	cleanup();
	useAppAuthMock.mockReset();
	vi.restoreAllMocks();
});

function mockRouteContext() {
	vi.spyOn(RootRoute, "useRouteContext").mockReturnValue(
		useTestRootRouteContext() as never
	);
}

function mockMutations(startOrResume = vi.fn()) {
	vi.mocked(useMutation).mockImplementation((fn) => {
		if (
			getFunctionName(fn).endsWith(
				"onboarding/brokerApplication/mutations:startOrResume"
			)
		) {
			return startOrResume as never;
		}
		return vi.fn() as never;
	});
	vi.mocked(useAction).mockReturnValue(vi.fn() as never);
	return { startOrResume };
}

describe("onboard route", () => {
	it("renders the public intro before auth and preserves referral context in auth links", () => {
		mockRouteContext();
		vi.spyOn(Route, "useSearch").mockReturnValue({
			invitedByBrokerId: "user_referrer",
			ref: "launch-a",
			referralSource: "broker_invite",
		} as never);
		useAppAuthMock.mockReturnValue({
			loading: false,
			organizationId: null,
			permissions: [],
			role: null,
			roles: [],
			signOut: vi.fn(),
			user: null,
		});
		mockMutations();

		render(<OnboardRoutePage />);

		expect(screen.getByText(/Build your verified broker workspace/)).toBeTruthy();
		const startLink = screen.getByRole("link", { name: /Start onboarding/i });
		expect(startLink.getAttribute("href")).toContain("/sign-up?redirect=");
		expect(decodeURIComponent(startLink.getAttribute("href") ?? "")).toContain(
			"invitedByBrokerId=user_referrer"
		);
	});

	it("starts a server-backed application with portal and referral context", () => {
		mockRouteContext();
		vi.spyOn(Route, "useSearch").mockReturnValue({
			invitedByBrokerId: "user_referrer",
			ref: "launch-a",
			referralSource: "broker_invite",
		} as never);
		useAppAuthMock.mockReturnValue({
			loading: false,
			organizationId: "org_broker",
			permissions: ["onboarding:access"],
			role: "broker",
			roles: ["broker"],
			signOut: vi.fn(),
			user: { id: "user_broker" },
		} as never);
		vi.mocked(useQuery).mockReturnValue(null);
		const startOrResume = vi
			.fn()
			.mockReturnValue(new Promise(() => undefined));
		mockMutations(startOrResume);

		render(<OnboardRoutePage />);
		fireEvent.click(screen.getByRole("button", { name: /Start onboarding/i }));

		expect(startOrResume).toHaveBeenCalledWith({
			invitedByBrokerId: "user_referrer",
			portalId: "portal_meridian",
			referralSource: "broker_invite",
			referralToken: "launch-a",
		});
	});

	it("resumes an existing draft from the server projection", () => {
		mockRouteContext();
		vi.spyOn(Route, "useSearch").mockReturnValue({} as never);
		useAppAuthMock.mockReturnValue({
			loading: false,
			organizationId: "org_broker",
			permissions: ["onboarding:access"],
			role: "broker",
			roles: ["broker"],
			signOut: vi.fn(),
			user: { id: "user_broker" },
		} as never);
		vi.mocked(useQuery).mockImplementation((fn) => {
			if (fn === api.portals.queries.previewPortalSlugCandidate) {
				return {
					available: true,
					conflictReason: null,
					hosts: {
						localHost: "meridian-capital.localhost:3000",
						productionHost: "meridian-capital.fairlend.ca",
					},
					isReserved: false,
					normalizedSlug: "meridian-capital",
				};
			}
			return createOnboardingReadModel("draft") as never;
		});
		mockMutations();

		render(<OnboardRoutePage />);

		expect(screen.getByText("Chaptered setup")).toBeTruthy();
		expect(screen.getByDisplayValue("Meridian Capital")).toBeTruthy();
	});
});
