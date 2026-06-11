import type {
	Auth,
	GenericDatabaseReader,
	GenericDataModel,
} from "convex/server";
import { ConvexError, type PropertyValidators } from "convex/values";
import type {
	Context,
	ConvexArgsValidator,
	ConvexBuilderDef,
	ConvexMiddleware,
	ConvexReturnsValidator,
	EmptyObject,
	FunctionType,
	InferArgs,
} from "fluent-convex";
import { ConvexBuilderWithFunctionKind, createBuilder } from "fluent-convex";
import type { DataModel } from "./_generated/dataModel";
import { auditAuthFailure } from "./auth/auditAuth";
import {
	hasAdminAccessPermission,
	hasEffectivePermission,
	isFairLendStaffAdmin,
	normalizePermissions,
	normalizeRoles,
	resolvePrimaryRole,
} from "./authz/policy";
import type {
	PortalAccessContext,
	PortalBorrowerContext,
	PortalLenderContext,
	PublicPortalResolvedContext,
} from "./portals/middleware";
import {
	type PortalArgs,
	portalArgsValidator,
	withPortalAccess,
	withPortalBorrower,
	withPortalLender,
	withPublicPortalContext,
} from "./portals/middleware";

// ── Builder ─────────────────────────────────────────────────────────
export const convex = createBuilder<DataModel>();

export interface Viewer {
	authId: string;
	email: string | undefined;
	firstName: string | undefined;
	isFairLendAdmin: boolean; // FairLend org + admin master-key holder
	lastName: string | undefined;
	orgId: string | undefined;
	orgName: string | undefined;
	permissions: Set<string>;
	role: string | undefined;
	roles: Set<string>;
	verifiedEmail: string | undefined;
}

function stringClaim(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function booleanClaim(value: unknown): boolean {
	return value === true || value === "true" || value === "1";
}

function resolveVerifiedEmailFromIdentity(identity: {
	user_email?: unknown;
	email?: unknown;
	user_email_verified?: unknown;
	email_verified?: unknown;
}): string | undefined {
	const email = stringClaim(identity.user_email) ?? stringClaim(identity.email);
	if (!email) {
		return undefined;
	}
	const isVerified =
		booleanClaim(identity.user_email_verified) ||
		booleanClaim(identity.email_verified);
	return isVerified ? email.toLowerCase() : undefined;
}
// ── Auth Middleware (context enrichment) ─────────────────────────────
// Uses $context so it works with queries AND mutations (both have auth + db).
// Extracts JWT identity claims and builds a `Viewer` with roles, permissions,
// and org context. Downstream mutations (e.g. onboarding) query the `users`
// table separately — a missing user row will surface as a ConvexError there.
export const authMiddleware = convex
	.$context<{ auth: Auth; db: GenericDatabaseReader<DataModel> }>()
	.createMiddleware(async (context, next) => {
		const identity = await context.auth.getUserIdentity();
		if (!identity) {
			await auditAuthFailure(context, undefined, {
				middleware: "authMiddleware",
				reason: "No identity found — unauthenticated access attempt",
			});
			throw new ConvexError("Unauthorized: sign in required");
		}
		const {
			subject,
			org_id,
			organization_name,
			permissions,
			role,
			roles,
			user_email,
			user_first_name,
			user_last_name,
		} = identity;
		const viewerRole = stringClaim(role);
		const viewerOrgId = stringClaim(org_id);
		const viewerOrgName = stringClaim(organization_name);
		const viewerEmail = stringClaim(user_email);
		const viewerFirstName = stringClaim(user_first_name);
		const viewerLastName = stringClaim(user_last_name);
		const normalizedRoles = normalizeRoles({ role: viewerRole, roles });
		const normalizedPermissions = normalizePermissions(permissions);
		const permissionsSet = new Set(normalizedPermissions);
		const roleSet = new Set(normalizedRoles);
		return next({
			...context,
			viewer: {
				authId: subject,
				email: viewerEmail,
				orgId: viewerOrgId,
				orgName: viewerOrgName,
				firstName: viewerFirstName,
				lastName: viewerLastName,
				role:
					resolvePrimaryRole({ role: viewerRole, roles: normalizedRoles }) ??
					undefined,
				roles: roleSet,
				permissions: permissionsSet,
				isFairLendAdmin: isFairLendStaffAdmin({
					orgId: viewerOrgId ?? null,
					permissions: normalizedPermissions,
					role: viewerRole,
					roles: normalizedRoles,
				}),
				verifiedEmail: resolveVerifiedEmailFromIdentity({
					user_email,
					email: (identity as Record<string, unknown>).email,
					user_email_verified: (identity as Record<string, unknown>)
						.user_email_verified,
					email_verified: (identity as Record<string, unknown>).email_verified,
				}),
			} as Viewer,
		});
	});

export const requireFairLendAdmin = convex
	.$context<{
		db: GenericDatabaseReader<DataModel>;
		auth: Auth;
		viewer: Viewer;
	}>()
	.createMiddleware(async (context, next) => {
		const isFairLendAdmin = context.viewer.isFairLendAdmin;
		if (!isFairLendAdmin) {
			await auditAuthFailure(context, context.viewer, {
				middleware: "requireFairLendAdmin",
				reason: "User is not a FairLend Staff admin",
			});
			throw new ConvexError("Forbidden: fair lend admin role required");
		}
		return next(context);
	});

const UNDERWRITER_ROLES = new Set([
	"sr_underwriter",
	"jr_underwriter",
	"underwriter",
] as const);

function hasUnderwriterRole(viewer: Viewer) {
	for (const role of viewer.roles) {
		if ((UNDERWRITER_ROLES as ReadonlySet<string>).has(role)) {
			return { hasRole: true, role: viewer.role };
		}
	}
	return { hasRole: false, role: viewer.role };
}

export const requireOrgContext = convex
	.$context<{
		db: GenericDatabaseReader<DataModel>;
		auth: Auth;
		viewer: Viewer;
	}>()
	.createMiddleware(async (context, next) => {
		const org_id = context.viewer.orgId;

		if (!(org_id || hasUnderwriterRole(context.viewer).hasRole)) {
			await auditAuthFailure(context, context.viewer, {
				middleware: "requireOrgContext",
				reason: "Missing org context and not an underwriter",
			});
			throw new ConvexError("Forbidden: org context required");
		}
		return next(context);
	});

// ── RBAC: requireAdmin ──────────────────────────────────────────────
// Checks if the authenticated user has at least one membership with
// roleSlug === "admin". Must be used AFTER authMiddleware.
export const requireAdmin = convex
	.$context<{
		db: GenericDatabaseReader<DataModel>;
		auth: Auth;
		viewer: Viewer;
	}>()
	.createMiddleware(async (context, next) => {
		const isAdmin =
			context.viewer.roles.has("admin") ||
			hasAdminAccessPermission(context.viewer.permissions);
		if (!isAdmin) {
			await auditAuthFailure(context, context.viewer, {
				middleware: "requireAdmin",
				reason: "User does not have admin role",
			});
			throw new ConvexError("Forbidden: admin role required");
		}

		return next({ ...context, isAdmin: true as const });
	});

// ── RBAC: requirePermission(permission) factory ─────────────────────
// Returns middleware that checks whether the authenticated viewer already has
// the required permission in their JWT-derived permission set.
export function requirePermission(permission: string) {
	return convex
		.$context<{ db: GenericDatabaseReader<DataModel>; viewer: Viewer }>()
		.createMiddleware(async (context, next) => {
			if (
				!hasEffectivePermission(
					{
						orgId: context.viewer.orgId,
						permissions: context.viewer.permissions,
						role: context.viewer.role,
						roles: context.viewer.roles,
					},
					permission
				)
			) {
				await auditAuthFailure(context, context.viewer, {
					middleware: "requirePermission",
					required: permission,
					reason: `Missing permission: ${permission}`,
				});
				throw new ConvexError(`Forbidden: permission "${permission}" required`);
			}
			return next({ ...context, permission });
		});
}

/**
 * Action-safe permission middleware.
 * Actions do not expose `db`, so this variant relies on `auditAuthFailure`'s
 * action-compatible fallback when recording permission denials.
 */
export function requirePermissionAction(permission: string) {
	return convex
		.$context<{ viewer: Viewer }>()
		.createMiddleware(async (context, next) => {
			if (
				!hasEffectivePermission(
					{
						orgId: context.viewer.orgId,
						permissions: context.viewer.permissions,
						role: context.viewer.role,
						roles: context.viewer.roles,
					},
					permission
				)
			) {
				await auditAuthFailure(context, context.viewer, {
					middleware: "requirePermissionAction",
					required: permission,
					reason: `Missing permission: ${permission}`,
				});
				throw new ConvexError(`Forbidden: permission "${permission}" required`);
			}
			return next({ ...context, permission });
		});
}

// ── Onion Middleware: withLogging ────────────────────────────────────
// Parameterized middleware that wraps the handler, logging start/end
// and catching errors with duration.
export const withLogging = (operationName: string) =>
	convex.createMiddleware(async (context, next) => {
		const start = Date.now();
		console.log(`[${operationName}] Starting...`);
		try {
			const result = await next(context);
			const duration = Date.now() - start;
			console.log(`[${operationName}] Completed in ${duration}ms`);
			return result;
		} catch (error: unknown) {
			const duration = Date.now() - start;
			const message = error instanceof Error ? error.message : String(error);
			console.error(
				`[${operationName}] Failed after ${duration}ms: ${message}`
			);
			throw error;
		}
	});

// ── Custom Plugin: TimedBuilder ─────────────────────────────────────
// Extends ConvexBuilderWithFunctionKind to add a .withTiming(name) method.
// Overrides _clone() so the plugin type survives through .use()/.input() etc.
export class TimedBuilder<
	TDataModel extends GenericDataModel = GenericDataModel,
	TFunctionType extends FunctionType = FunctionType,
	TCurrentContext extends Context = EmptyObject,
	TArgsValidator extends ConvexArgsValidator | undefined = undefined,
	TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
> extends ConvexBuilderWithFunctionKind<
	TDataModel,
	TFunctionType,
	TCurrentContext,
	TArgsValidator,
	TReturnsValidator
> {
	constructor(
		builderOrDef:
			| ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>
			| ConvexBuilderWithFunctionKind<
					TDataModel,
					TFunctionType,
					TCurrentContext,
					TArgsValidator,
					TReturnsValidator
			  >
	) {
		const def =
			builderOrDef instanceof ConvexBuilderWithFunctionKind
				? (
						builderOrDef as unknown as {
							def: ConvexBuilderDef<
								TFunctionType,
								TArgsValidator,
								TReturnsValidator
							>;
						}
					).def
				: builderOrDef;
		super(def);
	}

	protected _clone(
		def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>
	) {
		return new TimedBuilder(def);
	}

	withTiming(operationName: string) {
		return this.use(async (ctx, next) => {
			const start = Date.now();
			console.log(`[TIMER:${operationName}] Start`);
			try {
				const result = await next(ctx);
				console.log(`[TIMER:${operationName}] Done in ${Date.now() - start}ms`);
				return result;
			} catch (error) {
				console.error(
					`[TIMER:${operationName}] Error after ${Date.now() - start}ms`
				);
				throw error;
			}
		});
	}
}

type PortalQueryArgs<TArgsValidator extends ConvexArgsValidator | undefined> =
	PortalArgs &
		(TArgsValidator extends ConvexArgsValidator
			? InferArgs<TArgsValidator>
			: EmptyObject);

type PortalHandlerWrapper<
	TCurrentContext extends Context,
	TPortalContext extends Context,
	TArgsValidator extends ConvexArgsValidator | undefined,
> = <TReturn>(
	handler: (
		context: TCurrentContext & TPortalContext,
		input: PortalQueryArgs<TArgsValidator>
	) => Promise<TReturn>
) => (
	context: TCurrentContext,
	input: PortalQueryArgs<TArgsValidator>
) => Promise<TReturn>;

class PortalBuilder<
	TDataModel extends GenericDataModel = GenericDataModel,
	TFunctionType extends FunctionType = FunctionType,
	TCurrentContext extends Context = EmptyObject,
	TArgsValidator extends ConvexArgsValidator | undefined = undefined,
	TReturnsValidator extends ConvexReturnsValidator | undefined = undefined,
	TPortalContext extends Context = EmptyObject,
> extends ConvexBuilderWithFunctionKind<
	TDataModel,
	TFunctionType,
	TCurrentContext,
	TArgsValidator,
	TReturnsValidator
> {
	private readonly portalHandlerWrapper: PortalHandlerWrapper<
		TCurrentContext,
		TPortalContext,
		TArgsValidator
	>;

	constructor(
		builderOrDef:
			| ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>
			| ConvexBuilderWithFunctionKind<
					TDataModel,
					TFunctionType,
					TCurrentContext,
					TArgsValidator,
					TReturnsValidator
			  >,
		portalHandlerWrapper: PortalHandlerWrapper<
			TCurrentContext,
			TPortalContext,
			TArgsValidator
		>
	) {
		const def =
			builderOrDef instanceof ConvexBuilderWithFunctionKind
				? (
						builderOrDef as unknown as {
							def: ConvexBuilderDef<
								TFunctionType,
								TArgsValidator,
								TReturnsValidator
							>;
						}
					).def
				: builderOrDef;
		super(def);
		this.portalHandlerWrapper = portalHandlerWrapper;
	}

	protected _clone(
		def: ConvexBuilderDef<TFunctionType, TArgsValidator, TReturnsValidator>
	) {
		return new PortalBuilder(def, this.portalHandlerWrapper);
	}

	// @ts-ignore -- narrows return type from base to preserve portal-aware subclass
	use<UOutContext extends Context>(
		middleware: ConvexMiddleware<TCurrentContext, UOutContext>
	): PortalBuilder<
		TDataModel,
		TFunctionType,
		TCurrentContext & UOutContext,
		TArgsValidator,
		TReturnsValidator,
		TPortalContext
	> {
		return super.use(middleware) as unknown as PortalBuilder<
			TDataModel,
			TFunctionType,
			TCurrentContext & UOutContext,
			TArgsValidator,
			TReturnsValidator,
			TPortalContext
		>;
	}

	// @ts-ignore -- narrows return type from base to preserve portal-aware subclass
	input<UInput extends PropertyValidators>(
		validator: UInput
	): PortalBuilder<
		TDataModel,
		TFunctionType,
		TCurrentContext,
		UInput extends ConvexArgsValidator ? UInput : ConvexArgsValidator,
		TReturnsValidator,
		TPortalContext
	> {
		return super.input(validator) as unknown as PortalBuilder<
			TDataModel,
			TFunctionType,
			TCurrentContext,
			UInput extends ConvexArgsValidator ? UInput : ConvexArgsValidator,
			TReturnsValidator,
			TPortalContext
		>;
	}

	// @ts-ignore -- narrows return type from base to preserve portal-aware subclass
	returns<UReturns extends ConvexReturnsValidator>(
		validator: UReturns
	): PortalBuilder<
		TDataModel,
		TFunctionType,
		TCurrentContext,
		TArgsValidator,
		UReturns,
		TPortalContext
	> {
		return super.returns(validator) as unknown as PortalBuilder<
			TDataModel,
			TFunctionType,
			TCurrentContext,
			TArgsValidator,
			UReturns,
			TPortalContext
		>;
	}

	// @ts-ignore -- narrows handler context to include structural portal context
	handler<TReturn>(
		handlerFn: (
			context: TCurrentContext & TPortalContext,
			input: PortalQueryArgs<TArgsValidator>
		) => Promise<TReturn>
	) {
		return super.handler(this.portalHandlerWrapper(handlerFn) as never);
	}
}

// ── Action Auth Middleware (no db — cannot audit) ───────────────────
// Actions lack ctx.db, so we can't call auditAuthFailure. This middleware
// mirrors authMiddleware's Viewer construction without the DB-dependent audit.
export const actionAuthMiddleware = convex
	.$context<{ auth: Auth }>()
	.createMiddleware(async (context, next) => {
		const identity = await context.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError("Unauthorized: sign in required");
		}
		const {
			subject,
			org_id,
			organization_name,
			permissions,
			role,
			roles,
			user_email,
			user_first_name,
			user_last_name,
		} = identity;
		const viewerRole = stringClaim(role);
		const viewerOrgId = stringClaim(org_id);
		const viewerOrgName = stringClaim(organization_name);
		const viewerEmail = stringClaim(user_email);
		const viewerFirstName = stringClaim(user_first_name);
		const viewerLastName = stringClaim(user_last_name);
		const normalizedRoles = normalizeRoles({ role: viewerRole, roles });
		const normalizedPermissions = normalizePermissions(permissions);
		const permissionsSet = new Set(normalizedPermissions);
		const roleSet = new Set(normalizedRoles);
		return next({
			...context,
			viewer: {
				authId: subject,
				email: viewerEmail,
				orgId: viewerOrgId,
				orgName: viewerOrgName,
				firstName: viewerFirstName,
				lastName: viewerLastName,
				role:
					resolvePrimaryRole({ role: viewerRole, roles: normalizedRoles }) ??
					undefined,
				roles: roleSet,
				permissions: permissionsSet,
				isFairLendAdmin: isFairLendStaffAdmin({
					orgId: viewerOrgId ?? null,
					permissions: normalizedPermissions,
					role: viewerRole,
					roles: normalizedRoles,
				}),
				verifiedEmail: resolveVerifiedEmailFromIdentity({
					user_email,
					email: (identity as Record<string, unknown>).email,
					user_email_verified: (identity as Record<string, unknown>)
						.user_email_verified,
					email_verified: (identity as Record<string, unknown>).email_verified,
				}),
			} as Viewer,
		});
	});

export const requireFairLendAdminAction = convex
	.$context<{
		viewer: Viewer;
	}>()
	.createMiddleware(async (context, next) => {
		if (!context.viewer.isFairLendAdmin) {
			await auditAuthFailure(context, context.viewer, {
				middleware: "requireFairLendAdminAction",
				reason: "User is not a FairLend Staff admin",
			});
			throw new ConvexError("Forbidden: fair lend admin role required");
		}
		return next(context);
	});

// ── Reusable Chains ─────────────────────────────────────────────────
// Pre-configured chains with auth middleware baked in.
export const authedQuery = convex.query().use(authMiddleware);
export const authedMutation = convex.mutation().use(authMiddleware);
export const authedAction = convex.action().use(actionAuthMiddleware);
export const adminAction = authedAction.use(requireFairLendAdminAction);
export const adminMutation = convex
	.mutation()
	.use(authMiddleware)
	.use(requireFairLendAdmin);
export const brokerQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("broker:access"));
export const brokerMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("broker:access"));
export const borrowerQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("borrower:access"));
export const borrowerMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("borrower:access"));
export const lenderQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("lender:access"));
export const lenderMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("lender:access"));
export const listingQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("listing:view"));
export const underwriterQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("underwriter:access"));
export const underwriterMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("underwriter:access"));
export const lawyerQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("lawyer:access"));
export const lawyerMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("lawyer:access"));

const requireLawyerOnboardingIdentity = convex
	.$context<{ db: GenericDatabaseReader<DataModel>; viewer: Viewer }>()
	.createMiddleware(async (context, next) => {
		const canUseLawyerOnboarding =
			context.viewer.roles.has("lawyer") ||
			hasEffectivePermission(
				{
					orgId: context.viewer.orgId,
					permissions: context.viewer.permissions,
					role: context.viewer.role,
					roles: context.viewer.roles,
				},
				"lawyer:access"
			);
		if (!canUseLawyerOnboarding) {
			await auditAuthFailure(context, context.viewer, {
				middleware: "requireLawyerOnboardingIdentity",
				reason: "Lawyer onboarding requires a lawyer identity",
			});
			throw new ConvexError("Forbidden: lawyer onboarding identity required");
		}
		return next(context);
	});

export const lawyerOnboardingQuery = authedQuery.use(
	requireLawyerOnboardingIdentity
);
export const lawyerOnboardingMutation = authedMutation.use(
	requireLawyerOnboardingIdentity
);

export const adminQuery = authedQuery.use(requireFairLendAdmin);

type WithoutPortalId<T extends PropertyValidators> = Omit<T, "portalId">;

function withPortalArgs<TInput extends PropertyValidators>(
	input?: WithoutPortalId<TInput>
) {
	if (input !== undefined && Object.hasOwn(input, "portalId")) {
		throw new ConvexError("withPortalArgs does not allow overriding portalId");
	}

	return {
		...portalArgsValidator,
		...(input ?? {}),
	} as typeof portalArgsValidator & TInput;
}

type BuilderContextOf<TBuilder> =
	TBuilder extends ConvexBuilderWithFunctionKind<
		infer _TDataModel extends GenericDataModel,
		infer _TFunctionType extends FunctionType,
		infer TCurrentContext,
		infer _TArgsValidator extends ConvexArgsValidator | undefined,
		infer _TReturnsValidator extends ConvexReturnsValidator | undefined
	>
		? TCurrentContext
		: never;

type BuilderArgsOf<TBuilder> =
	TBuilder extends ConvexBuilderWithFunctionKind<
		infer _TDataModel extends GenericDataModel,
		infer _TFunctionType extends FunctionType,
		infer _TCurrentContext extends Context,
		infer TArgs,
		infer _TReturnsValidator extends ConvexReturnsValidator | undefined
	>
		? TArgs
		: never;

export function portalPublicQuery<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = convex.query().input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"query",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PublicPortalResolvedContext
	>(
		builder,
		withPublicPortalContext as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PublicPortalResolvedContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalAuthedQuery<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = authedQuery.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"query",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalAccessContext
	>(
		builder,
		withPortalAccess as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalAccessContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalAuthedMutation<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = authedMutation.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"mutation",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalAccessContext
	>(
		builder,
		withPortalAccess as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalAccessContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalBorrowerQuery<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = borrowerQuery.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"query",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalBorrowerContext
	>(
		builder,
		withPortalBorrower as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalBorrowerContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalBorrowerMutation<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = borrowerMutation.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"mutation",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalBorrowerContext
	>(
		builder,
		withPortalBorrower as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalBorrowerContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalLenderQuery<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = lenderQuery.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"query",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalLenderContext
	>(
		builder,
		withPortalLender as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalLenderContext,
			BuilderArgsOf<typeof builder>
		>
	);
}

export function portalLenderMutation<TInput extends PropertyValidators>(
	input?: TInput
) {
	const builder = lenderMutation.input(withPortalArgs(input));
	return new PortalBuilder<
		DataModel,
		"mutation",
		BuilderContextOf<typeof builder>,
		BuilderArgsOf<typeof builder>,
		undefined,
		PortalLenderContext
	>(
		builder,
		withPortalLender as PortalHandlerWrapper<
			BuilderContextOf<typeof builder>,
			PortalLenderContext,
			BuilderArgsOf<typeof builder>
		>
	);
}
// Underwriting
export const uwQuery = authedQuery
	.use(requireOrgContext)
	.use(requirePermission("underwriter:access"));
export const uwMutation = authedMutation
	.use(requireOrgContext)
	.use(requirePermission("underwriter:access"));

// Domain-specific (for downstream projects)
export const dealQuery = authedQuery.use(requirePermission("deal:view"));
export const dealMutation = authedMutation.use(
	requirePermission("deal:manage")
);
export const ledgerQuery = authedQuery.use(requirePermission("ledger:view"));
export const ledgerMutation = authedMutation.use(
	requirePermission("ledger:correct")
);
export const cashLedgerQuery = adminQuery.use(
	requirePermission("cash_ledger:view")
);
export const cashLedgerMutation = adminMutation.use(
	requirePermission("cash_ledger:correct")
);
export const paymentQuery = adminQuery.use(requirePermission("payment:view"));
export const paymentMutation = adminMutation.use(
	requirePermission("payment:manage")
);
export const paymentRetryMutation = adminMutation.use(
	requirePermission("payment:retry")
);
export const paymentCancelMutation = adminMutation.use(
	requirePermission("payment:cancel")
);
export const paymentAction = adminAction.use(
	requirePermissionAction("payment:manage")
);
export const paymentOwnQuery = authedQuery.use(
	requirePermission("payment:view_own")
);
export const paymentWebhookMutation = adminMutation.use(
	requirePermission("payment:webhook_process")
);
export const paymentWebhookAction = adminAction.use(
	requirePermissionAction("payment:webhook_process")
);

// ── Document Engine Chains ──────────────────────────────────────────
// Document authoring/generation remains staff-only until the product has a
// dedicated non-admin document operations role model.
export const documentQuery = adminQuery.use(
	requirePermission("document:review")
);
export const documentUploadMutation = adminMutation.use(
	requirePermission("document:upload")
);
export const documentUploadAction = adminAction.use(
	requirePermissionAction("document:upload")
);
export const documentGenerateAction = adminAction.use(
	requirePermissionAction("document:generate")
);

// ── CRM Chains ──────────────────────────────────────────────────────
// Control Plane mutations (admin + org context)
export const crmAdminMutation = authedMutation
	.use(requireOrgContext)
	.use(requireAdmin);

export const crmAdminQuery = authedQuery
	.use(requireOrgContext)
	.use(requireAdmin);

// Data plane remains admin-only until viewer/editor permission splits exist.
export const crmQuery = crmAdminQuery;
export const crmMutation = crmAdminMutation;

export const whoAmI = convex
	.query()
	.use(authMiddleware)
	.handler(async (ctx) => {
		return {
			...ctx.viewer,
			roles: [...ctx.viewer.roles],
			permissions: [...ctx.viewer.permissions],
		};
	})
	.public();
