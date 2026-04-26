import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { PortalLandingPage } from "#/components/portal/landing/PortalLandingPage";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { api } from "../../convex/_generated/api";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/")({
	component: Home,
});

type RootPortalContext = ReturnType<
	typeof RootRoute.useRouteContext
>["portalContext"];
type ActivePortalContext = Extract<RootPortalContext, { kind: "portal" }>;

function Home() {
	return <HomeContent />;
}

function getHomeHeading(
	portalContext: ReturnType<typeof RootRoute.useRouteContext>["portalContext"]
) {
	if (portalContext.kind === "portal") {
		if (portalContext.portal.portalType === "fairlend") {
			return "FairLend Portal";
		}
		return `${portalContext.portal.slug} Portal`;
	}

	if (portalContext.kind === "marketing") {
		return "FairLend Marketing Host";
	}

	if (portalContext.kind === "admin") {
		return "FairLend Admin Host";
	}

	return "Portal Context";
}

export function HomeContent() {
	const { portalCacheKey, portalContext, requestHost } =
		RootRoute.useRouteContext();

	if (portalContext.kind === "portal") {
		return <PortalHomeContent portalContext={portalContext} />;
	}

	const heading = getHomeHeading(portalContext);

	return (
		<main className="page-wrap flex flex-col gap-8 px-4 py-10 sm:py-12">
			<div className="space-y-3 text-center">
				<h1 className="font-bold text-4xl tracking-tight">{heading}</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground">
					Root host resolution is now centralized before child loaders run. This
					page is a minimal consumer of the resolved portal context.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Resolved host context</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 text-sm sm:grid-cols-2">
					<div>
						<p className="font-medium text-muted-foreground">Requested host</p>
						<p>{requestHost}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">Canonical host</p>
						<p>{portalContext.canonicalHost}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">Context kind</p>
						<p>{portalContext.kind}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">
							Portal cache key
						</p>
						<p className="break-all">{portalCacheKey}</p>
					</div>
				</CardContent>
			</Card>

			<Authenticated>
				<Content />
			</Authenticated>
			<Unauthenticated>
				<SignInForm />
			</Unauthenticated>
		</main>
	);
}

function PortalHomeContent({
	portalContext,
}: {
	portalContext: ActivePortalContext;
}) {
	const landingQuery = useQuery(
		convexQuery(api.portals.queries.getPublicPortalLandingPage, {
			portalId: portalContext.portal.portalId,
		})
	);
	const teaserItems = teaserQuery.data
		? (buildMarketplaceListingCardItems(teaserQuery.data.page) ?? [])
		: [];
	let teaserContent: ReactNode;

	if (landingQuery.isPending) {
		return (
			<main className="min-h-screen bg-[#f7f5ef] px-4 py-12">
				<Card className="mx-auto max-w-2xl">
					<CardContent className="py-10 text-center text-muted-foreground text-sm">
						Loading broker portal...
					</CardContent>
				</Card>
			</main>
		);
	}

	if (landingQuery.error || !landingQuery.data) {
		return (
			<main className="min-h-screen bg-[#f7f5ef] px-4 py-12">
				<Card className="mx-auto max-w-2xl">
					<CardHeader>
						<CardTitle>Portal landing page unavailable</CardTitle>
					</CardHeader>
					<CardContent className="text-muted-foreground text-sm">
						This portal is active, but the landing-page contract could not be
						loaded.
					</CardContent>
				</Card>
			</main>
		);
	}

	return <PortalLandingPage landing={landingQuery.data} />;
}

function SignInForm() {
	return (
		<Card className="mx-auto w-full max-w-xl">
			<CardHeader>
				<CardTitle>Authentication actions</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Button asChild>
					<a href="/sign-in?redirect=/">Sign in</a>
				</Button>
				<Button asChild variant="outline">
					<a href="/sign-up?redirect=/">Sign up</a>
				</Button>
			</CardContent>
		</Card>
	);
}

function Content() {
	const { portalContext } = RootRoute.useRouteContext();

	return (
		<Card className="mx-auto w-full max-w-xl">
			<CardHeader>
				<CardTitle>Signed-in state</CardTitle>
			</CardHeader>
			<CardContent className="space-y-2 text-muted-foreground text-sm">
				<p>
					The root route has already resolved the current host as{" "}
					<strong>{portalContext.kind}</strong>.
				</p>
				<p>
					This is where downstream role-specific shells can branch on the shared
					portal context without reparsing the hostname.
				</p>
			</CardContent>
		</Card>
	);
}
