/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListingDetailPage } from "#/components/listings/ListingDetailPage";
import type { ListingDetailData } from "#/components/listings/listing-detail-types";
import { getListingDetailMock } from "#/components/demo/listings/listing-detail-mock-data";

vi.mock("react", async () => {
	return await vi.importActual<typeof import("react")>(
		"/Users/connor/.codex/worktrees/ab93/fairlendapp/node_modules/react/index.js"
	);
});

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

afterEach(() => {
	cleanup();
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
			listing={listing}
			mode="interactive"
			onStartCheckout={onStartCheckout}
			portalId="portal_test"
			redirectToHostedCheckout={redirectToHostedCheckout}
		/>
	);

	return { listing, onStartCheckout, redirectToHostedCheckout };
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
		renderInteractiveListing();

		fireEvent.click(screen.getAllByRole("button", { name: "Guest lawyer" })[0]!);

		expect(firstCheckoutButton().disabled).toBe(true);
		expect(screen.getAllByLabelText("Name").length).toBeGreaterThan(0);
		expect(screen.getAllByLabelText("Email").length).toBeGreaterThan(0);
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
});
