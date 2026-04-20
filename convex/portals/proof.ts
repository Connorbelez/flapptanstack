import { v } from "convex/values";
import { canAccessMortgage } from "../auth/resourceChecks";
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

export const getPortalPublicContextProof = portalPublicQuery()
	.handler(async (ctx) => {
		return { portal: ctx.portal };
	})
	.public();

export const getPortalMortgageAccessProof = portalAuthedQuery({
	mortgageId: v.id("mortgages"),
})
	.handler(async (ctx, args) => {
		return {
			accessMode: ctx.portalAccess.mode,
			filterBounds: buildPortalFilterBounds(ctx.portal),
			mortgageAllowed: await canAccessMortgage(
				ctx,
				ctx.viewer,
				args.mortgageId
			),
			portalId: ctx.portal.portalId,
			pricingProjection: buildPortalPricingProjection(ctx.portal),
		};
	})
	.public();

export const getPortalBorrowerContextProof = portalBorrowerQuery()
	.handler(async (ctx) => {
		return {
			accessMode: ctx.portalAccess.mode,
			borrowerId: ctx.borrower._id,
			portalId: ctx.portal.portalId,
		};
	})
	.public();

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
	.public();
