import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, AuthLoading } from "convex/react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { guardRouteAccess } from "#/lib/auth";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/portal")({
	beforeLoad: guardRouteAccess("micPortal"),
	component: MicPortalRouteComponent,
});

export function MicPortalRouteComponent() {
	return (
		<>
			<Authenticated>
				<MicPortalProtectedShell />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}

function MicPortalProtectedShell() {
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const portalLabel =
		portalContext.kind === "portal" ? portalContext.portal.slug : "mic";

	return (
		<main className="page-wrap px-4 py-10 sm:py-12">
			<section className="mx-auto flex max-w-4xl flex-col gap-6">
				<div className="space-y-2">
					<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
						MIC investor portal
					</p>
					<h1 className="font-semibold text-3xl tracking-tight">
						Protected MIC portal
					</h1>
					<p className="max-w-2xl text-muted-foreground text-sm leading-6">
						Your investor workspace is ready. Portfolio activity and MIC
						reporting will appear here as dashboard surfaces come online.
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Portal boundary</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-3 text-sm sm:grid-cols-2">
						<div>
							<p className="font-medium text-muted-foreground">Portal slug</p>
							<p>{portalLabel}</p>
						</div>
						<div>
							<p className="font-medium text-muted-foreground">Portal ID</p>
							<p className="break-all">{String(portalId)}</p>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
