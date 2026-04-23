import { authedQuery, requirePermission } from "../../fluent";
import {
	buildBrokerOnboardingApplicationReadModel,
	listCandidateBrokerApplications,
	resolveVerifiedEmailFromIdentity,
	selectMostRecentBrokerApplication,
} from "./helpers";

const brokerOnboardingQuery = authedQuery.use(
	requirePermission("onboarding:access")
);

export const getCurrent = brokerOnboardingQuery
	.handler(async (ctx) => {
		const now = Date.now();
		const verifiedEmail = resolveVerifiedEmailFromIdentity(
			await ctx.auth.getUserIdentity()
		);
		const candidates = await listCandidateBrokerApplications(ctx, {
			authUserId: ctx.viewer.authId,
			verifiedEmail,
		});
		const application = selectMostRecentBrokerApplication(candidates);
		if (!application) {
			return null;
		}

		return buildBrokerOnboardingApplicationReadModel(ctx, application, now);
	})
	.public();
