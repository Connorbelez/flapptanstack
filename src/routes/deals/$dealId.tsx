import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	notFound,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { useEffect } from "react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { DealPortalPage } from "#/components/deals/portal/DealPortalPage";
import { guardAuthenticated } from "#/lib/auth";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function dealPortalQueryOptions(dealId: string) {
	return convexQuery(api.deals.portalQueries.getDealPortalWorkspace, {
		dealId: dealId as Id<"deals">,
	});
}

interface DealPortalRedirectCandidate {
	readonly accessDecision?: {
		readonly redirectTo?: string | null;
	} | null;
	readonly onboarding?: {
		readonly nextRoute?: string | null;
		readonly required?: boolean;
	} | null;
}

function dealPortalRedirectTarget(
	workspace: DealPortalRedirectCandidate | null | undefined,
	dealId: string
) {
	const policyRedirect = workspace?.accessDecision?.redirectTo;
	if (policyRedirect) {
		return policyRedirect;
	}
	if (workspace?.onboarding?.required) {
		return workspace.onboarding.nextRoute ?? `/lawyer/deals/${dealId}`;
	}
	return null;
}

export const Route = createFileRoute("/deals/$dealId")({
	beforeLoad: guardAuthenticated(),
	loader: async ({ context, params }) => {
		const workspace = await context.queryClient.ensureQueryData(
			dealPortalQueryOptions(params.dealId)
		);
		if (!workspace) {
			throw notFound();
		}
		const redirectTo = dealPortalRedirectTarget(workspace, params.dealId);
		if (redirectTo) {
			throw redirect({ href: redirectTo });
		}
		return { dealId: params.dealId };
	},
	component: DealPortalRouteComponent,
});

export function DealPortalRouteComponent() {
	const { dealId } = Route.useLoaderData();
	const { data } = useSuspenseQuery(dealPortalQueryOptions(dealId));
	const navigate = useNavigate();
	const redirectTo = dealPortalRedirectTarget(data, dealId);
	useEffect(() => {
		if (!redirectTo) {
			return;
		}
		void navigate({ href: redirectTo, replace: true });
	}, [navigate, redirectTo]);
	if (!data) {
		throw notFound();
	}
	if (redirectTo) {
		return <AppRoutePendingScreen />;
	}
	return (
		<>
			<Authenticated>
				<DealPortalPage workspace={data} />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}
