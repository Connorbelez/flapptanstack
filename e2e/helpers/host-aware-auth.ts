const defaultE2EPort = 3000;

export function getE2EPort() {
	return Number(process.env.E2E_PORT ?? defaultE2EPort);
}

function resolvePort(source: number | string) {
	if (typeof source === "number") {
		return source;
	}

	const { port } = new URL(source);
	if (!port) {
		throw new Error("Expected baseURL to include an explicit localhost port");
	}

	return Number(port);
}

export function getAppLocalHost(portOrBaseUrl: number | string = getE2EPort()) {
	const port = resolvePort(portOrBaseUrl);
	return `app.localhost:${port}`;
}

export function buildLocalOrigin(host: string) {
	return `http://${host}`;
}

export function buildHostAwareSignInHref(
	host: string,
	redirectPath = "/demo/workos"
) {
	const url = new URL("/sign-in", buildLocalOrigin(host));
	url.searchParams.set("redirect", redirectPath);
	return url.toString();
}
