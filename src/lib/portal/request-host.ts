import { createMiddleware } from "@tanstack/react-start";
import { normalizePortalHost } from "../../../shared/portal/contracts";

function firstHeaderValue(headers: Headers, headerName: string) {
	const value = headers.get(headerName);
	if (!value) {
		return undefined;
	}

	const [firstValue] = value
		.split(",")
		.map((segment) => segment.trim())
		.filter(Boolean);
	return firstValue;
}

export function extractTrustedRequestHost(request: Request): string {
	const forwardedHost = firstHeaderValue(request.headers, "x-forwarded-host");
	if (forwardedHost) {
		return normalizePortalHost(forwardedHost);
	}

	const directHost = firstHeaderValue(request.headers, "host");
	if (directHost) {
		return normalizePortalHost(directHost);
	}

	return normalizePortalHost(new URL(request.url).host);
}

export const portalRequestMiddleware = createMiddleware({
	type: "request",
}).server(({ next, request }) => {
	return next({
		context: {
			requestHost: extractTrustedRequestHost(request),
		},
	});
});
