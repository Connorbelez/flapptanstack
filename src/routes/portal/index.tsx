import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MicConcentrationSection } from "#/components/mic/MicConcentrationSection";
import { MicDashboardMetrics } from "#/components/mic/MicDashboardMetrics";
import { MicDataWarnings } from "#/components/mic/MicDataWarnings";
import { MicMaturityLadder } from "#/components/mic/MicMaturityLadder";
import { MicPositionDetailDrawer } from "#/components/mic/MicPositionDetailDrawer";
import { MicPositionsTable } from "#/components/mic/MicPositionsTable";
import { micDashboardSnapshotQueryOptions } from "#/components/mic/query-options";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import type { MicPositionRow } from "../../../convex/micPortfolio/contracts";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/portal/")({
	component: MicPortalIndexRoutePage,
	loader: async ({ context }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC portal requires an active portal host."
		);
		await context.queryClient.ensureQueryData(
			micDashboardSnapshotQueryOptions(portalId)
		);
	},
});

export function MicPortalIndexRoutePage() {
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const { data } = useSuspenseQuery(micDashboardSnapshotQueryOptions(portalId));

	const [selectedPosition, setSelectedPosition] =
		useState<MicPositionRow | null>(null);
	const [drawerOpen, setDrawerOpen] = useState(false);

	const handleRowClick = (position: MicPositionRow) => {
		setSelectedPosition(position);
		setDrawerOpen(true);
	};

	return (
		<main className="page-wrap px-4 py-10 sm:py-12">
			<section className="mx-auto flex max-w-5xl flex-col gap-6">
				<div className="space-y-2">
					<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
						MIC investor portal
					</p>
					<h1 className="font-semibold text-3xl tracking-tight">Dashboard</h1>
					<p className="max-w-2xl text-muted-foreground text-sm leading-6">
						Portfolio snapshot and MIC reporting overview.
					</p>
				</div>

				<MicDataWarnings
					dataCompleteness={data.dataCompleteness}
					warnings={data.warnings}
				/>

				<MicDashboardMetrics metrics={data.metrics} />

				<div className="space-y-3">
					<h2 className="font-semibold text-lg tracking-tight">Positions</h2>
					<MicPositionsTable
						onRowClick={handleRowClick}
						positions={data.positions}
					/>
				</div>

				<MicConcentrationSection concentration={data.concentration} />

				<MicMaturityLadder buckets={data.maturityLadder} />

				<MicPositionDetailDrawer
					onOpenChange={setDrawerOpen}
					open={drawerOpen}
					portalId={portalId}
					position={selectedPosition}
				/>
			</section>
		</main>
	);
}
