import { createFileRoute } from "@tanstack/react-router";
import {
	getSignInUrl,
	getSignUpUrl,
} from "@workos/authkit-tanstack-react-start";
import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Route as RootRoute } from "./__root";

export const Route = createFileRoute("/")({
	component: Home,
	loader: async () => {
		const signInUrl = await getSignInUrl();
		const signUpUrl = await getSignUpUrl();

		return { signInUrl, signUpUrl };
	},
});

function Home() {
	const { signInUrl, signUpUrl } = Route.useLoaderData();
	return <HomeContent signInUrl={signInUrl} signUpUrl={signUpUrl} />;
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

function HomeContent({
	signInUrl,
	signUpUrl,
}: {
	signInUrl: string;
	signUpUrl: string;
}) {
	const { portalCacheKey, portalContext, requestHost } =
		RootRoute.useRouteContext();

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
					{portalContext.kind === "portal" ? (
						<>
							<div>
								<p className="font-medium text-muted-foreground">Portal slug</p>
								<p>{portalContext.portal.slug}</p>
							</div>
							<div>
								<p className="font-medium text-muted-foreground">
									Availability
								</p>
								<p>{portalContext.availability}</p>
							</div>
						</>
					) : null}
				</CardContent>
			</Card>

			<Authenticated>
				<Content />
			</Authenticated>
			<Unauthenticated>
				<SignInForm signInUrl={signInUrl} signUpUrl={signUpUrl} />
			</Unauthenticated>
		</main>
	);
}

function SignInForm({
	signInUrl,
	signUpUrl,
}: {
	signInUrl: string;
	signUpUrl: string;
}) {
	return (
		<Card className="mx-auto w-full max-w-xl">
			<CardHeader>
				<CardTitle>Authentication actions</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<Button asChild>
					<a href={signInUrl}>Sign in</a>
				</Button>
				<Button asChild variant="outline">
					<a href={signUpUrl}>Sign up</a>
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
