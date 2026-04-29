"use client";

import { ArrowLeft } from "lucide-react";
import {
	PortfolioDetailSection,
	PortfolioKeyValueGrid,
	PortfolioKeyValueRow,
} from "#/components/lender/portfolio/detail-host";
import { formatPortfolioEnumLabel } from "#/components/lender/portfolio/portfolio-formatters";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import type { MicMortgageDetail } from "./types";

interface MicMortgageDetailPageProps {
	detail: MicMortgageDetail;
	onBackToPortfolio?: () => void;
}

function DetailMetric({ label, value }: { label: string; value: string }) {
	return (
		<Card className="border-border/70 bg-card/95">
			<CardHeader className="pb-3">
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-3xl tracking-tight">{value}</CardTitle>
			</CardHeader>
		</Card>
	);
}

export function MicMortgageDetailPage({
	detail,
	onBackToPortfolio,
}: MicMortgageDetailPageProps) {
	return (
		<div
			className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
			data-testid="mic-mortgage-detail-page"
		>
			<section className="overflow-hidden rounded-[28px] border border-border/70 bg-card/95">
				<div className="grid gap-6 px-6 py-7 lg:grid-cols-[minmax(0,1.3fr)_24rem] lg:px-8">
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-3">
							{onBackToPortfolio ? (
								<Button onClick={onBackToPortfolio} size="sm" variant="ghost">
									<ArrowLeft className="size-4" />
									Back to portfolio
								</Button>
							) : null}
							<Badge variant="outline">MIC mortgage detail</Badge>
							<Badge variant="secondary">
								{formatPortfolioEnumLabel(detail.status)}
							</Badge>
						</div>
						<div className="space-y-3">
							<h1 className="font-semibold text-4xl tracking-tight">
								{detail.propertyLabel}
							</h1>
							<p className="max-w-3xl text-lg text-muted-foreground leading-7">
								{detail.subtitle}
							</p>
							<p className="text-muted-foreground text-sm">
								{detail.addressLine}
							</p>
						</div>
					</div>
					<div className="overflow-hidden rounded-3xl border border-border/70 bg-muted">
						{detail.heroImageUrl ? (
							<img
								alt={detail.propertyLabel}
								className="h-full min-h-64 w-full object-cover"
								height={720}
								src={detail.heroImageUrl}
								width={1280}
							/>
						) : (
							<div className="flex h-full min-h-64 items-center justify-center bg-gradient-to-br from-muted via-muted to-background text-muted-foreground text-sm">
								Collateral image unavailable
							</div>
						)}
					</div>
				</div>
			</section>

			<section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
				{detail.summaryMetrics.map((metric) => (
					<DetailMetric
						key={metric.label}
						label={metric.label}
						value={metric.value}
					/>
				))}
			</section>

			<section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
				<div className="space-y-6">
					<Card className="overflow-hidden border-border/70 bg-card/95">
						<PortfolioDetailSection
							description="Mortgage and collateral facts already modeled in the system."
							title="Overview"
						>
							<PortfolioKeyValueGrid className="lg:grid-cols-3">
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
							description="Current economics available from mortgage terms and related records."
							title="Economics"
						>
							<PortfolioKeyValueGrid className="lg:grid-cols-3">
								{detail.economicsFields.map((field) => (
									<PortfolioKeyValueRow
										key={field.label}
										label={field.label}
										value={field.value}
									/>
								))}
							</PortfolioKeyValueGrid>
						</PortfolioDetailSection>
						<PortfolioDetailSection
							description="Operational servicing context and property details."
							title="Servicing and property"
						>
							<PortfolioKeyValueGrid className="lg:grid-cols-3">
								{detail.servicingFields.map((field) => (
									<PortfolioKeyValueRow
										key={field.label}
										label={field.label}
										value={field.value}
									/>
								))}
								{detail.propertyFields.map((field) => (
									<PortfolioKeyValueRow
										key={field.label}
										label={field.label}
										value={field.value}
									/>
								))}
							</PortfolioKeyValueGrid>
						</PortfolioDetailSection>
					</Card>
				</div>

				<div className="space-y-6">
					<Card className="border-border/70 bg-card/95">
						<CardHeader className="border-border/70 border-b pb-5">
							<CardDescription>Mortgage lifecycle</CardDescription>
							<CardTitle className="text-2xl">History</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-5">
							{detail.history.map((event) => (
								<div
									className="rounded-2xl border border-border/70 bg-muted/20 p-4"
									key={event.id}
								>
									<p className="text-[11px] text-muted-foreground uppercase tracking-[0.16em]">
										{event.dateLabel}
									</p>
									<p className="mt-2 font-medium text-sm">{event.title}</p>
									<p className="mt-2 text-muted-foreground text-sm leading-6">
										{event.summary}
									</p>
								</div>
							))}
						</CardContent>
					</Card>

					<Card className="border-border/70 bg-card/95">
						<CardHeader className="border-border/70 border-b pb-5">
							<CardDescription>Reporting notes</CardDescription>
							<CardTitle className="text-2xl">Disclosures</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 pt-5">
							{detail.disclosures.map((disclosure) => (
								<div
									className="rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-6"
									key={disclosure}
								>
									{disclosure}
								</div>
							))}
						</CardContent>
					</Card>
				</div>
			</section>
		</div>
	);
}
