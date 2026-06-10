/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { getListingDetailMock } from "#/components/demo/listings/listing-detail-mock-data";
import { ListingDetailPage } from "#/components/listings/ListingDetailPage";
import type {
	ListingCheckoutReturnState,
	ListingDetailData,
} from "#/components/listings/listing-detail-types";

const reactModulePath = vi.hoisted(
	() => new URL("../../../node_modules/react/index.js", import.meta.url).pathname
);

vi.mock("react", async () => {
	return await vi.importActual<typeof import("react")>(reactModulePath);
});

vi.mock("#/components/listings/ListingPdfViewer", () => ({
	ListingPdfViewer: ({
		document,
	}: {
		document: { readonly label: string };
	}) => <div data-testid="listing-pdf-viewer">{document.label}</div>,
}));

vi.mock("#/components/listings/ListingMap", () => ({
	ListingMap: () => <div data-testid="listing-map" />,
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			className?: string;
			params?: Record<string, string>;
			to: string;
		}) => (
			<a className={props.className} href={props.to}>
				{props.children}
			</a>
		),
	};
});

beforeEach(() => {
	vi.stubGlobal(
		"IntersectionObserver",
		class IntersectionObserver {
			disconnect() {}
			observe() {}
			takeRecords() {
				return [];
			}
			unobserve() {}
		}
	);
	vi.stubGlobal(
		"ResizeObserver",
		class ResizeObserver {
			disconnect() {}
			observe() {}
			unobserve() {}
		}
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
	vi.clearAllMocks();
});

function getListing(overrides: Partial<ListingDetailData> = {}): ListingDetailData {
	const listing = getListingDetailMock("first-mortgage-north-york");
	if (!listing) {
		throw new Error("Expected listing detail mock to exist");
	}

	return {
		...listing,
		...overrides,
		checkout:
			overrides.checkout === undefined ? listing.checkout : overrides.checkout,
	};
}

function renderInteractiveListing(
	options: {
		listing?: ListingDetailData;
		checkoutReturnState?: ListingCheckoutReturnState;
		onStartCheckout?: Parameters<typeof ListingDetailPage>[0]["onStartCheckout"];
		redirectToHostedCheckout?: Parameters<
			typeof ListingDetailPage
		>[0]["redirectToHostedCheckout"];
	} = {}
) {
	const listing = options.listing ?? getListing();
	const onStartCheckout =
		options.onStartCheckout ??
		vi.fn().mockResolvedValue({
			ok: true,
			checkoutSessionId: "checkout_123",
			expiresAt: Date.now() + 300_000,
			stripeCheckoutUrl: "https://checkout.stripe.test/session",
		});
	const redirectToHostedCheckout =
		options.redirectToHostedCheckout ?? vi.fn();

	render(
		<ListingDetailPage
			buildSimilarListingHref={(listingId) => `/listings/${listingId}`}
			checkoutReturnState={options.checkoutReturnState}
			listing={listing}
			mode="interactive"
			onStartCheckout={onStartCheckout}
			portalId="portal_test"
			redirectToHostedCheckout={redirectToHostedCheckout}
		/>
	);

	return { listing, onStartCheckout, redirectToHostedCheckout };
}

function listingWithoutPlatformLawyers(): ListingDetailData {
	const listing = getListing();
	return {
		...listing,
		checkout: {
			...listing.checkout!,
			lawyers: [],
		},
	};
}

function firstCheckoutButton(): HTMLButtonElement {
	return screen.getAllByRole("button", {
		name: /Lock .* Fractions - Pay CAD 250 Fee/i,
	})[0] as HTMLButtonElement;
}

describe("listing detail appraisal sections", () => {
	it("does not render projected appraisal or as-if comparables without an as-if appraisal", () => {
		const listing = getListing();

		renderInteractiveListing({
			listing: {
				...listing,
				appraisal: {
					...listing.appraisal,
					asIf: {
						label: "Projected Value",
						note: "No as-if-complete valuation has been published.",
						value: "Unavailable",
					},
					hasAsIf: false,
				},
				comparables: {
					...listing.comparables,
					asIf: [],
				},
			},
		});

		expect(screen.queryByText("Projected Value")).toBeNull();
		expect(screen.queryByText("Unavailable")).toBeNull();
		expect(
			screen.queryByText("No as-if-complete valuation has been published.")
		).toBeNull();
		expect(screen.queryByText("As-If Comparables")).toBeNull();
		expect(
			screen.queryByText("No comparable sales are published for this appraisal.")
		).toBeNull();
	});
});

describe("listing detail hosted checkout launcher", () => {
	it("starts hosted checkout and redirects only to the returned URL", async () => {
		const { onStartCheckout, redirectToHostedCheckout } =
			renderInteractiveListing();

		fireEvent.click(firstCheckoutButton());

		await waitFor(() => {
			expect(onStartCheckout).toHaveBeenCalledWith({
				listingId: "first-mortgage-north-york",
				portalId: "portal_test",
				requestedFractions: 100,
				selectedLawyer: {
					type: "platform_lawyer",
					lawyerId: "smith-associates",
					name: "Smith & Associates LLP",
					email: "closing@smith.example",
					firm: "Smith & Associates LLP",
				},
			});
			expect(redirectToHostedCheckout).toHaveBeenCalledWith(
				"https://checkout.stripe.test/session"
			);
		});
	});

	it("offers a first-screen entry point to the lock workflow", () => {
		const scrollIntoView = vi.fn();
		vi.spyOn(document, "getElementById").mockReturnValue({
			scrollIntoView,
		} as unknown as HTMLElement);
		renderInteractiveListing();

		fireEvent.click(
			screen.getAllByRole("button", { name: "Start listing lock" })[0]!
		);

		expect(document.getElementById).toHaveBeenCalledWith(
			"listing-lock-workflow"
		);
		expect(scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
			block: "start",
		});
	});

	it("renders backend failures without redirecting", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const onStartCheckout = vi.fn().mockResolvedValue({
			ok: false,
			code: "provider_start_failed",
			message: "Stripe could not start the hosted session.",
		});
		const redirectToHostedCheckout = vi.fn();
		renderInteractiveListing({ onStartCheckout, redirectToHostedCheckout });

		fireEvent.click(firstCheckoutButton());

		expect(
			await screen.findAllByText("Stripe could not start the hosted session.")
		).toHaveLength(2);
		expect(consoleError).toHaveBeenCalledWith(
			"[ListingDetailPage] hosted checkout start failed",
			expect.objectContaining({
				listingId: "first-mortgage-north-york",
				portalId: "portal_test",
				requestedFractions: 100,
				resultCode: "provider_start_failed",
				resultMessage: "Stripe could not start the hosted session.",
				stage: "backend_result",
			})
		);
		expect(redirectToHostedCheckout).not.toHaveBeenCalled();
	});

	it("keeps read-only listings from starting checkout", () => {
		render(
			<ListingDetailPage
				buildSimilarListingHref={(listingId) => `/listings/${listingId}`}
				listing={getListing({
					checkout: {
						...getListing().checkout!,
						disabledReason: "No fractions are currently available for checkout.",
						isEligible: false,
					},
				})}
				mode="readOnly"
			/>
		);

		expect(screen.queryByRole("button", { name: /Lock .* Fractions/i })).toBeNull();
		expect(
			screen.getAllByText("No fractions are currently available for checkout.")
				.length
		).toBeGreaterThan(0);
	});

	it("requires guest lawyer name and email before enabling checkout", () => {
		renderInteractiveListing({ listing: listingWithoutPlatformLawyers() });

		fireEvent.click(
			screen.getAllByRole("button", { name: "Guest lawyer fallback" })[0]!
		);

		expect(firstCheckoutButton().disabled).toBe(true);
		expect(screen.getAllByLabelText("Name").length).toBeGreaterThan(0);
		expect(screen.getAllByLabelText("Email").length).toBeGreaterThan(0);
	});

	it("does not expose manual guest fallback while platform lawyers are configured", () => {
		renderInteractiveListing();

		expect(
			screen.queryByRole("button", { name: "Guest lawyer fallback" })
		).toBeNull();
		expect(screen.queryByLabelText("Name")).toBeNull();
		expect(screen.queryByLabelText("Email")).toBeNull();
	});

	it("shows platform lawyer SLA, availability, active count, and capacity warning", () => {
		const listing = getListing({
			checkout: {
				...getListing().checkout!,
				lawyers: [
					{
						...getListing().checkout!.lawyers[0]!,
						activeDealCount: 4,
						availability: [
							{
								businessDate: "2026-05-04",
								hasAvailability: true,
								isOnHold: false,
								label: "2026-05-04: 09:00-12:00",
								windows: ["09:00-12:00"],
							},
						],
						capacityLimit: 4,
						capacityWarning: "full",
						slaTier: { name: "24h review", reviewHours: 24 },
					},
				],
			},
		});
		renderInteractiveListing({ listing });

		expect(screen.getAllByText("24h SLA").length).toBeGreaterThan(0);
		expect(
			screen.getAllByText("2026-05-04: 09:00-12:00").length
		).toBeGreaterThan(0);
		expect(screen.getAllByText("4 active / 4 capacity").length).toBeGreaterThan(
			0
		);
		expect(screen.getAllByText("Fully booked").length).toBeGreaterThan(0);
		expect(firstCheckoutButton().disabled).toBe(false);
	});

	it("rejects non-positive fraction input instead of submitting the default", () => {
		const onStartCheckout = vi.fn();
		renderInteractiveListing({ onStartCheckout });

		fireEvent.change(screen.getAllByLabelText("Number of fractions")[0]!, {
			target: { value: "0" },
		});
		const button = firstCheckoutButton();
		fireEvent.click(button);

		expect(button.disabled).toBe(true);
		expect(onStartCheckout).not.toHaveBeenCalled();
		expect(screen.getAllByText("Enter 10 to 6,200 fractions.").length).toBeGreaterThan(0);
	});

	it("uses checkout maximum fractions for launcher bounds", () => {
		const listing = getListing({
			checkout: {
				...getListing().checkout!,
				defaultFractions: 1,
				maximumFractions: 5,
				minimumFractions: 1,
			},
		});
		renderInteractiveListing({ listing });

		fireEvent.change(screen.getAllByLabelText("Number of fractions")[0]!, {
			target: { value: "6" },
		});

		expect(firstCheckoutButton().disabled).toBe(true);
		expect(screen.getAllByText("Enter 1 to 5 fractions.").length).toBeGreaterThan(0);
	});

	it("requires a valid guest lawyer email", () => {
		renderInteractiveListing({ listing: listingWithoutPlatformLawyers() });

		fireEvent.click(
			screen.getAllByRole("button", { name: "Guest lawyer fallback" })[0]!
		);
		fireEvent.change(screen.getAllByLabelText("Name")[0]!, {
			target: { value: "Jordan Counsel" },
		});
		fireEvent.change(screen.getAllByLabelText("Email")[0]!, {
			target: { value: "not-an-email" },
		});

		expect(firstCheckoutButton().disabled).toBe(true);
		expect(
			screen.getAllByText("Enter a guest lawyer name and valid email.").length
		).toBeGreaterThan(0);
	});

	it("renders LSO search rows, disables restricted lawyers, and requires email when missing", () => {
		const listing = getListing({
			checkout: {
				...listingWithoutPlatformLawyers().checkout!,
				lsoLawyerSearchResults: [
					{
						barNumber: "L12345",
						displayName: "Jane Eligible",
						email: null,
						firmName: "Eligible LLP",
						jurisdiction: "ON",
						licensingStatus: "licensed",
						lsoLawyerId: "lso_eligible" as Id<"lsoLawyers">,
						restrictionStatus: "clear",
						restrictionSummary: null,
						selectable: true,
						source: "lso_import",
						sourceFetchedAt: 1_710_000_000_000,
					},
					{
						barNumber: "L99999",
						displayName: "Rita Restricted",
						email: "rita@example.test",
						firmName: "Restricted LLP",
						jurisdiction: "ON",
						licensingStatus: "suspended",
						lsoLawyerId: "lso_restricted" as Id<"lsoLawyers">,
						restrictionStatus: "suspended",
						restrictionSummary: "Suspended by LSO",
						selectable: false,
						source: "manual_admin",
						sourceFetchedAt: 1_710_000_000_000,
					},
				],
			},
		});
		renderInteractiveListing({ listing });

		expect(screen.getAllByText("Jane Eligible").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Rita Restricted").length).toBeGreaterThan(0);
		expect(screen.getAllByText("Not selectable").length).toBeGreaterThan(0);
		expect(screen.getAllByLabelText("Contact email").length).toBeGreaterThan(0);
		expect(firstCheckoutButton().disabled).toBe(true);
	});

	it("starts checkout with an LSO-backed guest lawyer selection", async () => {
		const onStartCheckout = vi.fn().mockResolvedValue({
			ok: true,
			checkoutSessionId: "checkout_123",
			expiresAt: Date.now() + 300_000,
			stripeCheckoutUrl: "https://checkout.stripe.test/session",
		});
		const listing = getListing({
			checkout: {
				...listingWithoutPlatformLawyers().checkout!,
				lsoLawyerSearchResults: [
					{
						barNumber: "L12345",
						displayName: "Jane Eligible",
						email: "jane@example.test",
						firmName: "Eligible LLP",
						jurisdiction: "ON",
						licensingStatus: "licensed",
						lsoLawyerId: "lso_eligible" as Id<"lsoLawyers">,
						restrictionStatus: "clear",
						restrictionSummary: null,
						selectable: true,
						source: "lso_import",
						sourceFetchedAt: 1_710_000_000_000,
					},
				],
			},
		});
		renderInteractiveListing({ listing, onStartCheckout });

		fireEvent.click(firstCheckoutButton());

		await waitFor(() => {
			expect(onStartCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedLawyer: expect.objectContaining({
						type: "guest_lawyer",
						source: "lso_search",
						name: "Jane Eligible",
						email: "jane@example.test",
						lso: expect.objectContaining({
							barNumber: "L12345",
							jurisdiction: "ON",
							lsoLawyerId: "lso_eligible",
							source: "lso_import",
							sourceFetchedAt: 1_710_000_000_000,
						}),
					}),
				})
			);
		});
	});

	it("starts checkout with explicit manual guest fallback when no platform lawyer is configured", async () => {
		const onStartCheckout = vi.fn().mockResolvedValue({
			ok: true,
			checkoutSessionId: "checkout_123",
			expiresAt: Date.now() + 300_000,
			stripeCheckoutUrl: "https://checkout.stripe.test/session",
		});
		renderInteractiveListing({
			listing: listingWithoutPlatformLawyers(),
			onStartCheckout,
		});

		fireEvent.click(
			screen.getAllByRole("button", { name: "Guest lawyer fallback" })[0]!
		);
		fireEvent.change(screen.getAllByLabelText("Name")[0]!, {
			target: { value: "Jordan Counsel" },
		});
		fireEvent.change(screen.getAllByLabelText("Email")[0]!, {
			target: { value: "jordan@example.test" },
		});
		fireEvent.click(firstCheckoutButton());

		await waitFor(() => {
			expect(onStartCheckout).toHaveBeenCalledWith(
				expect.objectContaining({
					selectedLawyer: {
						type: "guest_lawyer",
						source: "manual",
						name: "Jordan Counsel",
						email: "jordan@example.test",
					},
				})
			);
		});
	});

	it("renders stable copy for thrown checkout start failures", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		const onStartCheckout = vi.fn().mockRejectedValue(new Error("internal stack"));
		renderInteractiveListing({ onStartCheckout });

		fireEvent.click(firstCheckoutButton());

		expect(
			await screen.findAllByText("Unable to start hosted checkout. Please try again.")
		).toHaveLength(2);
		expect(consoleError).toHaveBeenCalledWith(
			"[ListingDetailPage] hosted checkout start failed",
			expect.objectContaining({
				listingId: "first-mortgage-north-york",
				message: "internal stack",
				portalId: "portal_test",
				requestedFractions: 100,
				stage: "start_action",
			})
		);
		expect(screen.queryByText("internal stack")).toBeNull();
	});

	it("guards against duplicate checkout submissions while pending", async () => {
		let resolveStart: (value: Awaited<ReturnType<NonNullable<Parameters<typeof ListingDetailPage>[0]["onStartCheckout"]>>>) => void;
		const onStartCheckout = vi.fn(
			() =>
				new Promise<
					Awaited<
						ReturnType<
							NonNullable<Parameters<typeof ListingDetailPage>[0]["onStartCheckout"]>
						>
					>
				>((resolve) => {
					resolveStart = resolve;
				})
		);
		renderInteractiveListing({ onStartCheckout });

		const button = firstCheckoutButton();
		fireEvent.click(button);
		fireEvent.click(button);

		await waitFor(() => {
			expect(onStartCheckout).toHaveBeenCalledTimes(1);
			expect(button.disabled).toBe(true);
		});

		resolveStart!({
			ok: true,
			checkoutSessionId: "checkout_123",
			expiresAt: Date.now() + 300_000,
			stripeCheckoutUrl: "https://checkout.stripe.test/session",
		});
	});

	it.each([
		["abandoned", "Checkout canceled"],
		["error", "Checkout status unavailable"],
		["expired", "Checkout expired"],
		["provider_start_failed", "Hosted checkout did not open"],
		["success_pending", "Checkout received"],
	] satisfies Array<[ListingCheckoutReturnState, string]>)(
		"renders the %s return-state banner",
		(checkoutReturnState, heading) => {
			renderInteractiveListing({ checkoutReturnState });

			expect(screen.getAllByText(heading).length).toBeGreaterThan(0);
		}
	);
});
