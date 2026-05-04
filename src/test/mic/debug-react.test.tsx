/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useState } from "react";

function SimpleComponent() {
	const [count] = useState(42);
	return <div data-testid="count">{count}</div>;
}

describe("debug react", () => {
	it("renders with useState", () => {
		render(<SimpleComponent />);
		expect(screen.getByTestId("count").textContent).toBe("42");
	});
});
