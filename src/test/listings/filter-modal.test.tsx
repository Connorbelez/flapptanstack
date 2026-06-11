/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FilterModal from "#/components/listings/filter-modal";
import { DEFAULT_FILTERS } from "#/components/listings/types/listing-filters";

vi.mock("#/hooks/use-mobile", () => ({
	useIsMobile: () => true,
}));

beforeEach(() => {
	class ResizeObserverMock {
		disconnect = vi.fn();
		observe = vi.fn();
		unobserve = vi.fn();
	}

	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation((query: string) => ({
			addEventListener: vi.fn(),
			addListener: vi.fn(),
			dispatchEvent: vi.fn(),
			matches: false,
			media: query,
			onchange: null,
			removeEventListener: vi.fn(),
			removeListener: vi.fn(),
		})),
	});
	Object.defineProperty(window, "ResizeObserver", {
		configurable: true,
		value: ResizeObserverMock,
	});
	Object.defineProperty(globalThis, "ResizeObserver", {
		configurable: true,
		value: ResizeObserverMock,
	});
});

afterEach(() => {
	cleanup();
});

describe("listing filter modal", () => {
	it("opens the mobile drawer from the filter trigger", () => {
		render(
			<FilterModal
				filters={DEFAULT_FILTERS}
				items={[]}
				onFiltersChange={() => undefined}
			/>
		);

		fireEvent.click(screen.getByRole("button", { name: "Open listing filters" }));

		expect(screen.getByRole("heading", { name: "Filters" })).toBeTruthy();
		expect(screen.getByText("Fractions available")).toBeTruthy();
		expect(screen.getByText("Minimum investment")).toBeTruthy();
	});
});
