import {
	ArrowRight,
	Home,
	LockKeyhole,
	ShieldAlert,
	Store,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import type { RouteHostBoundaryKind } from "#/lib/portal/route-host-decision";

function getBoundaryCopy(args: {
	boundaryKind: RouteHostBoundaryKind;
	continueLabel?: string;
	currentHost: string;
	expectedHost?: string;
}) {
	switch (args.boundaryKind) {
		case "marketing-required":
			return {
				icon: Store,
				kicker: "Marketing host required",
				title: "This page only lives on the FairLend marketing host",
				description: `You opened this page on ${args.currentHost}. Marketing content stays on the canonical marketing host instead of rendering inside portal or admin shells.`,
			};
		case "portal-required":
			return {
				icon: LockKeyhole,
				kicker: "Portal host required",
				title: "This page requires an active portal host",
				description:
					args.continueLabel === "Sign in to continue"
						? `Sign in from ${args.currentHost} and keep the intended path intact so we can route you to the correct portal after authentication.`
						: `This route is portal-only. Continue on the correct active portal host instead of rendering marketplace or portal state on ${args.currentHost}.`,
			};
		case "admin-required":
			return {
				icon: ShieldAlert,
				kicker: "Admin host required",
				title: "This page only works on the FairLend admin host",
				description: `Admin routes stay isolated from marketing and broker portal hosts. Continue on the canonical admin host instead of using ${args.currentHost}.`,
			};
		case "wrong-portal":
			return {
				icon: ShieldAlert,
				kicker: "Portal mismatch",
				title: "This account belongs on a different portal",
				description: `You signed in on ${args.currentHost}, but this account should continue on ${args.expectedHost}. We block the route here instead of silently switching hosts.`,
			};
		case "missing-portal-assignment":
			return {
				icon: ShieldAlert,
				kicker: "Portal assignment missing",
				title: "This account does not have an active portal assignment",
				description:
					"We could not resolve an active home or organization portal for this account. Reach out to FairLend staff before continuing on portal-only routes.",
			};
		default:
			return {
				icon: ShieldAlert,
				kicker: "Host boundary",
				title: "This route is not available on the current host",
				description:
					"We blocked this route before the child screen could load because the current host does not satisfy the route host policy.",
			};
	}
}

export function HostAccessBoundaryState(props: {
	boundaryKind: RouteHostBoundaryKind;
	continueHref?: string;
	continueLabel?: string;
	currentHost: string;
	expectedHost?: string;
}) {
	const copy = getBoundaryCopy(props);
	const Icon = copy.icon;

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
			<div className="w-full max-w-lg rounded-3xl border border-amber-500/20 bg-background p-8 shadow-sm">
				<div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5">
					<Icon className="size-7 text-amber-600 dark:text-amber-400" />
				</div>
				<p className="mb-2 font-medium text-[var(--sea-ink-soft)] text-sm uppercase tracking-[0.2em]">
					{copy.kicker}
				</p>
				<h1 className="mb-3 font-bold text-3xl tracking-tight">{copy.title}</h1>
				<p className="mb-6 text-[var(--sea-ink-soft)] leading-7">
					{copy.description}
				</p>
				<div className="mb-6 space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
					<p>
						Current host: <strong>{props.currentHost}</strong>
					</p>
					{props.expectedHost ? (
						<p>
							Expected host: <strong>{props.expectedHost}</strong>
						</p>
					) : null}
				</div>
				<div className="flex flex-wrap gap-3">
					{props.continueHref && props.continueLabel ? (
						<Button asChild>
							<a href={props.continueHref}>
								{props.continueLabel}
								<ArrowRight className="size-3.5" />
							</a>
						</Button>
					) : null}
					<Button asChild variant="outline">
						<a href="/">
							<Home className="size-3.5" />
							Return home
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
