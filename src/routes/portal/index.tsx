import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MicConcentrationSection } from "#/components/mic/MicConcentrationSection";
import { MicDashboardMetrics } from "#/components/mic/MicDashboardMetrics";
import { MicDataWarnings } from "#/components/mic/MicDataWarnings";
import { MicMaturityLadder } from "#/components/mic/MicMaturityLadder";
import { MicPaymentsTable } from "#/components/mic/MicPaymentsTable";
import {
	MicPortfolioCharts,
	MicReturnSeriesChart,
} from "#/components/mic/MicPortfolioCharts";
import { MicPositionDetailDrawer } from "#/components/mic/MicPositionDetailDrawer";
import { MicPositionsTable } from "#/components/mic/MicPositionsTable";
import {
	micDashboardSnapshotQueryOptions,
	micPaymentsHistoryQueryOptions,
} from "#/components/mic/query-options";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import type { MicPositionRow } from "../../../convex/micPortfolio/contracts";
import { Route as RootRoute } from "../__root";

const SECTION_NAV = [
	{ hash: "#mic-summary", label: "Summary" },
	{ hash: "#mic-analytics", label: "Analytics" },
	{ hash: "#mic-holdings", label: "Positions" },
	{ hash: "#mic-payments", label: "Payments" },
	{ hash: "#mic-concentration", label: "Concentration" },
	{ hash: "#mic-maturity", label: "Maturity" },
] as const;

export const Route = createFileRoute("/portal/")({
	component: MicPortalIndexRoutePage,
});

export function MicPortalIndexRoutePage() {
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const { data } = useSuspenseQuery(micDashboardSnapshotQueryOptions(portalId));
	const { data: paymentsData } = useSuspenseQuery(
		micPaymentsHistoryQueryOptions(portalId)
	);

	const [selectedPosition, setSelectedPosition] =
		useState<MicPositionRow | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const generatedLabel = useMemo(
		() =>
			new Intl.DateTimeFormat("en-CA", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(data.generatedAt),
		[data.generatedAt]
	);

	const handleRowClick = (position: MicPositionRow) => {
		setSelectedPosition(position);
		setDrawerOpen(true);
	};

	return (
		<main className="mic-portal-dashboard relative min-h-dvh">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[min(52vh,520px)] bg-[radial-gradient(ellipse_90%_80%_at_50%_-10%,var(--hero-a),transparent_58%),radial-gradient(ellipse_55%_45%_at_100%_0%,var(--hero-b),transparent_50%)] opacity-90"
			/>

			<header className="relative border-[var(--line)] border-b bg-[var(--header-bg)] backdrop-blur-md">
				<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
					<div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
								<span className="text-[var(--kicker)]">
									MIC investor portal
								</span>
								<span
									aria-hidden
									className="hidden h-3 w-px bg-border sm:inline"
								/>
								<span className="tabular-nums tracking-[0.12em]">
									Snapshot · {generatedLabel}
								</span>
							</div>
							<h1 className="mic-display text-2xl tracking-tight sm:text-3xl lg:text-[2.125rem] lg:leading-snug">
								Portfolio overview
							</h1>
						</div>
					</div>
				</div>
			</header>

			<div className="mx-auto flex max-w-7xl flex-col px-4 py-12 sm:px-6 lg:px-8 xl:flex-row xl:gap-14 xl:py-16">
				<nav
					aria-label="Dashboard sections"
					className="mb-10 xl:sticky xl:top-28 xl:mb-0 xl:flex xl:h-fit xl:w-44 xl:shrink-0 xl:flex-col"
				>
					<p className="hidden font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em] xl:mb-4 xl:block">
						On this page
					</p>
					<ul className="flex flex-wrap gap-x-4 gap-y-2 xl:flex-col xl:gap-3">
						{SECTION_NAV.map((item) => (
							<li key={item.hash}>
								<a
									className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.18em] transition-colors hover:text-[var(--sea-ink)]"
									href={`/portal${item.hash}`}
								>
									{item.label}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="min-w-0 flex-1 space-y-16 lg:space-y-[5.5rem]">
					<div className="motion-safe:animate-[mic-rise_0.65s_ease-out_both]">
						<MicDataWarnings
							dataCompleteness={data.dataCompleteness}
							warnings={data.warnings}
						/>
					</div>

					<section
						aria-labelledby="metrics-heading"
						className="scroll-mt-28 space-y-6 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
						id="mic-summary"
						style={{ animationDelay: "40ms" }}
					>
						<div className="flex flex-wrap items-end justify-between gap-4 border-[var(--line)] border-b pb-4">
							<div className="space-y-2">
								<p
									className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]"
									id="metrics-heading"
								>
									Ledger summary
								</p>
								<h2 className="mic-display text-2xl tracking-tight sm:text-[1.75rem]">
									Portfolio metrics
								</h2>
								<p className="max-w-xl text-muted-foreground text-sm leading-relaxed">
									Headline balances and weighted averages mirror how the MIC
									participates across collateral—not investor personalization.
								</p>
							</div>
						</div>
						<MicDashboardMetrics
							lendingFeeMetrics={data.lendingFeeMetrics}
							metrics={data.metrics}
							returnSeries={data.returnSeries}
						/>
						<MicReturnSeriesChart
							lendingFeeMetrics={data.lendingFeeMetrics}
							metrics={data.metrics}
							returnSeries={data.returnSeries}
						/>
					</section>

					<MicPortfolioCharts
						concentration={data.concentration}
						metrics={data.metrics}
						positions={data.positions}
					/>

					<section
						className="scroll-mt-28 space-y-7 border-[var(--line)] border-t pt-14 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
						id="mic-holdings"
						style={{ animationDelay: "120ms" }}
					>
						<header className="max-w-2xl space-y-2">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
								Collateral registry
							</p>
							<h2 className="mic-display text-[1.85rem] tracking-tight">
								Mortgage positions
							</h2>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Street-level collateral, MIC ownership slice, coupon, leverage,
								and the next scheduled obligation.
							</p>
						</header>
						<MicPositionsTable
							onRowClick={handleRowClick}
							positions={data.positions}
						/>
					</section>

					<section
						className="scroll-mt-28 space-y-7 border-[var(--line)] border-t pt-14 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
						id="mic-payments"
						style={{ animationDelay: "150ms" }}
					>
						<header className="max-w-2xl space-y-2">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.22em]">
								Cash ladder
							</p>
							<h2 className="mic-display text-[1.85rem] tracking-tight">
								All position payments
							</h2>
							<p className="text-muted-foreground text-sm leading-relaxed">
								Scheduled obligations tied to MIC-held mortgages with gross and
								participation share visibility.
							</p>
						</header>
						<MicPaymentsTable payments={paymentsData.rows} />
					</section>

					<div
						className="scroll-mt-28 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
						id="mic-concentration"
						style={{ animationDelay: "170ms" }}
					>
						<MicConcentrationSection concentration={data.concentration} />
					</div>

					<div
						className="scroll-mt-28 border-[var(--line)] border-t pt-14 motion-safe:animate-[mic-rise_0.65s_ease-out_both]"
						id="mic-maturity"
						style={{ animationDelay: "190ms" }}
					>
						<MicMaturityLadder
							buckets={data.maturityLadder}
							portfolioOutstandingPrincipal={data.metrics.outstandingPrincipal}
						/>
					</div>
				</div>
			</div>

			<MicPositionDetailDrawer
				onOpenChange={setDrawerOpen}
				open={drawerOpen}
				portalId={portalId}
				position={selectedPosition}
			/>
		</main>
	);
}
