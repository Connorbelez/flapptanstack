import { ConvexError } from "convex/values";

export function roundToTwoDecimals(value: number) {
	if (!Number.isFinite(value)) {
		throw new ConvexError("Expected a finite number to round");
	}

	return Math.round(value * 100) / 100;
}
