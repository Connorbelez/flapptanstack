"use client";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { AlertTriangle, Sparkles } from "lucide-react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { PaymentActivityTable } from "./payment-activity-table";
import { PaymentSheet } from "./payment-sheet";
import { PortfolioCockpit } from "./portfolio-cockpit";
import { PortfolioExportStrip } from "./portfolio-export-strip";
import { formatPortfolioEnumLabel } from "./portfolio-formatters";
import { PortfolioShell, PortfolioSlotHost } from "./portfolio-shell";
import type {
	LenderPortfolioSearchState,
	PortfolioAsyncState,
	PortfolioCommandCenterSnapshot,
	PortfolioExportAsyncState,
	PortfolioHistoricalSeries,
	PortfolioSearchUpdater,
	PortfolioTaxExport,
} from "./portfolio-types";
import { PositionSheet } from "./position-sheet";
import { PositionsTable } from "./positions-table";
import {
	applyPortfolioPaymentSearch,
	applyPortfolioPositionSearch,
	buildPortfolioDetailSearch,
	clearPortfolioDetailSelection,
} from "./search";

const COCKPIT_HISTORY_MONTHS = 6;

export interface LenderPortfolioPageLeafStateOverrides {
	cockpit?: {
		historyErrorMessage?: string;
		historySeries: PortfolioHistoricalSeries | null;
		historyState: PortfolioAsyncState;
	};
	exportStrip?: {
		canExportTax: boolean;
		exportContract: PortfolioTaxExport | null;
		exportErrorMessage?: string;
		exportState: PortfolioExportAsyncState;
	};
}

export interface LenderPortfolioPageProps {
	leafStateOverrides?: LenderPortfolioPageLeafStateOverrides;
	portalId: Id<"portals">;
	search: LenderPortfolioSearchState;
	setSearch: (updater: PortfolioSearchUpdater) => void;
	snapshot: PortfolioCommandCenterSnapshot;
}

export function LenderPortfolioPage({
	leafStateOverrides,
	portalId,
	search,
	setSearch,
	snapshot,
}: LenderPortfolioPageProps) {
	const positionRows = applyPortfolioPositionSearch(
		snapshot.positions.rows,
		search
	);
	const paymentRows = applyPortfolioPaymentSearch(
		snapshot.paymentActivity.rows,
		search
	);
	const positionStatusOptions = [
		...new Set(snapshot.positions.rows.map((row) => row.mortgageStatus)),
	].sort();
	const paymentStatusOptions = [
		...new Set(snapshot.paymentActivity.rows.map((row) => row.rowStatus)),
	].sort();
	const selectedPositionId =
		search.detailType === "position" ? search.detailId : undefined;
	const selectedPaymentId =
		search.detailType === "payment" ? search.detailId : undefined;

	return (
		<>
			<PortfolioShell
				cockpitSlot={
					leafStateOverrides?.cockpit ? (
						<PortfolioCockpit
							cockpit={snapshot.cockpit}
							generatedAt={snapshot.generatedAt}
							historyErrorMessage={
								leafStateOverrides.cockpit.historyErrorMessage
							}
							historySeries={leafStateOverrides.cockpit.historySeries}
							historyState={leafStateOverrides.cockpit.historyState}
						/>
					) : (
						<ConnectedPortfolioCockpit
							portalId={portalId}
							snapshot={snapshot}
						/>
					)
				}
				exportStripSlot={
					leafStateOverrides?.exportStrip ? (
						<PortfolioExportStrip
							exportContract={leafStateOverrides.exportStrip.exportContract}
							exportErrorMessage={
								leafStateOverrides.exportStrip.exportErrorMessage
							}
							exportState={leafStateOverrides.exportStrip.exportState}
							limitsStrip={snapshot.limitsStrip}
						/>
					) : (
						<ConnectedPortfolioExportStrip
							portalId={portalId}
							snapshot={snapshot}
						/>
					)
				}
				paymentActivitySection={
					<PaymentActivityTable
						onPaymentDateFromChange={(value) =>
							setSearch((current) => ({
								...current,
								paymentDateFrom: value,
							}))
						}
						onPaymentDateToChange={(value) =>
							setSearch((current) => ({
								...current,
								paymentDateTo: value,
							}))
						}
						onPaymentQueryChange={(value) =>
							setSearch((current) => ({
								...current,
								paymentQuery: value,
							}))
						}
						onPaymentSortChange={(value) =>
							setSearch((current) => ({
								...current,
								paymentSort: value,
							}))
						}
						onPaymentStatusChange={(value) =>
							setSearch((current) => ({
								...current,
								paymentStatus: value,
							}))
						}
						onSelectPayment={(obligationId) =>
							setSearch((current) =>
								buildPortfolioDetailSearch(current, {
									detailId: obligationId,
									detailType: "payment",
								})
							)
						}
						rows={paymentRows}
						search={search}
						statusOptions={paymentStatusOptions}
						totalRows={snapshot.paymentActivity.rows.length}
					/>
				}
				positionsSection={
					<PositionsTable
						onPositionQueryChange={(value) =>
							setSearch((current) => ({
								...current,
								positionQuery: value,
							}))
						}
						onPositionSortChange={(value) =>
							setSearch((current) => ({
								...current,
								positionSort: value,
							}))
						}
						onPositionStatusChange={(value) =>
							setSearch((current) => ({
								...current,
								positionStatus: value,
							}))
						}
						onSelectPosition={(mortgageId) =>
							setSearch((current) =>
								buildPortfolioDetailSearch(current, {
									detailId: mortgageId,
									detailType: "position",
								})
							)
						}
						rows={positionRows}
						search={search}
						statusOptions={positionStatusOptions}
						totalRows={snapshot.positions.rows.length}
					/>
				}
				stickyRailSlot={
					<PortfolioSlotHost
						className="h-fit"
						dataTestId="sticky-rail-slot-host"
						description="ENG-311 owns the rail host placement and command-center data boundary. Actions and broker chat leaf rendering land in ENG-329."
						eyebrow="Sticky rail slot"
						summary={
							snapshot.actionsRequired.allClear
								? "All clear"
								: `${snapshot.actionsRequired.items.length} active items`
						}
						title="Actions and broker coordination"
					>
						<div className="space-y-3">
							<div className="rounded-lg border border-border/70 bg-background px-4 py-3">
								<div className="flex items-center gap-2 font-medium text-sm">
									<AlertTriangle className="size-4 text-muted-foreground" />
									Actions required host
								</div>
								<p className="mt-2 text-muted-foreground text-sm leading-6">
									{snapshot.actionsRequired.allClear
										? "No urgent lender actions are currently queued in the upstream contract."
										: `${snapshot.actionsRequired.items.length} route-scoped action items are ready for the downstream rail surface.`}
								</p>
							</div>
							<div className="rounded-lg border border-border/70 border-dashed bg-background px-4 py-3">
								<div className="flex items-center gap-2 font-medium text-sm">
									<Sparkles className="size-4 text-muted-foreground" />
									Broker chat host
								</div>
								<p className="mt-2 text-muted-foreground text-sm leading-6">
									Broker availability is{" "}
									{formatPortfolioEnumLabel(
										snapshot.brokerCoordination.availabilityState
									)}
									. Assigned broker:{" "}
									{snapshot.brokerCoordination.assignedBroker?.name ??
										"Unavailable"}
									.
								</p>
							</div>
						</div>
					</PortfolioSlotHost>
				}
				suggestedOpportunitiesSlot={
					<PortfolioSlotHost
						dataTestId="suggested-slot-host"
						description="The route owns the bottom-of-page host and keeps suggestion counts visible without taking over the ENG-314 listing cards."
						eyebrow="Suggested opportunities slot"
						summary={`${snapshot.suggestedOpportunities.rows.length} suggestion-ready rows`}
						title="Suggested opportunities host"
					>
						<div className="grid gap-3 md:grid-cols-2">
							<div className="rounded-lg border border-border/70 bg-background px-4 py-3">
								<p className="font-medium text-sm">Explanation tags ready</p>
								<p className="mt-2 text-muted-foreground text-sm leading-6">
									Already-owned exclusions:{" "}
									{snapshot.suggestedOpportunities.excludedOwnedMortgageCount}.
									Downstream UI can render contract-backed reasoning tags
									without recomputing them in React.
								</p>
							</div>
							<div className="rounded-lg border border-border/70 border-dashed bg-background px-4 py-3">
								<p className="font-medium text-sm">Placement reserved</p>
								<p className="mt-2 text-muted-foreground text-sm leading-6">
									Suggested opportunities remain anchored below the export strip
									so positions and payment activity stay ahead of prospecting
									work.
								</p>
							</div>
						</div>
					</PortfolioSlotHost>
				}
			/>

			{selectedPositionId ? (
				<PositionSheet
					mortgageId={selectedPositionId}
					onOpenChange={(open) => {
						if (!open) {
							setSearch((current) => clearPortfolioDetailSelection(current));
						}
					}}
					open
					portalId={portalId}
				/>
			) : null}

			{selectedPaymentId ? (
				<PaymentSheet
					obligationId={selectedPaymentId}
					onOpenChange={(open) => {
						if (!open) {
							setSearch((current) => clearPortfolioDetailSelection(current));
						}
					}}
					open
					portalId={portalId}
				/>
			) : null}
		</>
	);
}

function ConnectedPortfolioCockpit({
	portalId,
	snapshot,
}: {
	portalId: Id<"portals">;
	snapshot: PortfolioCommandCenterSnapshot;
}) {
	const historyQuery = useQuery({
		...convexQuery(api.portfolio.queries.getLenderPortfolioHistoricalSeries, {
			months: COCKPIT_HISTORY_MONTHS,
			portalId,
		}),
	});

	return (
		<PortfolioCockpit
			cockpit={snapshot.cockpit}
			generatedAt={snapshot.generatedAt}
			historyErrorMessage={
				historyQuery.error instanceof Error
					? historyQuery.error.message
					: undefined
			}
			historySeries={historyQuery.data ?? null}
			historyState={
				historyQuery.isPending
					? "loading"
					: historyQuery.isError
						? "error"
						: "ready"
			}
		/>
	);
}

function ConnectedPortfolioExportStrip({
	portalId,
	snapshot,
}: {
	portalId: Id<"portals">;
	snapshot: PortfolioCommandCenterSnapshot;
}) {
	const { loading, permissions } = useAuth();
	const canExportTax = permissions?.includes("portfolio:export_tax") ?? false;
	const exportQuery = useQuery({
		...convexQuery(api.portfolio.queries.getLenderPortfolioTaxExport, {
			portalId,
		}),
		enabled: !loading && canExportTax,
	});

	const exportState: PortfolioExportAsyncState = loading
		? "loading"
		: canExportTax
			? exportQuery.isPending
				? "loading"
				: exportQuery.isError
					? "error"
					: "ready"
			: "forbidden";
	const visibleExportContract =
		exportState === "ready" ? (exportQuery.data ?? null) : null;
	const visibleExportErrorMessage =
		exportState === "error" && exportQuery.error instanceof Error
			? exportQuery.error.message
			: undefined;

	return (
		<PortfolioExportStrip
			exportContract={visibleExportContract}
			exportErrorMessage={visibleExportErrorMessage}
			exportState={exportState}
			limitsStrip={snapshot.limitsStrip}
		/>
	);
}
