"use client";

import { ArrowUpRight, ShieldAlert } from "lucide-react";
import {
	PortfolioDetailHost,
	PortfolioDetailSection,
	PortfolioKeyValueGrid,
	PortfolioKeyValueRow,
} from "#/components/lender/portfolio/detail-host";
import { formatPortfolioEnumLabel } from "#/components/lender/portfolio/portfolio-formatters";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type { MicMortgageDetail } from "./types";

function SummaryMetric({
	label,
	tone = "default",
	value,
}: {
	label: string;
	tone?: "critical" | "default" | "positive";
	value: string;
}) {
	return (
		<div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
			<p className="text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
				{label}
			</p>
			<p
				className={[
					"mt-2 font-semibold text-2xl tracking-tight",
					tone === "critical" ? "text-destructive" : "",
					tone === "positive" ? "text-emerald-700 dark:text-emerald-400" : "",
				]
					.filter(Boolean)
					.join(" ")}
			>
				{value}
			</p>
		</div>
	);
}

export interface MicMortgageDetailPanelProps {
	detail?: MicMortgageDetail | null;
	mortgageId?: string;
	onOpenChange: (open: boolean) => void;
	onOpenMortgagePage?: (mortgageId: string) => void;
	open: boolean;
}

export function MicMortgageDetailPanel({
	detail,
	mortgageId,
	onOpenChange,
	onOpenMortgagePage,
	open,
}: MicMortgageDetailPanelProps) {
	return (
		<PortfolioDetailHost
			dataTestId="mic-mortgage-detail-panel"
			description="Read-only mortgage drilldown sourced from the MIC transparency view."
			onOpenChange={onOpenChange}
			open={open}
			title="Mortgage detail"
		>
			{detail ? (
				<>
					<PortfolioDetailSection
						description={detail.subtitle}
						title={detail.propertyLabel}
					>
						<div className="space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								<Badge variant="secondary">
									{formatPortfolioEnumLabel(detail.status)}
								</Badge>
								<Badge variant="outline">MIC transparency</Badge>
							</div>
							<div className="overflow-hidden rounded-2xl border border-border/70 bg-muted">
								{detail.heroImageUrl ? (
									<img
										alt={detail.propertyLabel}
										className="h-64 w-full object-cover"
										height={720}
										src={detail.heroImageUrl}
										width={1280}
									/>
								) : (
									<div className="flex h-64 items-center justify-center bg-gradient-to-br from-muted via-muted to-background text-muted-foreground text-sm">
										Mortgage collateral image unavailable
									</div>
								)}
							</div>
							<PortfolioKeyValueGrid className="lg:grid-cols-4">
								{detail.summaryMetrics.map((metric) => (
									<SummaryMetric
										key={metric.label}
										label={metric.label}
										tone={metric.tone}
										value={metric.value}
									/>
								))}
							</PortfolioKeyValueGrid>
							<div className="rounded-2xl border border-amber-200/70 bg-amber-50/70 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
								<div className="flex items-start gap-3">
									<ShieldAlert className="mt-0.5 size-4 shrink-0" />
									<div className="space-y-1">
										<p className="font-medium text-sm">
											Read-only operational transparency
										</p>
										<p className="text-sm leading-6">{detail.addressLine}</p>
									</div>
								</div>
							</div>
						</div>
					</PortfolioDetailSection>

					<Tabs className="min-h-0" defaultValue="overview">
						<PortfolioDetailSection title="Mortgage views">
							<TabsList variant="line">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="economics">Economics</TabsTrigger>
								<TabsTrigger value="history">History</TabsTrigger>
							</TabsList>
						</PortfolioDetailSection>
						<TabsContent className="mt-0" value="overview">
							<PortfolioDetailSection
								description="Core mortgage facts already available in FairLend."
								title="Mortgage overview"
							>
								<PortfolioKeyValueGrid>
									{detail.overviewFields.map((field) => (
										<PortfolioKeyValueRow
											key={field.label}
											label={field.label}
											value={field.value}
										/>
									))}
								</PortfolioKeyValueGrid>
							</PortfolioDetailSection>
							<PortfolioDetailSection
								description="Collateral and property context exposed for MIC investors."
								title="Property facts"
							>
								<PortfolioKeyValueGrid>
									{detail.propertyFields.map((field) => (
										<PortfolioKeyValueRow
											key={field.label}
											label={field.label}
											value={field.value}
										/>
									))}
								</PortfolioKeyValueGrid>
							</PortfolioDetailSection>
						</TabsContent>
						<TabsContent className="mt-0" value="economics">
							<PortfolioDetailSection
								description="Current terms and servicing fields visible from the mortgage record and ledger."
								title="Economics and servicing"
							>
								<PortfolioKeyValueGrid>
									{detail.economicsFields.map((field) => (
										<PortfolioKeyValueRow
											key={field.label}
											label={field.label}
											value={field.value}
										/>
									))}
									{detail.servicingFields.map((field) => (
										<PortfolioKeyValueRow
											key={field.label}
											label={field.label}
											value={field.value}
										/>
									))}
								</PortfolioKeyValueGrid>
							</PortfolioDetailSection>
						</TabsContent>
						<TabsContent className="mt-0" value="history">
							<PortfolioDetailSection
								description="Mortgage lifecycle and servicing events currently available in the system."
								title="Mortgage history"
							>
								<div className="space-y-3">
									{detail.history.map((event) => (
										<div
											className="rounded-2xl border border-border/70 bg-muted/20 p-4"
											key={event.id}
										>
											<div className="flex flex-wrap items-start justify-between gap-3">
												<div className="space-y-1">
													<p className="font-medium text-sm">{event.title}</p>
													<p className="text-muted-foreground text-sm leading-6">
														{event.summary}
													</p>
												</div>
												<div className="space-y-1 text-right">
													<p className="text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
														{event.dateLabel}
													</p>
													<Badge variant="outline">
														{formatPortfolioEnumLabel(event.kind)}
													</Badge>
												</div>
											</div>
										</div>
									))}
								</div>
							</PortfolioDetailSection>
						</TabsContent>
					</Tabs>

					<PortfolioDetailSection title="Disclosures">
						<div className="space-y-3">
							{detail.disclosures.map((disclosure) => (
								<div
									className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-6"
									key={disclosure}
								>
									{disclosure}
								</div>
							))}
						</div>
					</PortfolioDetailSection>

					<PortfolioDetailSection title="Open full page">
						<div className="flex flex-wrap gap-3">
							<Button
								onClick={() => {
									if (mortgageId) {
										onOpenMortgagePage?.(mortgageId);
									}
								}}
								size="sm"
								variant="outline"
							>
								Open full mortgage detail
								<ArrowUpRight className="size-4" />
							</Button>
						</div>
					</PortfolioDetailSection>
				</>
			) : (
				<div className="px-6 py-6 text-muted-foreground text-sm">
					Unable to load the selected MIC mortgage detail.
				</div>
			)}
		</PortfolioDetailHost>
	);
}
