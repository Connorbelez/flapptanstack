/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
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

	it("renders backend failures without redirecting", async () => {
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
		const onStartCheckout = vi.fn().mockRejectedValue(new Error("internal stack"));
		renderInteractiveListing({ onStartCheckout });

		fireEvent.click(firstCheckoutButton());

		expect(
			await screen.findAllByText("Unable to start hosted checkout. Please try again.")
		).toHaveLength(2);
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
