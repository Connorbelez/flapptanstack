import { ArrowRight, Home, ShieldAlert } from "lucide-react";
import { Button } from "#/components/ui/button";

export function WrongPortalState(props: {
	assignedHost: string;
	assignedPortalLabel: string;
	continueHref: string;
	currentHost: string;
}) {
	const { assignedHost, assignedPortalLabel, continueHref, currentHost } =
		props;

	return (
		<div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
			<div className="w-full max-w-lg rounded-3xl border border-amber-500/20 bg-background p-8 shadow-sm">
				<div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/5">
					<ShieldAlert className="size-7 text-amber-600 dark:text-amber-400" />
				</div>
				<p className="mb-2 font-medium text-[var(--sea-ink-soft)] text-sm uppercase tracking-[0.2em]">
					Portal mismatch
				</p>
				<h1 className="mb-3 font-bold text-3xl tracking-tight">
					This account belongs on a different portal
				</h1>
				<p className="mb-6 text-[var(--sea-ink-soft)] leading-7">
					You signed in on <strong>{currentHost}</strong>, but this account is
					assigned to <strong>{assignedPortalLabel}</strong>. Continue there
					instead of silently switching hosts.
				</p>
				<div className="mb-6 space-y-2 rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm">
					<p>
						Current host: <strong>{currentHost}</strong>
					</p>
					<p>
						Assigned host: <strong>{assignedHost}</strong>
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					<Button asChild>
						<a href={continueHref}>
							Continue to {assignedPortalLabel}
							<ArrowRight className="size-3.5" />
						</a>
					</Button>
					<Button asChild variant="outline">
						<a href="/">
							<Home className="size-3.5" />
							Stay on this host
						</a>
					</Button>
				</div>
			</div>
		</div>
	);
}
