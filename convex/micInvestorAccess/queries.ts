import { adminQuery, requirePermission } from "../fluent";
import { micInvestorAccessListArgsValidator } from "./validators";

export const listRequests = adminQuery
	.use(requirePermission("admin:access"))
	.input(micInvestorAccessListArgsValidator)
	.handler(async (ctx, args) => {
		const status = args.status;
		const requests =
			status !== undefined
				? await ctx.db
						.query("micInvestorAccessRequests")
						.withIndex("by_status", (query) => query.eq("status", status))
						.collect()
				: await ctx.db.query("micInvestorAccessRequests").collect();

		return await Promise.all(
			requests.map(async (request) => {
				const portal = await ctx.db.get(request.portalId);
				return {
					portal,
					request,
				};
			})
		);
	})
	.public();
