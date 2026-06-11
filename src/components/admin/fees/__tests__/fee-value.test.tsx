import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeeValue } from "../fee-value";

describe("FeeValue", () => {
	it("renders percentage waterfall fees", () => {
		const html = renderToStaticMarkup(<FeeValue valueLabel="1.00% annually" />);
		expect(html).toContain("1.00% annually");
	});

	it("renders borrower charge amounts", () => {
		const html = renderToStaticMarkup(
			<FeeValue valueLabel="$50.00 one time" />
		);
		expect(html).toContain("$50.00 one time");
	});
});
