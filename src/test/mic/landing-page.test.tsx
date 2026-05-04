/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MicLandingPage } from "#/components/mic/MicLandingPage";

const submitRequestMock = vi.fn();

vi.mock("convex/react", () => ({
	useMutation: () => submitRequestMock,
}));

vi.mock("../../../convex/_generated/api", () => ({
	api: {
		micInvestorAccessRequests: {
			mutations: {
				submitPublicRequest: "submitPublicRequest",
			},
		},
	},
}));

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("MIC landing page", () => {
	it("renders the landing page with heading, description, email form, and sign-in button", () => {
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		expect(screen.getByText("mic portal")).toBeTruthy();
		expect(
			screen.getByText(/Request access to offering memorandums/i)
		).toBeTruthy();
		expect(screen.getByLabelText(/Email address/i)).toBeTruthy();
		expect(screen.getByRole("button", { name: /Request access/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /Sign in/i })).toBeTruthy();
		expect(screen.getByRole("link", { name: /Sign up/i })).toBeTruthy();
	});

	it("submits the email form and shows loading state", async () => {
		submitRequestMock.mockResolvedValueOnce(undefined);
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		const emailInput = screen.getByLabelText(/Email address/i);
		const submitButton = screen.getByRole("button", { name: /Request access/i });

		fireEvent.change(emailInput, { target: { value: "test@example.com" } });
		fireEvent.click(submitButton);

		expect(screen.getByRole("button", { name: /Submitting/i })).toBeTruthy();

		await waitFor(() => {
			expect(submitRequestMock).toHaveBeenCalledWith({
				email: "test@example.com",
				portalId: "portal_mic",
			});
		});
	});

	it("shows generic success message after successful submission", async () => {
		submitRequestMock.mockResolvedValueOnce(undefined);
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		const emailInput = screen.getByLabelText(/Email address/i);
		const submitButton = screen.getByRole("button", { name: /Request access/i });

		fireEvent.change(emailInput, { target: { value: "test@example.com" } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(screen.getByText("Request received")).toBeTruthy();
		});
		expect(
			screen.getByText(/Your request has been received/i)
		).toBeTruthy();
	});

	it("shows validation error for invalid email", () => {
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		const submitButton = screen.getByRole("button", { name: /Request access/i });
		fireEvent.click(submitButton);

		expect(screen.getByText("Enter a valid email address")).toBeTruthy();
	});

	it("shows server error when mutation fails including duplicate errors", async () => {
		submitRequestMock.mockRejectedValueOnce(
			new Error("A request with this email already exists.")
		);
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		const emailInput = screen.getByLabelText(/Email address/i);
		const submitButton = screen.getByRole("button", { name: /Request access/i });

		fireEvent.change(emailInput, { target: { value: "test@example.com" } });
		fireEvent.click(submitButton);

		await waitFor(() => {
			expect(
				screen.getByText(/A request with this email already exists./i)
			).toBeTruthy();
		});
	});

	it("links sign-in button to /sign-in?redirect=/portal", () => {
		render(<MicLandingPage portalId="portal_mic" portalSlug="mic" />);

		const signInLink = screen.getByRole("link", { name: /Sign in/i });
		expect(signInLink.getAttribute("href")).toBe("/sign-in?redirect=/portal");
	});
});
