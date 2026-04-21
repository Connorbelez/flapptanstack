import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Authenticated, Unauthenticated } from "convex/react";
import { type ReactNode, useMemo } from "react";
import { Horizontal } from "#/components/listings/listing-card-horizontal";
import { buildMarketplaceListingCardItems } from "#/components/listings/marketplace-adapters";
import { publicPortalListingsQueryOptions } from "#/components/listings/portal-query-options";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
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
	const teaserQuery = useQuery(
		publicPortalListingsQueryOptions(String(portalContext.portal.portalId), {
			numItems: portalContext.portal.teaserListingLimit,
		})
	);
	const teaserItems = useMemo(
		() =>
			teaserQuery.data
				? buildMarketplaceListingCardItems(teaserQuery.data.page)
				: [],
		[teaserQuery.data]
	);
	let teaserContent: ReactNode;

	if (teaserQuery.isPending) {
		teaserContent = (
			<Card>
				<CardContent className="py-10 text-center text-muted-foreground text-sm">
					Loading teaser listings...
				</CardContent>
			</Card>
		);
	} else if (teaserQuery.error) {
		teaserContent = (
			<Card>
				<CardHeader>
					<CardTitle>Unable to load teaser listings</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					This portal is active, but the teaser listings surface could not be
					loaded.
				</CardContent>
			</Card>
		);
	} else if (teaserQuery.data?.teaserEnabled === false) {
		teaserContent = (
			<Card>
				<CardHeader>
					<CardTitle>Teaser listings unavailable</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					This portal does not currently publish public teaser listings.
				</CardContent>
			</Card>
		);
	} else if (teaserItems.length === 0) {
		teaserContent = (
			<Card>
				<CardHeader>
					<CardTitle>No teaser listings yet</CardTitle>
				</CardHeader>
				<CardContent className="text-muted-foreground text-sm">
					This portal is active, but there are no teaser opportunities available
					right now.
				</CardContent>
			</Card>
		);
	} else {
		teaserContent = (
			<section className="space-y-4">
				<div className="space-y-2">
					<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
						Public teaser
					</p>
					<h2 className="font-semibold text-2xl tracking-tight">
						Featured mortgage opportunities
					</h2>
				</div>
				<div className="grid gap-4 lg:grid-cols-2">
					{teaserItems.map((listing) => (
						<Horizontal
							address={listing.address}
							apr={listing.apr}
							availablePercent={listing.availablePercent}
							id={listing.id}
							imageSrc={listing.imageSrc}
							key={listing.id}
							lockedPercent={listing.lockedPercent}
							ltv={listing.ltv}
							maturityDate={listing.maturityDate.toLocaleDateString("en-CA")}
							principal={listing.principal}
							propertyType={listing.propertyType}
							soldPercent={listing.soldPercent}
							title={listing.title}
						/>
					))}
				</div>
			</section>
		);
	}

	return (
		<main className="page-wrap flex flex-col gap-8 px-4 py-10 sm:py-12">
			<div className="space-y-3 text-center">
				<h1 className="font-bold text-4xl tracking-tight">
					{portalContext.portal.slug} portal
				</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground">
					Preview the current teaser opportunities for this portal. Sign in to
					unlock protected lender listings and detail views.
				</p>
			</div>

			<Authenticated>
				<div className="flex justify-center">
					<Button asChild>
						<a href="/lender/listings">Open lender workspace</a>
					</Button>
				</div>
			</Authenticated>
			<Unauthenticated>
				<div className="flex flex-wrap justify-center gap-3">
					<Button asChild>
						<a href="/sign-in?redirect=/lender/listings">Sign in</a>
					</Button>
					<Button asChild variant="outline">
						<a href="/sign-up?redirect=/lender/listings">Sign up</a>
					</Button>
				</div>
			</Unauthenticated>

			{teaserContent}

			<Card>
				<CardHeader>
					<CardTitle>Resolved host context</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 text-sm sm:grid-cols-2">
					<div>
						<p className="font-medium text-muted-foreground">Portal slug</p>
						<p>{portalContext.portal.slug}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">Canonical host</p>
						<p>{portalContext.canonicalHost}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">Availability</p>
						<p>{portalContext.availability}</p>
					</div>
					<div>
						<p className="font-medium text-muted-foreground">Teaser limit</p>
						<p>{portalContext.portal.teaserListingLimit}</p>
					</div>
				</CardContent>
			</Card>
		</main>
	);
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
