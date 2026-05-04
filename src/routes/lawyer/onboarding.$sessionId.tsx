import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { LawyerOnboardingPage } from "#/components/legal-representation/LawyerOnboardingPage";
import { guardAuthenticated } from "#/lib/auth";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

function lawyerOnboardingQueryOptions(sessionId: string) {
	return convexQuery(
		api.legalRepresentation.onboarding.getLawyerOnboardingSession,
		{
			sessionId: sessionId as Id<"lawyerOnboardingSessions">,
		}
	);
}

export const Route = createFileRoute("/lawyer/onboarding/$sessionId")({
	beforeLoad: guardAuthenticated(),
	loader: async ({ context, params }) => {
		const session = await context.queryClient.ensureQueryData(
			lawyerOnboardingQueryOptions(params.sessionId)
		);
		if (!session) {
			throw notFound();
		}
		return { sessionId: params.sessionId };
	},
	component: LawyerOnboardingRouteComponent,
});

export function LawyerOnboardingRouteComponent() {
	const { sessionId } = Route.useLoaderData();
	const { data } = useSuspenseQuery(lawyerOnboardingQueryOptions(sessionId));
	if (!data) {
		throw notFound();
	}
	return (
		<>
			<Authenticated>
				<LawyerOnboardingPage session={data} />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}
