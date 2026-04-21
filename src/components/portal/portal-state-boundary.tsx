import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import type { RootPortalContext } from "#/lib/portal/host-resolution";

function PortalStateCard(props: {
	children?: ReactNode;
	description: string;
	title: string;
}) {
	return (
		<main className="page-wrap flex min-h-[60vh] items-center justify-center px-4 py-10 sm:py-12">
			<Card className="w-full max-w-2xl">
				<CardHeader>
					<CardTitle>{props.title}</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3 text-muted-foreground text-sm">
					<p>{props.description}</p>
					{props.children}
				</CardContent>
			</Card>
		</main>
	);
}

export function PortalStateBoundary(props: {
	children: ReactNode;
	portalContext: RootPortalContext;
}) {
	const { portalContext } = props;

	if (portalContext.kind === "reserved") {
		return (
			<PortalStateCard
				description={`The host ${portalContext.requestedHost} uses the reserved slug "${portalContext.reservedSlug}" and cannot resolve to a broker portal.`}
				title="Reserved portal host"
			/>
		);
	}

	if (portalContext.kind === "unknown") {
		return (
			<PortalStateCard
				description={`No published portal was found for ${portalContext.requestedHost}. The app is intentionally failing closed instead of falling back to marketing.`}
				title="Portal not found"
			/>
		);
	}

	if (
		portalContext.kind === "portal" &&
		portalContext.availability !== "active"
	) {
		let reason = `This portal is currently ${portalContext.availability}.`;
		if (portalContext.availability === "unpublished") {
			reason = "This portal exists but is not published yet.";
		} else if (portalContext.availability === "misconfigured") {
			reason = "This portal is misconfigured and cannot be served safely.";
		}
		return (
			<PortalStateCard
				description={`${reason} Requests for ${portalContext.requestedHost} stay blocked at the root boundary.`}
				title="Portal unavailable"
			>
				<p>
					Resolved portal: <strong>{portalContext.portal.slug}</strong>
				</p>
			</PortalStateCard>
		);
	}

	return props.children;
}
