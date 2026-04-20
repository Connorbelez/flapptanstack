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
	loadPortalContext,
	resolvePortalAccess,
	resolvePortalBorrower,
	resolvePortalLender,
} from "./middleware";

export const getPortalPublicContextProof = portalPublicQuery()
	.handler(async (ctx, args) => {
		return loadPortalContext(ctx, args.portalId);
	})
	.public();

export const getPortalMortgageAccessProof = portalAuthedQuery({
	mortgageId: v.id("mortgages"),
})
	.handler(async (ctx, args) => {
		const portalContext = await loadPortalContext(ctx, args.portalId);
		const access = await resolvePortalAccess({ ...ctx, ...portalContext });

		return {
			accessMode: access.mode,
			filterBounds: buildPortalFilterBounds(portalContext.portal),
			mortgageAllowed: await canAccessMortgage(
				ctx,
				ctx.viewer,
				args.mortgageId
			),
			portalId: portalContext.portal.portalId,
			pricingProjection: buildPortalPricingProjection(portalContext.portal),
		};
	})
	.public();

export const getPortalBorrowerContextProof = portalBorrowerQuery()
	.handler(async (ctx, args) => {
		const portalContext = await loadPortalContext(ctx, args.portalId);
		const access = await resolvePortalAccess({ ...ctx, ...portalContext });
		const borrower = await resolvePortalBorrower({ ...ctx, ...portalContext });

		return {
			accessMode: access.mode,
			borrowerId: borrower._id,
			portalId: portalContext.portal.portalId,
		};
	})
	.public();

export const getPortalLenderContextProof = portalLenderQuery()
	.handler(async (ctx, args) => {
		const portalContext = await loadPortalContext(ctx, args.portalId);
		const access = await resolvePortalAccess({ ...ctx, ...portalContext });
		const lender = await resolvePortalLender({ ...ctx, ...portalContext });

		return {
			accessMode: access.mode,
			filterBounds: buildPortalFilterBounds(portalContext.portal),
			lenderId: lender._id,
			portalId: portalContext.portal.portalId,
			pricingProjection: buildPortalPricingProjection(portalContext.portal),
		};
	})
	.public();
