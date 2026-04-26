import { ConvexError } from "convex/values";

export function roundToTwoDecimals(value: number) {
	if (!Number.isFinite(value)) {
		throw new ConvexError("Expected a finite number to round");
	}

	// `value * 100` can land just below a half-integer (e.g. `10.075 * 100`), which
	// makes `Math.round` under-round by one cent. Nudge half-way cases using a
	// scale-stable epsilon on the cents value, not on `value` itself.
	const scaled = value * 100;
	if (!Number.isFinite(scaled)) {
		throw new ConvexError("Expected a finite number to round");
	}
	const direction = scaled < 0 ? -1 : 1;
	const adjusted = scaled + direction * 1e-9;
	const rounded = Math.round(adjusted) / 100;
	return Object.is(rounded, -0) ? 0 : rounded;
}
