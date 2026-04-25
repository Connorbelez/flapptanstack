export const FAIRLEND_MARKETING_PRODUCTION_HOST = "fairlend.ca";
export const FAIRLEND_MARKETING_WWW_HOST = "www.fairlend.ca";
export const FAIRLEND_MARKETING_LOCAL_HOST = "localhost:3000";
export const FAIRLEND_ADMIN_PRODUCTION_HOST = "admin.fairlend.ca";
export const FAIRLEND_ADMIN_LOCAL_HOST = "admin.localhost:3000";
export const FAIRLEND_PORTAL_SLUG = "app";
export const FAIRLEND_PORTAL_PRODUCTION_HOST = "app.fairlend.ca";
export const FAIRLEND_PORTAL_LOCAL_HOST = "app.localhost:3000";
export const MIC_PORTAL_SLUG = "mic";
export const MIC_PORTAL_PRODUCTION_HOST = "mic.fairlend.ca";
export const MIC_PORTAL_LOCAL_HOST = "mic.localhost:3000";
export const MIC_PORTAL_DEFAULT_POST_AUTH_PATH = "/portal";
export const PORTAL_RESERVED_SLUGS = ["app", "api", "admin", "staging", "www"];

const TRAILING_DOT_REGEX = /\.$/;
const PRODUCTION_PORTAL_SUFFIX = ".fairlend.ca";
const LOCAL_PORTAL_SUFFIX = ".localhost:3000";
const RESERVED_PORTAL_SLUG_SET = new Set<string>(PORTAL_RESERVED_SLUGS);
const MARKETING_HOST_SET = new Set<string>([
	FAIRLEND_MARKETING_PRODUCTION_HOST,
	FAIRLEND_MARKETING_WWW_HOST,
	FAIRLEND_MARKETING_LOCAL_HOST,
]);
const ADMIN_HOST_SET = new Set<string>([
	FAIRLEND_ADMIN_PRODUCTION_HOST,
	FAIRLEND_ADMIN_LOCAL_HOST,
]);

export type PortalHostMatchType = "production" | "local";

export function normalizePortalHost(host: string): string {
	return host.trim().toLowerCase().replace(TRAILING_DOT_REGEX, "");
}

export function normalizePortalSlug(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
}

export function isReservedPortalSlug(slug: string): boolean {
	return RESERVED_PORTAL_SLUG_SET.has(normalizePortalSlug(slug));
}

export function buildPortalHosts(slug: string) {
	const normalizedSlug = normalizePortalSlug(slug);
	if (!normalizedSlug) {
		throw new Error("Portal slug cannot be empty");
	}

	return {
		productionHost: `${normalizedSlug}${PRODUCTION_PORTAL_SUFFIX}`,
		localHost: `${normalizedSlug}${LOCAL_PORTAL_SUFFIX}`,
	};
}

export function isMarketingPortalHost(host: string): boolean {
	return MARKETING_HOST_SET.has(normalizePortalHost(host));
}

export function isAdminPortalHost(host: string): boolean {
	return ADMIN_HOST_SET.has(normalizePortalHost(host));
}

export function canonicalMarketingHost(host: string): string {
	const normalizedHost = normalizePortalHost(host);
	if (normalizedHost === FAIRLEND_MARKETING_WWW_HOST) {
		return FAIRLEND_MARKETING_PRODUCTION_HOST;
	}
	return normalizedHost;
}

export function parsePortalHostCandidate(host: string): {
	hostType: PortalHostMatchType;
	slug: string;
} | null {
	const normalizedHost = normalizePortalHost(host);
	if (
		isMarketingPortalHost(normalizedHost) ||
		isAdminPortalHost(normalizedHost)
	) {
		return null;
	}

	if (normalizedHost.endsWith(PRODUCTION_PORTAL_SUFFIX)) {
		const slug = normalizedHost.slice(0, -PRODUCTION_PORTAL_SUFFIX.length);
		return slug && !slug.includes(".")
			? { hostType: "production", slug }
			: null;
	}

	if (normalizedHost.endsWith(LOCAL_PORTAL_SUFFIX)) {
		const slug = normalizedHost.slice(0, -LOCAL_PORTAL_SUFFIX.length);
		return slug && !slug.includes(".") ? { hostType: "local", slug } : null;
	}

	return null;
}
