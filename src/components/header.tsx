import { Link } from "@tanstack/react-router";
import { buildAdminNavigationHref } from "#/lib/portal/admin-navigation";
import type { RootPortalContext } from "#/lib/portal/host-resolution";
import ThemeToggle from "./theme-toggle";
import WorkOSHeader from "./workos-user.tsx";

type DemoLink = { label: string; to: string } | { label: string; href: string };
interface DemoSection {
	label: string;
	links: DemoLink[];
}

const demoSections: DemoSection[] = [
	{
		label: "Frontend",
		links: [
			{ to: "/demo/tanstack-query", label: "TanStack Query" },
			{ to: "/demo/table", label: "TanStack Table" },
			{ to: "/demo/listings", label: "Listings" },
			{ to: "/demo/form/simple", label: "Simple Form" },
			{ to: "/demo/form/address", label: "Address Form" },
			{ to: "/demo/storybook", label: "Storybook" },
		],
	},
	{
		label: "Auth",
		links: [{ to: "/demo/workos", label: "WorkOS" }],
	},
	{
		label: "Convex Core",
		links: [
			{ to: "/demo/convex", label: "Todos" },
			{ to: "/demo/convex-ledger", label: "Ownership Ledger" },
		],
	},
	{
		label: "Convex Components",
		links: [
			{ to: "/demo/convex-rate-limiter", label: "Rate Limiter" },
			{ to: "/demo/convex-action-cache", label: "Action Cache" },
			{ to: "/demo/convex-debouncer", label: "Debouncer" },
			{ to: "/demo/convex-tracer", label: "Tracer" },
			{ to: "/demo/convex-migrations", label: "Migrations" },
			{ to: "/demo/convex-presence", label: "Presence" },
			{ to: "/demo/convex-aggregate", label: "Aggregate" },
			{ to: "/demo/convex-geospatial", label: "Geospatial" },
			{ to: "/demo/convex-timeline", label: "Timeline" },
			{ to: "/demo/convex-audit-log", label: "Audit Log" },
			{ to: "/demo/convex-crons", label: "Crons" },
			{ to: "/demo/convex-workflow", label: "Workflow" },
			{ to: "/demo/convex-api-credentials", label: "API Credentials" },
			{ to: "/demo/convex-file-management", label: "File Management" },
			{ to: "/demo/convex-fluent", label: "Fluent Convex" },
			{ to: "/demo/convex-cascading-delete", label: "Cascading Delete" },
		],
	},
	{
		label: "Convex Helpers",
		links: [{ to: "/demo/convex-triggers", label: "Triggers" }],
	},
	{
		label: "Platform",
		links: [
			{ to: "/demo/amps", label: "AMPS Demo" },
			{ to: "/demo/document-engine", label: "Document Engine" },
			{ to: "/demo/deal-closing-pipeline", label: "Deal Closing Pipeline" },
			{ to: "/demo/audit-traceability", label: "Audit & Traceability" },
			{ to: "/demo/governed-transitions", label: "Governed Transitions" },
		],
	},
];

const demoLinkClassName =
	"block rounded-lg px-3 py-2 text-sm !text-[var(--sea-ink-soft)] no-underline transition hover:bg-[var(--link-bg-hover)] hover:!text-[var(--sea-ink)]";

interface HeaderProps {
	portalContext: Pick<RootPortalContext, "canonicalHost">;
}

export default function Header({ portalContext }: HeaderProps) {
	const adminHref = buildAdminNavigationHref(portalContext.canonicalHost);

	return (
		<header className="sticky top-0 z-50 shrink-0 border-(--line) border-b bg-(--header-bg) px-4 backdrop-blur-lg">
			<nav className="page-wrap flex w-full flex-wrap items-center gap-x-3 gap-y-2 py-2.5 sm:justify-center sm:py-4">
				<h2 className="order-1 m-0 shrink-0 font-semibold text-base tracking-tight">
					<Link
						className="!text-[var(--sea-ink)] inline-flex items-center gap-2 rounded-full px-0 py-1.5 font-bold text-[17px] no-underline sm:border sm:border-(--chip-line) sm:bg-(--chip-bg) sm:px-4 sm:py-2 sm:text-sm sm:shadow-[0_8px_24px_rgba(30,90,72,0.08)]"
						to="/"
						viewTransition
					>
						<span className="h-2 w-2 rounded-full bg-[linear-gradient(90deg,#56c6be,#7ed3bf)]" />
						FairLend
					</Link>
				</h2>

				<div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3 sm:ml-auto">
					<ThemeToggle />
					<WorkOSHeader />
				</div>

				<div className="order-3 -mx-4 flex w-[calc(100%+2rem)] items-center gap-x-4 overflow-x-auto px-4 pb-1 font-semibold text-sm sm:order-2 sm:mx-0 sm:w-auto sm:flex-nowrap sm:overflow-visible sm:px-0 sm:pb-0">
					<Link
						activeProps={{ className: "nav-link is-active" }}
						className="nav-link shrink-0"
						to="/"
						viewTransition
					>
						Home
					</Link>
					<Link
						activeProps={{ className: "nav-link is-active" }}
						className="nav-link shrink-0"
						to="/listings"
						viewTransition
					>
						Listings
					</Link>
					<a className="nav-link shrink-0" href={adminHref}>
						Admin
					</a>
					<Link
						activeProps={{ className: "nav-link is-active" }}
						className="nav-link hidden shrink-0 sm:inline-flex"
						to="/about"
						viewTransition
					>
						About
					</Link>
					<a
						className="nav-link hidden shrink-0 sm:inline-flex"
						href="https://tanstack.com/start/latest/docs/framework/react/overview"
						rel="noreferrer"
						target="_blank"
					>
						Docs
					</a>
					<details className="group relative hidden sm:block sm:w-auto">
						<summary className="nav-link cursor-pointer list-none">
							Demos
						</summary>
						<div className="mt-2 hidden max-h-[70vh] min-w-56 overflow-y-auto rounded-xl border border-(--line) bg-(--header-bg) p-2 shadow-lg group-open:block sm:absolute sm:right-0">
							{demoSections.map((section) => (
								<div key={section.label}>
									<div className="px-3 pt-2 pb-1 font-semibold text-[var(--sea-ink-soft)] text-xs uppercase tracking-wider">
										{section.label}
									</div>
									{section.links.map((demoLink) =>
										"href" in demoLink ? (
											<a
												className={demoLinkClassName}
												href={demoLink.href}
												key={demoLink.href}
											>
												{demoLink.label}
											</a>
										) : (
											<Link
												activeProps={{
													className:
														"block rounded-lg bg-[var(--link-bg-hover)] px-3 py-2 text-sm !text-[var(--sea-ink)] no-underline transition",
												}}
												className={demoLinkClassName}
												key={demoLink.to}
												to={demoLink.to}
												viewTransition
											>
												{demoLink.label}
											</Link>
										)
									)}
								</div>
							))}
						</div>
					</details>
				</div>
			</nav>
		</header>
	);
}
