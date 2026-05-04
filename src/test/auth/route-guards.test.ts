import { describe, expect, it } from "vitest";
import {
	assertRouteAccess,
	canAccessAdminPath,
	canAccessRoute,
	guardRouteAccess,
	hasAnyPermission,
	hasPermission,
} from "#/lib/auth";

function captureThrown(perform: () => void) {
	try {
		perform();
		return null;
	} catch (error) {
		return error;
	}
}

describe("route auth permission helpers", () => {
	it("treats admin:access as a wildcard permission", () => {
		expect(hasPermission(["admin:access"], "document:review")).toBe(true);
		expect(
			hasAnyPermission(["admin:access"], [
				"underwriter:access",
				"document:review",
			])
		).toBe(true);
	});

	it("can disable the admin wildcard for boundary-sensitive checks", () => {
		expect(
			hasPermission(
				["admin:access"],
				"document:review",
				{ allowAdminOverride: false }
			)
		).toBe(false);
		expect(
			hasAnyPermission(
				["admin:access"],
				["underwriter:access", "document:review"],
				{ allowAdminOverride: false }
			)
		).toBe(false);
	});

	it("still requires exact matches for non-admin permissions", () => {
		expect(hasPermission(["broker:access"], "document:review")).toBe(false);
		expect(
			hasAnyPermission(["broker:access"], [
				"underwriter:access",
				"document:review",
			])
		).toBe(false);
	});

	it("evaluates registered product routes through the shared registry", () => {
		expect(
			canAccessRoute("broker", {
				orgId: "org_broker",
				permissions: ["broker:access"],
				role: "broker",
				roles: ["broker"],
			})
		).toBe(true);

		expect(
			canAccessRoute("adminDocumentEngine", {
				orgId: "org_broker",
				permissions: ["document:review"],
				role: "broker",
				roles: ["broker"],
			})
		).toBe(false);
	});

	it("grants marketplace route access through listing:view", () => {
		expect(
			canAccessRoute("listings", {
				orgId: "org_lender",
				permissions: ["listing:view"],
				role: "lender",
				roles: ["lender"],
			})
		).toBe(true);

		expect(
			canAccessRoute("listings", {
				orgId: "org_member",
				permissions: [],
				role: "member",
				roles: ["member"],
			})
		).toBe(false);

		expect(
			canAccessRoute("listings", {
				orgId: "org_admin",
				permissions: ["admin:access"],
				role: "admin",
				roles: ["admin"],
			})
		).toBe(true);
	});

	it("keeps admin subtree access declarative by path registry", () => {
		expect(
			canAccessAdminPath("/admin/originations/case_123", {
				orgId: "org_ops",
				permissions: ["mortgage:originate"],
				role: "member",
				roles: ["member"],
			})
		).toBe(true);

		expect(
			canAccessAdminPath("/admin/rotessa-reconciliation", {
				orgId: "org_ops",
				permissions: ["mortgage:originate"],
				role: "member",
				roles: ["member"],
			})
		).toBe(false);

		expect(
			canAccessAdminPath("/admin/velocity/workspace_123", {
				orgId: "org_ops",
				permissions: ["mortgage:originate"],
				role: "member",
				roles: ["member"],
			})
		).toBe(true);

		expect(
			canAccessAdminPath("/admin/velocity", {
				orgId: "org_ops",
				permissions: ["payment:manage"],
				role: "member",
				roles: ["member"],
			})
		).toBe(false);
	});

	it("returns a reusable beforeLoad guard for marketplace routes", () => {
		const guard = guardRouteAccess("listings");

		expect(
			captureThrown(() =>
				guard({
					context: {
						userId: "user_lender",
						token: "token",
						orgId: "org_lender",
						permissions: ["listing:view"],
						role: "lender",
						roles: ["lender"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toBeNull();

		expect(
			captureThrown(() =>
				guard({
					context: {
						userId: "user_member",
						token: "token",
						orgId: "org_member",
						permissions: [],
						role: "member",
						roles: ["member"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toMatchObject({
			options: {
				statusCode: 307,
				to: "/unauthorized",
			},
		});
	});

	it("provides a direct helper for composed route guards", () => {
		expect(
			captureThrown(() =>
				assertRouteAccess("listings", {
					context: {
						userId: null,
						token: null,
						orgId: null,
						permissions: [],
						role: null,
						roles: [],
					},
					location: {
						pathname: "/listings",
					},
				})
			)
		).toMatchObject({
			options: {
				statusCode: 307,
				to: "/sign-in",
			},
		});

		expect(
			captureThrown(() =>
				assertRouteAccess("listings", {
					context: {
						userId: "user_lender",
						token: "token",
						orgId: "org_lender",
						permissions: ["listing:view"],
						role: "lender",
						roles: ["lender"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toBeNull();
	});

	it("returns a reusable beforeLoad guard for marketplace routes", () => {
		const guard = guardRouteAccess("listings");

		expect(
			captureThrown(() =>
				guard({
					context: {
						userId: "user_lender",
						token: "token",
						orgId: "org_lender",
						permissions: ["listing:view"],
						role: "lender",
						roles: ["lender"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toBeNull();

		expect(
			captureThrown(() =>
				guard({
					context: {
						userId: "user_member",
						token: "token",
						orgId: "org_member",
						permissions: [],
						role: "member",
						roles: ["member"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toMatchObject({
			options: {
				statusCode: 307,
				to: "/unauthorized",
			},
		});
	});

	it("provides a direct helper for composed route guards", () => {
		expect(
			captureThrown(() =>
				assertRouteAccess("listings", {
					context: {
						userId: null,
						token: null,
						orgId: null,
						permissions: [],
						role: null,
						roles: [],
					},
					location: {
						pathname: "/listings",
					},
				})
			)
		).toMatchObject({
			options: {
				statusCode: 307,
				to: "/sign-in",
			},
		});

		expect(
			captureThrown(() =>
				assertRouteAccess("listings", {
					context: {
						userId: "user_lender",
						token: "token",
						orgId: "org_lender",
						permissions: ["listing:view"],
						role: "lender",
						roles: ["lender"],
					},
					location: {
						href: "/listings",
					},
				})
			)
		).toBeNull();
	});
});
