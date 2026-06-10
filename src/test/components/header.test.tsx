/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import Header from "#/components/header";

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		className,
		to,
	}: {
		children: ReactNode;
		className?: string;
		to: string;
	}) => (
		<a className={className} href={to}>
			{children}
		</a>
	),
}));

vi.mock("#/components/theme-toggle", () => ({
	default: () => <button type="button">Theme</button>,
}));

vi.mock("#/components/workos-user.tsx", () => ({
	default: () => <button type="button">Account</button>,
}));

describe("Header", () => {
	it("keeps the demos menu content hidden until the details control opens", () => {
		render(<Header portalContext={{ canonicalHost: "app.localhost:3000" }} />);

		const details = screen.getByText("Demos").closest("details");
		const menuPanel = details?.querySelector("div.mt-2");

		expect(details).not.toBeNull();
		expect(details?.className).toContain("group");
		expect(menuPanel?.className).toContain("hidden");
		expect(menuPanel?.className).toContain("group-open:block");
	});
});
