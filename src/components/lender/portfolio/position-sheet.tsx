"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type { Id } from "../../../../convex/_generated/dataModel";
import {
	PortfolioDetailHost,
	PortfolioDetailSection,
	PortfolioKeyValueGrid,
	PortfolioKeyValueRow,
} from "./detail-host";
import {
	formatPortfolioCompactCurrency,
	formatPortfolioCurrency,
	formatPortfolioDate,
	formatPortfolioEnumLabel,
	formatPortfolioFractions,
	formatPortfolioPercent,
} from "./portfolio-formatters";
import { lenderPortfolioPositionDetailQueryOptions } from "./query-options";
import { RenewalActionSurface } from "./renewals/renewal-actions";

interface PositionSheetProps {
	mortgageId: string;
	onOpenChange: (open: boolean) => void;
	open: boolean;
	portalId: Id<"portals">;
}

const POSITION_SHEET_LOADING_KEYS = [
	"position-loading-1",
	"position-loading-2",
	"position-loading-3",
	"position-loading-4",
	"position-loading-5",
	"position-loading-6",
] as const;

function SheetLoadingState() {
	return (
		<div className="space-y-5 px-6 py-5">
			<Skeleton className="h-10 w-56" />
			<Skeleton className="h-52 w-full rounded-xl" />
			<div className="grid gap-4 sm:grid-cols-2">
				{POSITION_SHEET_LOADING_KEYS.map((key) => (
					<Skeleton className="h-20 w-full" key={key} />
				))}
			</div>
		</div>
	);
}

export function PositionSheet({
	mortgageId,
	onOpenChange,
	open,
	portalId,
}: PositionSheetProps) {
	const { data, error, isPending } = useQuery({
		...lenderPortfolioPositionDetailQueryOptions(portalId, mortgageId),
	});

	return (
		<PortfolioDetailHost
			dataTestId="position-detail-host"
			description="Full-height position detail host with governed renewal actions available in the Renewal tab."
			onOpenChange={onOpenChange}
			open={open}
			title="Position detail"
		>
			{(() => {
				if (isPending) {
					return <SheetLoadingState />;
				}
				if (error || !data) {
					return (
						<div className="px-6 py-6 text-muted-foreground text-sm">
							Unable to load the position detail contract for this mortgage.
						</div>
					);
				}
				return (
					<>
						<PortfolioDetailSection
							description="The host stays single-column and sheet-first so downstream renewal content can plug in without creating a card-heavy sidebar."
							title={data.position.propertyLabel}
						>
							<div className="space-y-4">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="secondary">
										{formatPortfolioEnumLabel(data.mortgage.status)}
									</Badge>
									{data.position.renewalIntentStatus ? (
										<Badge variant="outline">
											Intent{" "}
											{formatPortfolioEnumLabel(
												data.position.renewalIntentStatus
											)}
										</Badge>
									) : null}
								</div>
								<div className="overflow-hidden border-border/70 border-y bg-muted">
									{data.property.heroImageUrl ? (
										<img
											alt={data.position.propertyLabel}
											className="h-64 w-full object-cover"
											height={720}
											src={data.property.heroImageUrl}
											width={1280}
										/>
									) : (
										<div className="flex h-64 items-center justify-center bg-gradient-to-br from-muted via-muted to-background text-muted-foreground text-sm">
											Property image unavailable
										</div>
									)}
								</div>
								<PortfolioKeyValueGrid className="lg:grid-cols-4">
									<PortfolioKeyValueRow
										label="Held"
										value={formatPortfolioFractions(
											data.position.fractionCount
										)}
									/>
									<PortfolioKeyValueRow
										label="Position"
										value={formatPortfolioPercent(
											data.position.positionPercent
										)}
									/>
									<PortfolioKeyValueRow
										label="Est. value"
										value={formatPortfolioCompactCurrency(
											data.position.estimatedPositionValue
										)}
									/>
									<PortfolioKeyValueRow
										label="Next payment"
										value={formatPortfolioDate(
											data.paymentOverview.nextPaymentDate
										)}
									/>
								</PortfolioKeyValueGrid>
							</div>
						</PortfolioDetailSection>

						<Tabs className="min-h-0" defaultValue="overview">
							<PortfolioDetailSection title="Sheet tabs">
								<TabsList variant="line">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="renewal">Renewal</TabsTrigger>
									<TabsTrigger value="terms">Loan terms</TabsTrigger>
								</TabsList>
							</PortfolioDetailSection>
							<TabsContent className="mt-0" value="overview">
								<PortfolioDetailSection
									description="Portfolio-owned position and renewal data from the shared backend contract."
									title="Position summary"
								>
									<PortfolioKeyValueGrid>
										<PortfolioKeyValueRow
											label="Property"
											value={`${data.property.streetAddress}, ${data.property.city}`}
										/>
										<PortfolioKeyValueRow
											label="Mortgage status"
											value={formatPortfolioEnumLabel(data.mortgage.status)}
										/>
										<PortfolioKeyValueRow
											label="Renewal timing"
											value={data.position.renewalTimingLabel}
										/>
										<PortfolioKeyValueRow
											label="Lender share payment"
											value={formatPortfolioCurrency(
												data.paymentOverview.lenderSharePaymentAmount
											)}
										/>
										<PortfolioKeyValueRow
											label="Renewal status"
											value={formatPortfolioEnumLabel(data.renewal.status)}
										/>
										<PortfolioKeyValueRow
											label="Signal deadline"
											value={formatPortfolioDate(data.renewal.signalDeadline)}
										/>
									</PortfolioKeyValueGrid>
								</PortfolioDetailSection>
								<PortfolioDetailSection
									description="These are the contract-backed quick action hosts. Renewal actions live in the dedicated Renewal tab."
									title="Quick actions"
								>
									<div className="divide-y divide-border/60">
										{data.quickActions
											.filter((action) => action.kind !== "renewal_prompt")
											.map((action) => (
												<div className="py-4" key={action.id}>
													<div className="flex flex-wrap items-start justify-between gap-3">
														<div className="space-y-1">
															<p className="font-medium text-sm">
																{action.title}
															</p>
															<p className="text-muted-foreground text-sm">
																{action.summary}
															</p>
														</div>
														<Badge variant="outline">
															{formatPortfolioEnumLabel(action.kind)}
														</Badge>
													</div>
												</div>
											))}
									</div>
								</PortfolioDetailSection>
							</TabsContent>
							<TabsContent className="mt-0" value="renewal">
								<PortfolioDetailSection
									description="This sheet renders the same governed renewal state and action affordances as the Actions Required rail."
									title="Renewal"
								>
									<RenewalActionSurface
										mortgageId={mortgageId}
										portalId={portalId}
										variant="full"
									/>
								</PortfolioDetailSection>
							</TabsContent>
							<TabsContent className="mt-0" value="terms">
								<PortfolioDetailSection
									description="Loan terms and servicing fields surfaced directly from the detail contract."
									title="Loan terms"
								>
									<PortfolioKeyValueGrid>
										<PortfolioKeyValueRow
											label="Principal"
											value={formatPortfolioCurrency(data.mortgage.principal)}
										/>
										<PortfolioKeyValueRow
											label="Interest rate"
											value={`${data.mortgage.interestRate}%`}
										/>
										<PortfolioKeyValueRow
											label="Payment frequency"
											value={formatPortfolioEnumLabel(
												data.mortgage.paymentFrequency
											)}
										/>
										<PortfolioKeyValueRow
											label="Payment amount"
											value={formatPortfolioCurrency(
												data.mortgage.paymentAmount
											)}
										/>
										<PortfolioKeyValueRow
											label="First payment"
											value={formatPortfolioDate(
												data.mortgage.firstPaymentDate
											)}
										/>
										<PortfolioKeyValueRow
											label="Maturity"
											value={formatPortfolioDate(data.mortgage.maturityDate)}
										/>
										<PortfolioKeyValueRow
											label="Rate type"
											value={formatPortfolioEnumLabel(data.mortgage.rateType)}
										/>
										<PortfolioKeyValueRow
											label="Lien position"
											value={String(data.mortgage.lienPosition)}
										/>
									</PortfolioKeyValueGrid>
								</PortfolioDetailSection>
							</TabsContent>
						</Tabs>

						<PortfolioDetailSection title="Host actions">
							<div className="flex flex-wrap gap-3">
								<Button
									disabled
									size="sm"
									title="Not available yet"
									variant="outline"
								>
									Open linked deal
								</Button>
								<Button
									disabled
									size="sm"
									title="Not available yet"
									variant="outline"
								>
									Message broker
								</Button>
							</div>
						</PortfolioDetailSection>
					</>
				);
			})()}
		</PortfolioDetailHost>
	);
}
