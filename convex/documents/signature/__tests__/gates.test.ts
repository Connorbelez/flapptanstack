import { describe, expect, it } from "vitest";
import { isDealStatusOpenForEmbeddedSigning } from "../gates";

describe("documents/signature/gates", () => {
	it("keeps embedded signing open while document review is waiting for signatures", () => {
		expect(isDealStatusOpenForEmbeddedSigning("documentReview.pending")).toBe(
			true
		);
		expect(isDealStatusOpenForEmbeddedSigning("documentReview.signed")).toBe(
			true
		);
	});
});
