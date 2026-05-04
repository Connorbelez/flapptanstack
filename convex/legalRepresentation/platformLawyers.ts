import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery, listingQuery } from "../fluent";
import { projectPlatformLawyerAvailability } from "./availability";
import type { PlatformLawyerOption } from "./profiles";
import {
	listPlatformLawyerOptions,
	listPlatformLawyerProfiles,
	setPlatformLawyerStatus,
	toPlatformLawyerOption,
	upsertPlatformLawyerProfile,
} from "./profiles";
import { legalRepresentationPlatformStatusValidator } from "./validators";

type PlatformLawyerQueryCtx = Pick<QueryCtx, "db">;
type PlatformLawyerMutationCtx = Pick<MutationCtx, "db">;

const CANONICAL_LAWYER_ROLE_SLUG = "lawyer";
const DEFAULT_CAPACITY_LIMIT = 3;

const ACTIVE_DEAL_STATUSES = [
	"lawyerOnboarding.pending",
	"lawyerOnboarding.verified",
	"documentReview.pending",
	"documentReview.signed",
] as const;

const platformLawyerInput = {
	authId: v.optional(v.string()),
	email: v.string(),
	displayName: v.string(),
	firmName: v.optional(v.string()),
	barNumber: v.optional(v.string()),
	jurisdiction: v.optional(v.string()),
};

export type PlatformLawyerCapacityWarning =
	| "none"
	| "approaching"
	| "full"
	| "over_capacity";

export interface PlatformLawyerCheckoutOption extends PlatformLawyerOption {
	readonly activeDealCount: number;
	readonly availability: readonly {
		readonly businessDate: string;
		readonly hasAvailability: boolean;
		readonly isOnHold: boolean;
		readonly label: string;
		readonly windows: readonly string[];
	}[];
	readonly capacityLimit: number;
	readonly capacityWarning: PlatformLawyerCapacityWarning;
	readonly selectable: boolean;
	readonly slaTier?: {
		readonly id: Id<"platformLawyerSlaTiers">;
		readonly name: string;
		readonly reviewHours: number;
	};
}

function warningForCapacity(
	activeDealCount: number,
	capacityLimit: number
): PlatformLawyerCapacityWarning {
	if (capacityLimit <= 0) {
		return activeDealCount > 0 ? "over_capacity" : "full";
	}
	if (activeDealCount > capacityLimit) {
		return "over_capacity";
	}
	if (activeDealCount === capacityLimit) {
		return "full";
	}
	return activeDealCount >= Math.max(1, Math.floor(capacityLimit * 0.8))
		? "approaching"
		: "none";
}

async function getAssignment(
	ctx: PlatformLawyerQueryCtx,
	lawyerProfileId: Id<"lawyerProfiles">
) {
	return await ctx.db
		.query("platformLawyerAssignments")
		.withIndex("by_lawyer_profile", (query) =>
			query.eq("lawyerProfileId", lawyerProfileId)
		)
		.unique();
}

async function ensureSeedLawyerIdentity(
	ctx: Pick<MutationCtx, "db">,
	args: {
		readonly authId: string;
		readonly email: string;
		readonly displayName: string;
	}
) {
	const existingUser = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", args.authId))
		.unique();
	if (!existingUser) {
		const [firstName, ...lastNameParts] = args.displayName.split(" ");
		await ctx.db.insert("users", {
			authId: args.authId,
			email: args.email,
			firstName: firstName || args.displayName,
			lastName: lastNameParts.join(" ") || "Lawyer",
		});
	}
	const memberships = await ctx.db
		.query("organizationMemberships")
		.withIndex("byUser", (query) => query.eq("userWorkosId", args.authId))
		.collect();
	if (
		!memberships.some(
			(membership) =>
				membership.status === "active" &&
				(membership.roleSlug === CANONICAL_LAWYER_ROLE_SLUG ||
					membership.roleSlugs?.includes(CANONICAL_LAWYER_ROLE_SLUG) === true)
		)
	) {
		await ctx.db.insert("organizationMemberships", {
			organizationName: "Seed Law Firm",
			organizationWorkosId: "org_seed_lawfirm",
			roleSlug: CANONICAL_LAWYER_ROLE_SLUG,
			roleSlugs: [CANONICAL_LAWYER_ROLE_SLUG],
			status: "active",
			userWorkosId: args.authId,
			workosId: `om_seed_${args.authId}`,
		});
	}
}

export async function countActivePlatformLawyerDeals(
	ctx: PlatformLawyerQueryCtx,
	args: { readonly lawyerAuthId: string }
): Promise<number> {
	let count = 0;
	for (const status of ACTIVE_DEAL_STATUSES) {
		const deals = await ctx.db
			.query("deals")
			.withIndex("by_status", (query) => query.eq("status", status))
			.collect();
		count += deals.filter((deal) => deal.lawyerId === args.lawyerAuthId).length;
	}
	return count;
}

export async function listPlatformLawyerCheckoutOptions(
	ctx: PlatformLawyerQueryCtx,
	args?: { readonly now?: number }
): Promise<PlatformLawyerCheckoutOption[]> {
	const now = args?.now ?? Date.now();
	const platformOptions = await listPlatformLawyerOptions(ctx, { now });
	const options = await Promise.all(
		platformOptions.map(async (option) => {
			const assignment = await getAssignment(ctx, option.lawyerProfileId);
			const activeDealCount = await countActivePlatformLawyerDeals(ctx, {
				lawyerAuthId: option.lawyerId,
			});
			const capacityLimit = assignment?.capacityLimit ?? DEFAULT_CAPACITY_LIMIT;
			const slaTier = assignment?.slaTierId
				? await ctx.db.get(assignment.slaTierId)
				: null;
			const availability = await projectPlatformLawyerAvailability(ctx, {
				lawyerProfileId: option.lawyerProfileId,
				now,
			});
			const hasHold = availability.some((day) => day.isOnHold);
			const hasCapacity = activeDealCount < capacityLimit;
			return {
				...option,
				activeDealCount,
				availability,
				capacityLimit,
				capacityWarning: warningForCapacity(activeDealCount, capacityLimit),
				selectable:
					option.eligibilityStatus === "eligible" && !hasHold && hasCapacity,
				...(slaTier && slaTier.status === "active"
					? {
							slaTier: {
								id: slaTier._id,
								name: slaTier.name,
								reviewHours: slaTier.reviewHours,
							},
						}
					: {}),
			};
		})
	);
	return options.filter((option) => option.selectable);
}

export async function assertPlatformLawyerSelectableForCheckout(
	ctx: PlatformLawyerQueryCtx,
	args: {
		readonly lawyerAuthId?: string;
		readonly now?: number;
	}
): Promise<void> {
	if (!args.lawyerAuthId) {
		throw new ConvexError("Platform lawyer selection requires lawyerId");
	}
	const options = await listPlatformLawyerCheckoutOptions(ctx, {
		now: args.now,
	});
	if (!options.some((option) => option.lawyerId === args.lawyerAuthId)) {
		throw new ConvexError(
			"Platform lawyer is not eligible for new checkout selection"
		);
	}
}

export const listPlatformLawyersForAdmin = adminQuery
	.handler(async (ctx) => {
		const now = Date.now();
		const profiles = await listPlatformLawyerProfiles(ctx);
		return await Promise.all(
			profiles.map(async (profile) => ({
				profile,
				option: await toPlatformLawyerOption(ctx, profile, now),
			}))
		);
	})
	.public();

export const listCheckoutPlatformLawyerOptions = listingQuery
	.handler(async (ctx) => {
		return await listPlatformLawyerCheckoutOptions(ctx);
	})
	.public();

export const listAdminPlatformLawyerOptions = adminQuery
	.input({})
	.handler(async (ctx) => await listPlatformLawyerCheckoutOptions(ctx))
	.public();

export const createOrDesignatePlatformLawyer = adminMutation
	.input({
		...platformLawyerInput,
		platformStatus: v.optional(legalRepresentationPlatformStatusValidator),
	})
	.handler(async (ctx, args) => {
		return await upsertPlatformLawyerProfile(ctx, {
			...args,
			actorId: ctx.viewer.authId,
		});
	})
	.public();

export const activatePlatformLawyer = adminMutation
	.input({ profileId: v.id("lawyerProfiles") })
	.handler(async (ctx, args) => {
		return await setPlatformLawyerStatus(ctx, {
			actorId: ctx.viewer.authId,
			profileId: args.profileId,
			status: "active",
		});
	})
	.public();

export const suspendPlatformLawyer = adminMutation
	.input({ profileId: v.id("lawyerProfiles") })
	.handler(async (ctx, args) => {
		return await setPlatformLawyerStatus(ctx, {
			actorId: ctx.viewer.authId,
			profileId: args.profileId,
			status: "suspended",
		});
	})
	.public();

export const offboardPlatformLawyer = adminMutation
	.input({ profileId: v.id("lawyerProfiles") })
	.handler(async (ctx, args) => {
		return await setPlatformLawyerStatus(ctx, {
			actorId: ctx.viewer.authId,
			profileId: args.profileId,
			status: "offboarded",
		});
	})
	.public();

export const upsertPlatformLawyerAssignment = adminMutation
	.input({
		lawyerProfileId: v.id("lawyerProfiles"),
		slaTierId: v.optional(v.id("platformLawyerSlaTiers")),
		capacityLimit: v.number(),
		recheckIntervalDays: v.optional(v.number()),
		nextRestrictionRecheckAt: v.optional(v.number()),
	})
	.handler(async (ctx, args) => {
		if (args.capacityLimit < 0) {
			throw new ConvexError("capacityLimit cannot be negative");
		}
		const profileOption = await toPlatformLawyerOption(
			ctx,
			await assertPlatformLawyerProfile(ctx, args.lawyerProfileId),
			Date.now()
		);
		if (!profileOption) {
			throw new ConvexError("Lawyer profile is not a platform lawyer");
		}
		const now = Date.now();
		const existing = await getAssignment(ctx, args.lawyerProfileId);
		const patch = {
			slaTierId: args.slaTierId,
			capacityLimit: args.capacityLimit,
			recheckIntervalDays: args.recheckIntervalDays ?? 30,
			nextRestrictionRecheckAt:
				args.nextRestrictionRecheckAt ?? now + 30 * 24 * 60 * 60 * 1000,
			updatedAt: now,
			updatedBy: ctx.viewer.authId,
		};
		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return existing._id;
		}
		return await ctx.db.insert("platformLawyerAssignments", {
			lawyerProfileId: args.lawyerProfileId,
			...patch,
			createdAt: now,
			createdBy: ctx.viewer.authId,
		});
	})
	.public();

async function assertPlatformLawyerProfile(
	ctx: PlatformLawyerQueryCtx,
	lawyerProfileId: Id<"lawyerProfiles">
) {
	const profile = await ctx.db.get(lawyerProfileId);
	if (!profile) {
		throw new ConvexError("Lawyer profile not found");
	}
	if (profile.profileKind !== "platform" && profile.profileKind !== "both") {
		throw new ConvexError("Lawyer profile is not a platform lawyer");
	}
	return profile;
}

export const seedPlatformLawyerProfile = adminMutation
	.input({
		authId: v.string(),
		email: v.string(),
		displayName: v.string(),
		firmName: v.optional(v.string()),
		barNumber: v.optional(v.string()),
		jurisdiction: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		await ensureSeedLawyerIdentity(ctx, {
			authId: args.authId,
			displayName: args.displayName,
			email: args.email,
		});
		return await upsertPlatformLawyerProfile(ctx, {
			...args,
			actorId: ctx.viewer.authId,
			platformStatus: "active",
		});
	})
	.public();

export const seedPlatformLawyerRoster = adminMutation
	.handler(async (ctx) => {
		const now = Date.now();
		await ensureSeedLawyerIdentity(ctx, {
			authId: "user_platform_lawyer_avery",
			displayName: "Avery Chen",
			email: "avery.chen@example.test",
		});
		const activeOne = await upsertPlatformLawyerProfile(ctx, {
			actorId: ctx.viewer.authId,
			authId: "user_platform_lawyer_avery",
			barNumber: "LSO-123456",
			createdAt: now,
			displayName: "Avery Chen",
			email: "avery.chen@example.test",
			firmName: "FairLend Panel Law",
			jurisdiction: "ON",
			platformStatus: "active",
		});
		await ensureSeedLawyerIdentity(ctx, {
			authId: "user_platform_lawyer_morgan",
			displayName: "Morgan Patel",
			email: "morgan.patel@example.test",
		});
		const activeTwo = await upsertPlatformLawyerProfile(ctx, {
			actorId: ctx.viewer.authId,
			authId: "user_platform_lawyer_morgan",
			barNumber: "LSO-223344",
			createdAt: now + 1,
			displayName: "Morgan Patel",
			email: "morgan.patel@example.test",
			firmName: "Panel Closing LLP",
			jurisdiction: "ON",
			platformStatus: "active",
		});
		await ensureSeedLawyerIdentity(ctx, {
			authId: "user_platform_lawyer_suspended",
			displayName: "Sam Suspended",
			email: "sam.suspended@example.test",
		});
		const suspended = await upsertPlatformLawyerProfile(ctx, {
			actorId: ctx.viewer.authId,
			authId: "user_platform_lawyer_suspended",
			barNumber: "LSO-998877",
			createdAt: now + 2,
			displayName: "Sam Suspended",
			email: "sam.suspended@example.test",
			firmName: "Suspended Law",
			jurisdiction: "ON",
			platformStatus: "suspended",
		});
		await ensureSeedLawyerIdentity(ctx, {
			authId: "user_platform_lawyer_review",
			displayName: "Riley Review",
			email: "riley.review@example.test",
		});
		const requiresReview = await upsertPlatformLawyerProfile(ctx, {
			actorId: ctx.viewer.authId,
			authId: "user_platform_lawyer_review",
			barNumber: "LSO-445566",
			createdAt: now + 3,
			displayName: "Riley Review",
			email: "riley.review@example.test",
			firmName: "Review Counsel",
			jurisdiction: "ON",
			platformStatus: "invited",
		});
		await setPlatformLawyerStatus(ctx, {
			actorId: ctx.viewer.authId,
			now: now + 4,
			profileId: requiresReview,
			reasonCodes: ["requires_admin_review"],
			status: "active",
		});
		return {
			active: [activeOne, activeTwo],
			requiresReview,
			suspended,
		};
	})
	.public();

export async function patchProfileAfterRestrictionOutcome(
	ctx: PlatformLawyerMutationCtx,
	args: {
		readonly lawyerProfileId: Id<"lawyerProfiles">;
		readonly outcome: "eligible" | "failed" | "ineligible" | "requires_review";
		readonly now: number;
	}
): Promise<void> {
	if (args.outcome === "eligible") {
		await ctx.db.patch(args.lawyerProfileId, {
			platformStatus: "active",
			updatedAt: args.now,
		});
		return;
	}
	await ctx.db.patch(args.lawyerProfileId, {
		platformStatus:
			args.outcome === "ineligible" ? "suspended" : "requires_review",
		updatedAt: args.now,
	});
}
