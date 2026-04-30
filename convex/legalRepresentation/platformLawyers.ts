import { v } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import { adminMutation, adminQuery, listingQuery } from "../fluent";
import {
	listPlatformLawyerOptions,
	listPlatformLawyerProfiles,
	setPlatformLawyerStatus,
	toPlatformLawyerOption,
	upsertPlatformLawyerProfile,
} from "./profiles";
import { legalRepresentationPlatformStatusValidator } from "./validators";

const PLATFORM_LAWYER_ROLE_SLUG = "platform_lawyer";

const platformLawyerInput = {
	authId: v.optional(v.string()),
	email: v.string(),
	displayName: v.string(),
	firmName: v.optional(v.string()),
	barNumber: v.optional(v.string()),
	jurisdiction: v.optional(v.string()),
};

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
				(membership.roleSlug === PLATFORM_LAWYER_ROLE_SLUG ||
					membership.roleSlugs?.includes(PLATFORM_LAWYER_ROLE_SLUG) === true)
		)
	) {
		await ctx.db.insert("organizationMemberships", {
			organizationName: "Seed Law Firm",
			organizationWorkosId: "org_seed_lawfirm",
			roleSlug: PLATFORM_LAWYER_ROLE_SLUG,
			roleSlugs: [PLATFORM_LAWYER_ROLE_SLUG],
			status: "active",
			userWorkosId: args.authId,
			workosId: `om_seed_${args.authId}`,
		});
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
		return await listPlatformLawyerOptions(ctx);
	})
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
