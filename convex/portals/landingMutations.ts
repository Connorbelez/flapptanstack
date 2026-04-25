import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { auditLog } from "../auditLog";
import { adminMutation } from "../fluent";
import {
	type PortalLandingPageContent,
	portalLandingPageContentValidator,
	validatePortalLandingPageContentSafety,
} from "./validators";

type PortalLandingMutationCtx = Pick<MutationCtx, "db">;
type LandingContentSection = keyof PortalLandingPageContent;

const LANDING_CONTENT_SECTIONS = [
	"brand",
	"featuredListings",
	"financingStrip",
	"hero",
	"navigation",
	"switchboard",
	"theme",
	"trustStrip",
] as const satisfies readonly LandingContentSection[];

function sectionWasProvided(
	content: PortalLandingPageContent,
	section: LandingContentSection
) {
	return Object.hasOwn(content, section);
}

function getProvidedContentSections(content: PortalLandingPageContent) {
	return LANDING_CONTENT_SECTIONS.filter((section) =>
		sectionWasProvided(content, section)
	);
}

function mergePortalLandingPageContent(
	existing: PortalLandingPageContent | undefined,
	patch: PortalLandingPageContent
): PortalLandingPageContent {
	return {
		...existing,
		...patch,
		brand: patch.brand
			? { ...existing?.brand, ...patch.brand }
			: existing?.brand,
		featuredListings: patch.featuredListings
			? { ...existing?.featuredListings, ...patch.featuredListings }
			: existing?.featuredListings,
		financingStrip: patch.financingStrip
			? { ...existing?.financingStrip, ...patch.financingStrip }
			: existing?.financingStrip,
		hero: patch.hero ? { ...existing?.hero, ...patch.hero } : existing?.hero,
		navigation: patch.navigation
			? { ...existing?.navigation, ...patch.navigation }
			: existing?.navigation,
		switchboard: patch.switchboard
			? {
					...existing?.switchboard,
					...patch.switchboard,
					borrower: patch.switchboard.borrower
						? {
								...existing?.switchboard?.borrower,
								...patch.switchboard.borrower,
							}
						: existing?.switchboard?.borrower,
					intro: patch.switchboard.intro
						? { ...existing?.switchboard?.intro, ...patch.switchboard.intro }
						: existing?.switchboard?.intro,
					lender: patch.switchboard.lender
						? { ...existing?.switchboard?.lender, ...patch.switchboard.lender }
						: existing?.switchboard?.lender,
				}
			: existing?.switchboard,
		theme: patch.theme
			? { ...existing?.theme, ...patch.theme }
			: existing?.theme,
		trustStrip: patch.trustStrip ?? existing?.trustStrip,
	};
}

async function getAttachedLandingPage(args: {
	portal: Doc<"portals">;
	portalId: Id<"portals">;
	ctx: PortalLandingMutationCtx;
}) {
	if (args.portal.landingPageId) {
		const landingPage = await args.ctx.db.get(args.portal.landingPageId);
		if (landingPage?.portalId !== args.portalId) {
			throw new ConvexError("Portal landingPageId points to another portal");
		}
		return landingPage;
	}

	const landingPages = await args.ctx.db
		.query("portalLandingPages")
		.withIndex("by_portal", (query) => query.eq("portalId", args.portalId))
		.collect();
	if (landingPages.length > 1) {
		throw new ConvexError(
			`Duplicate landing-page attachment for ${args.portal.slug}`
		);
	}

	return landingPages[0] ?? null;
}

export const upsertPortalLandingPageContent = adminMutation
	.input({
		content: portalLandingPageContentValidator,
		portalId: v.id("portals"),
	})
	.handler(async (ctx, args): Promise<Id<"portalLandingPages">> => {
		const portal = await ctx.db.get(args.portalId);
		if (!portal) {
			throw new ConvexError(`Portal not found: ${String(args.portalId)}`);
		}

		const providedSections = getProvidedContentSections(args.content);
		const now = Date.now();
		const existing = await getAttachedLandingPage({
			ctx,
			portal,
			portalId: args.portalId,
		});

		if (existing) {
			const content = validatePortalLandingPageContentSafety(
				mergePortalLandingPageContent(existing.v1LandingContent, args.content)
			);
			await ctx.db.patch(existing._id, {
				updatedAt: now,
				v1LandingContent: content,
			});
			if (portal.landingPageId !== existing._id) {
				await ctx.db.patch(args.portalId, {
					landingPageId: existing._id,
					updatedAt: now,
				});
			}
			await auditLog.log(ctx, {
				action: "portal.landing_page_content.updated",
				actorId: ctx.viewer.authId,
				resourceType: "portalLandingPages",
				resourceId: existing._id,
				severity: "info",
				metadata: {
					portalId: args.portalId,
					portalSlug: portal.slug,
					providedSections,
					relinkedPortalLandingPage: portal.landingPageId !== existing._id,
				},
			});
			return existing._id;
		}

		const content = validatePortalLandingPageContentSafety(args.content);
		const landingPageId = await ctx.db.insert("portalLandingPages", {
			createdAt: now,
			portalId: args.portalId,
			updatedAt: now,
			v1LandingContent: content,
		});
		await ctx.db.patch(args.portalId, {
			landingPageId,
			updatedAt: now,
		});
		await auditLog.log(ctx, {
			action: "portal.landing_page_content.created",
			actorId: ctx.viewer.authId,
			resourceType: "portalLandingPages",
			resourceId: landingPageId,
			severity: "info",
			metadata: {
				portalId: args.portalId,
				portalSlug: portal.slug,
				providedSections,
				relinkedPortalLandingPage: true,
			},
		});
		return landingPageId;
	})
	.public();
