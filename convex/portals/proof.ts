import { ConvexError, v } from "convex/values";
import { assertMortgageAccess } from "../authz/resourceAccess";
import {
	portalAuthedQuery,
	portalBorrowerQuery,
	portalLenderQuery,
	portalPublicQuery,
} from "../fluent";
import {
	buildPortalFilterBounds,
	buildPortalPricingProjection,
} from "./middleware";

async function canReadMortgageProof(
	ctx: Parameters<typeof assertMortgageAccess>[0],
	mortgageId: Parameters<typeof assertMortgageAccess>[1]
) {
	try {
		await assertMortgageAccess(ctx, mortgageId);
		return true;
	} catch (error) {
		if (error instanceof ConvexError) {
			return false;
		}
		throw error;
	}
}

export const getPortalPublicContextProof = portalPublicQuery()
	.handler(async (ctx) => {
		return { portal: ctx.portal };
	})
	.internal();

export const getPortalMortgageAccessProof = portalAuthedQuery({
	mortgageId: v.id("mortgages"),
})
	.handler(async (ctx, args) => {
		return {
			accessMode: ctx.portalAccess.mode,
			filterBounds: buildPortalFilterBounds(ctx.portal),
			mortgageAllowed: await canReadMortgageProof(ctx, args.mortgageId),
			portalId: ctx.portal.portalId,
			pricingProjection: buildPortalPricingProjection(ctx.portal),
		};
	})
	.internal();

export const getPortalBorrowerContextProof = portalBorrowerQuery()
	.handler(async (ctx) => {
		return {
			accessMode: ctx.portalAccess.mode,
			borrowerId: ctx.borrower._id,
			portalId: ctx.portal.portalId,
		};
	})
	.internal();

export const getPortalLenderContextProof = portalLenderQuery()
	.handler(async (ctx) => {
		return {
			accessMode: ctx.portalAccess.mode,
			filterBounds: buildPortalFilterBounds(ctx.portal),
			lenderId: ctx.lender._id,
			portalId: ctx.portal.portalId,
			pricingProjection: buildPortalPricingProjection(ctx.portal),
		};
	})
	.internal();
