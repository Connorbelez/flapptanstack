import { createFileRoute } from "@tanstack/react-router";
import { getAuthkit } from "@workos/authkit-tanstack-react-start";
import { resolveLocalSessionSignOutReturnTo } from "#/lib/portal/auth-routing";

function appendHeadersBag(
	headers: Headers,
	headersBag: Record<string, string | string[]>
) {
	for (const [key, value] of Object.entries(headersBag)) {
		if (Array.isArray(value)) {
			for (const entry of value) {
				headers.append(key, entry);
			}
			continue;
		}

		headers.append(key, value);
	}
}

async function handleLocalSessionSignOut({
	request,
}: Readonly<{ request: Request }>) {
	const requestUrl = new URL(request.url);
	const returnTo = resolveLocalSessionSignOutReturnTo({
		requestUrl,
		returnTo: requestUrl.searchParams.get("returnTo"),
	});

	const redirectResponse = new Response(null, {
		status: 307,
		headers: {
			Location: returnTo,
		},
	});
	const authkit = await getAuthkit();
	const clearedSession = await authkit.clearSession(redirectResponse);

	if (clearedSession.response) {
		if (clearedSession.headers) {
			appendHeadersBag(clearedSession.response.headers, clearedSession.headers);
		}
		return clearedSession.response;
	}

	const headers = new Headers(redirectResponse.headers);
	if (clearedSession.headers) {
		appendHeadersBag(headers, clearedSession.headers);
	}

	return new Response(null, {
		status: 307,
		headers,
	});
}

export const Route = createFileRoute("/sign-out/local")({
	server: {
		handlers: {
			GET: handleLocalSessionSignOut,
		},
	},
});
