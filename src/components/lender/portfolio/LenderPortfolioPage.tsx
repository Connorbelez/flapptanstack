"use client";

import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ActionsRail } from "./actions-rail";
import { BrokerChatPanel } from "./broker-chat-panel";
import { PaymentActivityTable } from "./payment-activity-table";
import { PaymentSheet } from "./payment-sheet";
import { PortfolioCockpit } from "./portfolio-cockpit";
import { PortfolioExportStrip } from "./portfolio-export-strip";
import { PortfolioShell, PortfolioSlotHost } from "./portfolio-shell";
import type {
	LenderPortfolioSearchState,
	PortfolioAsyncState,
	PortfolioBrokerContextSource,
	PortfolioCommandCenterSnapshot,
	PortfolioDetailType,
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
	buildPortfolioBrokerPrefillSearch,
	buildPortfolioDetailSearch,
	clearPortfolioDetailSelection,
} from "./search";
import {
	SuggestedOpportunities,
	type SuggestedOpportunitiesState,
} from "./suggested-opportunities";

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
	suggestedOpportunitiesState?: SuggestedOpportunitiesState;
}

export function LenderPortfolioPage({
	leafStateOverrides,
	portalId,
	search,
	setSearch,
	snapshot,
	suggestedOpportunitiesState = "ready",
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
	const brokerPrefillEntries = buildPortfolioBrokerPrefillEntries(snapshot);
	const selectedBrokerPrefillEntry =
		search.brokerContextSource &&
		search.brokerContextType &&
		search.brokerSubjectId
			? (brokerPrefillEntries.find(
					(entry) =>
						entry.source === search.brokerContextSource &&
						entry.context.contextType === search.brokerContextType &&
						entry.context.subjectId === search.brokerSubjectId
				) ?? null)
			: null;
	const selectedBrokerPrefillContext =
		selectedBrokerPrefillEntry?.context ?? null;

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
						description="Actions Required stays above broker coordination and keeps the command-center rail visible across all-clear, fallback-contact, and missing-broker states."
						eyebrow="Sticky rail slot"
						summary={
							snapshot.actionsRequired.allClear
								? "All clear"
								: `${snapshot.actionsRequired.items.length} active items`
						}
						title="Fast response lane"
					>
						<div className="space-y-3">
							<ActionsRail
								actionsRequired={snapshot.actionsRequired}
								onOpenDetails={(action) => {
									const detailSearch = buildPortfolioActionDetailSearch(action);
									if (!detailSearch) {
										return;
									}

									setSearch((current) =>
										buildPortfolioDetailSearch(current, detailSearch)
									);
								}}
								onPrefill={(context) =>
									setSearch((current) =>
										buildPortfolioBrokerPrefillSearch(current, {
											brokerContextSource: "action",
											brokerContextType: context.contextType,
											brokerSubjectId: context.subjectId,
										})
									)
								}
								selectedPrefillContext={
									selectedBrokerPrefillEntry?.source === "action"
										? selectedBrokerPrefillContext
										: null
								}
							/>
							<BrokerChatPanel
								brokerCoordination={snapshot.brokerCoordination}
								onSelectPrefillContext={(context) =>
									setSearch((current) =>
										buildPortfolioBrokerPrefillSearch(current, {
											brokerContextSource: "broker",
											brokerContextType: context.contextType,
											brokerSubjectId: context.subjectId,
										})
									)
								}
								selectedPrefillContext={selectedBrokerPrefillContext}
								selectedPrefillSource={selectedBrokerPrefillEntry?.source}
							/>
						</div>
					</PortfolioSlotHost>
				}
				suggestedOpportunitiesSlot={
					<SuggestedOpportunities
						excludedOwnedMortgageCount={
							snapshot.suggestedOpportunities.excludedOwnedMortgageCount
						}
						generatedAt={snapshot.generatedAt}
						hasBrokerConstraints={snapshot.limitsStrip.hasConstraints}
						hasPositions={snapshot.positions.rows.length > 0}
						rows={snapshot.suggestedOpportunities.rows}
						state={suggestedOpportunitiesState}
						unavailableReason={
							snapshot.suggestedOpportunities.unavailableReason
						}
					/>
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
	let historyState: PortfolioAsyncState = "ready";
	if (historyQuery.isPending) {
		historyState = "loading";
	} else if (historyQuery.isError) {
		historyState = "error";
	}

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
			historyState={historyState}
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

	let exportState: PortfolioExportAsyncState = "forbidden";
	if (loading) {
		exportState = "loading";
	} else if (canExportTax) {
		if (exportQuery.isPending) {
			exportState = "loading";
		} else if (exportQuery.isError) {
			exportState = "error";
		} else {
			exportState = "ready";
		}
	}
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

type PortfolioActionItem =
	PortfolioCommandCenterSnapshot["actionsRequired"]["items"][number];
type PortfolioBrokerPrefillContext = PortfolioActionItem["prefillContext"];

interface PortfolioBrokerPrefillEntry {
	context: PortfolioBrokerPrefillContext;
	source: PortfolioBrokerContextSource;
}

function buildPortfolioActionDetailSearch(action: PortfolioActionItem): {
	detailId: string;
	detailType: PortfolioDetailType;
} | null {
	if (action.kind === "deal_action") {
		return null;
	}

	if (action.obligationId) {
		return {
			detailId: action.obligationId,
			detailType: "payment",
		};
	}

	if (action.mortgageId) {
		return {
			detailId: action.mortgageId,
			detailType: "position",
		};
	}

	return null;
}

function buildPortfolioBrokerPrefillEntries(
	snapshot: PortfolioCommandCenterSnapshot
): PortfolioBrokerPrefillEntry[] {
	return [
		...snapshot.actionsRequired.items.map((action) => ({
			context: action.prefillContext,
			source: "action" as const,
		})),
		...snapshot.brokerCoordination.prefillContextPayloads.mortgageFollowUps.map(
			(context) => ({
				context,
				source: "broker" as const,
			})
		),
		...snapshot.brokerCoordination.prefillContextPayloads.paymentFollowUps.map(
			(context) => ({
				context,
				source: "broker" as const,
			})
		),
		...snapshot.brokerCoordination.prefillContextPayloads.dealFollowUps.map(
			(context) => ({
				context,
				source: "broker" as const,
			})
		),
	];
}
