import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Activity,
	ArrowUpRight,
	Clock3,
	Home,
	Landmark,
	type LucideIcon,
	Percent,
	ReceiptText,
	ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "#/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "#/components/ui/sheet";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import type { Id } from "../../../convex/_generated/dataModel";
import type { MicPositionRow } from "../../../convex/micPortfolio/contracts";
import { micPositionDetailQueryOptions } from "./query-options";

interface MicPositionDetailDrawerProps {
	onOpenChange: (open: boolean) => void;
	open: boolean;
	portalId: Id<"portals">;
	position: MicPositionRow | null;
}

function formatCurrency(value: number): string {
	return `$${value.toLocaleString("en-CA", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})}`;
}

function formatPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function formatMicPercent(value: number | null): string {
	return value === null ? "N/A" : `${value.toFixed(2)}%`;
}

function formatInteger(value: number): string {
	return value.toLocaleString("en-CA");
}

function formatStatus(value: string): string {
	return value.replaceAll("_", " ");
}

function formatUnix(ms: number): string {
	return new Date(ms).toLocaleString("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

function DetailSection({
	children,
	description,
	icon: Icon,
	title,
}: {
	children: ReactNode;
	description?: string;
	icon: LucideIcon;
	title: string;
}) {
	return (
		<section className="py-9 first:pt-8">
			<div className="mb-7 flex items-start gap-4">
				<div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--lagoon)_13%,transparent)] text-[var(--palm)] ring-1 ring-[color-mix(in_oklab,var(--lagoon)_24%,transparent)]">
					<Icon className="size-4" />
				</div>
				<div className="min-w-0">
					<h3 className="mic-display text-[1.45rem] text-[var(--sea-ink)] leading-none tracking-tight">
						{title}
					</h3>
					{description ? (
						<p className="mt-1 max-w-xl text-[var(--sea-ink-soft)] text-sm leading-relaxed">
							{description}
						</p>
					) : null}
				</div>
			</div>
			{children}
		</section>
	);
}

function MetricItem({
	children,
	emphasis = false,
	label,
}: {
	children: ReactNode;
	emphasis?: boolean;
	label: string;
}) {
	return (
		<div className="min-w-0">
			<dt className="font-semibold text-[10px] text-[var(--sea-ink-soft)] uppercase tracking-[0.16em]">
				{label}
			</dt>
			<dd
				className={
					emphasis
						? "mt-1 font-semibold text-[var(--sea-ink)] text-xl tabular-nums leading-tight"
						: "mt-1 text-[var(--sea-ink)] text-sm tabular-nums leading-snug"
				}
			>
				{children}
			</dd>
		</div>
	);
}

function StatusBadge({ children }: { children: ReactNode }) {
	return (
		<Badge
			className="rounded-full border border-[var(--chip-line)] bg-[var(--chip-bg)] px-2.5 py-1 font-semibold text-[var(--sea-ink)] capitalize"
			variant="outline"
		>
			{children}
		</Badge>
	);
}

function EmptyState({ children }: { children: ReactNode }) {
	return <p className="py-4 text-[var(--sea-ink-soft)] text-sm">{children}</p>;
}

function LedgerTableShell({ children }: { children: ReactNode }) {
	return (
		<div className="overflow-x-auto rounded-sm bg-[color-mix(in_oklab,var(--surface-strong)_64%,transparent)] ring-1 ring-[color-mix(in_oklab,var(--line)_52%,transparent)]">
			{children}
		</div>
	);
}

function getPositionPhotos(
	detail: {
		heroImages: Array<{
			caption: string | null;
			id: string;
			url: string | null;
		}>;
	},
	position: MicPositionRow
) {
	const heroImages = detail.heroImages.filter((h) => h.url !== null);
	if (heroImages.length > 0) {
		return heroImages;
	}

	if (!position.thumbnailUrl) {
		return [];
	}

	return [
		{
			caption: null,
			id: "thumb",
			url: position.thumbnailUrl,
		},
	];
}

function DrawerContent({
	portalId,
	position,
}: {
	portalId: Id<"portals">;
	position: MicPositionRow;
}) {
	const mortgageId = position.mortgageId as Id<"mortgages">;

	const { data: detailData } = useSuspenseQuery(
		micPositionDetailQueryOptions(portalId, mortgageId)
	);

	const detail = detailData?.position;

	if (!detail) {
		return (
			<p className="px-1 py-6 text-muted-foreground text-sm">
				Unable to load position details.
			</p>
		);
	}

	const payments = detail.payments;
	const photos = getPositionPhotos(detail, position);

	return (
		<div className="@container text-[var(--sea-ink)]">
			<section className="relative -mx-5 border-[color-mix(in_oklab,var(--line)_52%,transparent)] border-b sm:-mx-7">
				{photos.length > 0 ? (
					<div className="relative">
						<img
							alt={photos[0]?.caption ?? position.propertyLabel}
							className="aspect-[16/10] w-full object-cover"
							height={460}
							src={photos[0]?.url as string}
							width={736}
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/18 to-transparent" />
						<div className="absolute right-5 bottom-5 left-5">
							<p className="font-semibold text-[10px] text-white/72 uppercase tracking-[0.2em]">
								Collateral record
							</p>
							<h2 className="mic-display mt-2 max-w-xl text-balance @md:text-5xl text-4xl text-white leading-[0.95] tracking-tight">
								{position.propertyLabel}
							</h2>
							{photos[0]?.caption ? (
								<p className="mt-2 max-w-md text-sm text-white/72">
									{photos[0].caption}
								</p>
							) : null}
						</div>
					</div>
				) : (
					<div className="min-h-64 bg-[radial-gradient(circle_at_20%_10%,color-mix(in_oklab,var(--lagoon)_24%,transparent),transparent_36%),linear-gradient(145deg,var(--surface-strong),var(--foam))] px-6 py-10">
						<p className="font-semibold text-[10px] text-[var(--kicker)] uppercase tracking-[0.2em]">
							Collateral record
						</p>
						<h2 className="mic-display mt-3 max-w-xl text-balance @md:text-5xl text-4xl leading-[0.95] tracking-tight">
							{position.propertyLabel}
						</h2>
					</div>
				)}

				{photos.length > 1 ? (
					<div className="flex gap-2 overflow-x-auto bg-[var(--surface)] px-5 py-3 sm:px-7">
						{photos.slice(1).map((img) => (
							<img
								alt={img.caption ?? position.propertyLabel}
								className="aspect-[5/3] w-28 shrink-0 rounded-sm object-cover opacity-85"
								height={67}
								key={img.id}
								src={img.url as string}
								width={112}
							/>
						))}
					</div>
				) : null}
			</section>

			<section className="sticky top-0 z-10 -mx-5 bg-[var(--header-bg)]/95 px-5 py-5 shadow-[0_1px_0_color-mix(in_oklab,var(--line)_44%,transparent)] backdrop-blur-xl sm:-mx-7 sm:px-7">
				<div className="grid @md:grid-cols-3 @md:gap-x-8 gap-y-5">
					<div>
						<p className="font-semibold text-[10px] text-[var(--sea-ink-soft)] uppercase tracking-[0.16em]">
							MIC stake
						</p>
						<p className="mt-1 font-semibold text-3xl tabular-nums leading-none tracking-tight">
							{detail.micOwnership.percent.toFixed(2)}%
						</p>
					</div>
					<div>
						<p className="font-semibold text-[10px] text-[var(--sea-ink-soft)] uppercase tracking-[0.16em]">
							Units held
						</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums leading-none">
							{formatInteger(detail.micOwnership.units)}
						</p>
						<p className="mt-1 text-[var(--sea-ink-soft)] text-xs tabular-nums">
							of {formatInteger(detail.micOwnership.totalUnits)}
						</p>
					</div>
					<div>
						<p className="font-semibold text-[10px] text-[var(--sea-ink-soft)] uppercase tracking-[0.16em]">
							MIC principal
						</p>
						<p className="mt-1 font-semibold text-2xl tabular-nums leading-none">
							{formatCurrency(position.outstandingPrincipal)}
						</p>
					</div>
				</div>
				<p className="mt-3 max-w-2xl text-[var(--sea-ink-soft)] text-xs leading-relaxed">
					MIC share of each payment and outstanding principal follows this
					ownership slice.
				</p>
			</section>

			<div className="divide-y divide-[color-mix(in_oklab,var(--line)_42%,transparent)] px-0">
				<DetailSection icon={Home} title="Property">
					<div className="grid @md:grid-cols-[1.2fr_0.8fr] gap-6">
						<div>
							<p className="text-lg leading-relaxed">
								{detail.property.streetAddress}
								{detail.property.unit ? `, Unit ${detail.property.unit}` : ""}
								<br />
								{detail.property.city}, {detail.property.province}{" "}
								{detail.property.postalCode}
							</p>
						</div>
						<dl>
							<MetricItem label="Property type">
								<span className="capitalize">
									{formatStatus(detail.property.propertyType)}
								</span>
							</MetricItem>
						</dl>
					</div>
				</DetailSection>

				<DetailSection
					description="Core terms used by the MIC ledger when calculating scheduled obligations and maturity exposure."
					icon={Landmark}
					title="Mortgage Terms"
				>
					<dl className="grid @md:grid-cols-3 gap-x-10 gap-y-7">
						<MetricItem emphasis label="Principal">
							{formatCurrency(detail.mortgage.principal)}
						</MetricItem>
						<MetricItem emphasis label="Interest rate">
							{detail.mortgage.interestRate.toFixed(2)}%
						</MetricItem>
						<MetricItem label="Rate type">
							<span className="capitalize">{detail.mortgage.rateType}</span>
						</MetricItem>
						<MetricItem label="Term">
							{detail.mortgage.termMonths} months
						</MetricItem>
						<MetricItem label="Amortization">
							{detail.mortgage.amortizationMonths} months
						</MetricItem>
						<MetricItem emphasis label="Payment">
							{formatCurrency(detail.mortgage.paymentAmount)}{" "}
							<span className="text-[var(--sea-ink-soft)] text-sm capitalize">
								{detail.mortgage.paymentFrequency}
							</span>
						</MetricItem>
						<MetricItem label="Lien position">
							{detail.mortgage.lienPosition}
						</MetricItem>
						<MetricItem label="Maturity">
							{detail.mortgage.maturityDate}
						</MetricItem>
						<MetricItem label="Status">
							<StatusBadge>{formatStatus(detail.mortgage.status)}</StatusBadge>
						</MetricItem>
					</dl>
				</DetailSection>

				<DetailSection
					description="Current MIC exposure and servicing signals for this position."
					icon={Percent}
					title="Position"
				>
					<dl className="grid @md:grid-cols-4 gap-x-10 gap-y-7">
						<MetricItem emphasis label="Outstanding">
							{formatCurrency(position.outstandingPrincipal)}
						</MetricItem>
						<MetricItem label="Units">
							{formatInteger(position.positionUnits)}
						</MetricItem>
						<MetricItem emphasis label="LTV">
							{formatPercent(position.ltv)}
						</MetricItem>
						<MetricItem label="Arrears">
							<StatusBadge>
								{formatStatus(position.arrearsSignal.status)}
							</StatusBadge>
						</MetricItem>
					</dl>
				</DetailSection>

				<DetailSection
					description="Active marketplace workflows currently moving against this mortgage."
					icon={Activity}
					title="Ongoing Deals"
				>
					{detail.ongoingDeals.length === 0 ? (
						<EmptyState>
							No active deal closing workflows for this mortgage.
						</EmptyState>
					) : (
						<ul className="space-y-3">
							{detail.ongoingDeals.map((deal) => (
								<li
									className="grid @md:grid-cols-[auto_1fr_auto] @md:items-center gap-3 rounded-sm bg-[color-mix(in_oklab,var(--surface-strong)_58%,transparent)] px-4 py-3"
									key={deal.dealId}
								>
									<StatusBadge>{formatStatus(deal.status)}</StatusBadge>
									<p className="text-sm">
										<span className="font-semibold tabular-nums">
											{formatInteger(deal.fractionalShareUnits)}
										</span>{" "}
										units /{" "}
										<span className="font-semibold tabular-nums">
											{deal.fractionalSharePercent.toFixed(2)}%
										</span>{" "}
										of mortgage
									</p>
									<p className="text-[var(--sea-ink-soft)] text-xs tabular-nums">
										opened {formatUnix(deal.createdAt)}
									</p>
								</li>
							))}
						</ul>
					)}
				</DetailSection>

				<DetailSection icon={Clock3} title="Deal History">
					{detail.dealHistory.length === 0 ? (
						<EmptyState>No recorded deals.</EmptyState>
					) : (
						<LedgerTableShell>
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead>Status</TableHead>
										<TableHead>Share</TableHead>
										<TableHead>Opened</TableHead>
										<TableHead>Terminal</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.dealHistory.map((deal) => (
										<TableRow
											className="border-[color-mix(in_oklab,var(--line)_42%,transparent)] hover:bg-[var(--surface)]/60"
											key={deal.dealId}
										>
											<TableCell className="text-xs capitalize">
												{formatStatus(deal.status)}
											</TableCell>
											<TableCell className="text-xs tabular-nums">
												{formatInteger(deal.fractionalShareUnits)} u /{" "}
												{deal.fractionalSharePercent.toFixed(1)}%
											</TableCell>
											<TableCell className="whitespace-nowrap text-xs tabular-nums">
												{formatUnix(deal.createdAt)}
											</TableCell>
											<TableCell className="text-xs">
												{deal.isTerminal ? "Yes" : "No"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</LedgerTableShell>
					)}
				</DetailSection>

				<DetailSection icon={ArrowUpRight} title="Transfers">
					{detail.transferHistory.length === 0 ? (
						<EmptyState>
							No transfer requests recorded for this mortgage.
						</EmptyState>
					) : (
						<LedgerTableShell>
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead>Status</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Obligation</TableHead>
										<TableHead>Created</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{detail.transferHistory.map((t) => (
										<TableRow
											className="border-[color-mix(in_oklab,var(--line)_42%,transparent)] hover:bg-[var(--surface)]/60"
											key={t.transferId}
										>
											<TableCell className="text-xs capitalize">
												{formatStatus(t.status)}
											</TableCell>
											<TableCell className="text-xs tabular-nums">
												{formatCurrency(t.amount)} {t.currency}
											</TableCell>
											<TableCell className="max-w-[150px] truncate text-xs capitalize">
												{formatStatus(t.transferType)} /{" "}
												{formatStatus(t.direction)}
											</TableCell>
											<TableCell className="text-xs">
												{t.hasObligationLink ? "Linked" : "None"}
											</TableCell>
											<TableCell className="whitespace-nowrap text-xs tabular-nums">
												{formatUnix(t.createdAt)}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</LedgerTableShell>
					)}
				</DetailSection>

				<DetailSection
					description="High-level governed-transition events for this mortgage. Raw payloads and PII are intentionally omitted."
					icon={ShieldCheck}
					title="Audit Trail"
				>
					{detail.auditHistory.length === 0 ? (
						<EmptyState>No audit rows returned.</EmptyState>
					) : (
						<div className="max-h-80 overflow-auto">
							<LedgerTableShell>
								<Table>
									<TableHeader>
										<TableRow className="hover:bg-transparent">
											<TableHead>Time</TableHead>
											<TableHead>Event</TableHead>
											<TableHead>Entity</TableHead>
											<TableHead>Transition</TableHead>
											<TableHead>Outcome</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{detail.auditHistory.map((row) => (
											<TableRow
												className="border-[color-mix(in_oklab,var(--line)_42%,transparent)] hover:bg-[var(--surface)]/60"
												key={row.eventId}
											>
												<TableCell className="whitespace-nowrap text-xs tabular-nums">
													{formatUnix(row.timestamp)}
												</TableCell>
												<TableCell className="max-w-[140px] truncate text-[11px]">
													{formatStatus(row.eventType)}
												</TableCell>
												<TableCell className="text-xs">
													{formatStatus(row.entityType)}
												</TableCell>
												<TableCell className="max-w-[190px] text-[11px] leading-tight">
													<span className="text-[var(--sea-ink-soft)]">
														{formatStatus(row.previousState)}
													</span>{" "}
													to {formatStatus(row.newState)}
												</TableCell>
												<TableCell className="text-xs capitalize">
													{formatStatus(row.outcome)}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</LedgerTableShell>
						</div>
					)}
				</DetailSection>

				<DetailSection
					description="Scheduled obligations tied to this MIC-held mortgage, with gross and participation share visibility."
					icon={ReceiptText}
					title="Payment History"
				>
					{payments.length === 0 ? (
						<EmptyState>No payment history available.</EmptyState>
					) : (
						<LedgerTableShell>
							<Table>
								<TableHeader>
									<TableRow className="hover:bg-transparent">
										<TableHead>Due</TableHead>
										<TableHead>Gross</TableHead>
										<TableHead>MIC share</TableHead>
										<TableHead>MIC %</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Collection</TableHead>
										<TableHead>Transfer</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{payments.map((payment) => (
										<TableRow
											className="border-[color-mix(in_oklab,var(--line)_42%,transparent)] hover:bg-[var(--surface)]/60"
											key={payment.obligationId}
										>
											<TableCell className="whitespace-nowrap text-xs tabular-nums">
												{payment.dueDate}
											</TableCell>
											<TableCell className="text-xs tabular-nums">
												{formatCurrency(payment.grossAmount)}
											</TableCell>
											<TableCell className="text-xs tabular-nums">
												{formatCurrency(payment.micShareAmount)}
											</TableCell>
											<TableCell className="text-xs tabular-nums">
												{formatMicPercent(payment.micSharePercentOfGross)}
											</TableCell>
											<TableCell>
												<StatusBadge>
													{formatStatus(payment.rowStatus)}
												</StatusBadge>
											</TableCell>
											<TableCell className="text-xs capitalize">
												{payment.latestCollectionStatus
													? formatStatus(payment.latestCollectionStatus)
													: "None"}
											</TableCell>
											<TableCell className="text-xs capitalize">
												{payment.latestTransferStatus
													? formatStatus(payment.latestTransferStatus)
													: "None"}
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</LedgerTableShell>
					)}
				</DetailSection>

				{position.drilldownIds.listingId ? (
					<div className="py-8">
						<Link
							className="inline-flex items-center gap-2 font-semibold text-[var(--palm)] text-sm underline-offset-4 hover:text-[var(--sea-ink)] hover:underline"
							params={{
								listingId: position.drilldownIds.listingId,
							}}
							to="/listings/$listingId"
						>
							View marketplace listing
							<ArrowUpRight className="size-4" />
						</Link>
					</div>
				) : null}
			</div>
		</div>
	);
}

export function MicPositionDetailDrawer({
	position,
	open,
	onOpenChange,
	portalId,
}: MicPositionDetailDrawerProps) {
	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent className="mic-portal-dashboard flex w-full flex-col gap-0 overflow-y-auto border-[var(--line)] bg-[var(--foam)] p-0 text-[var(--sea-ink)] shadow-[0_24px_90px_rgba(3,18,21,0.32)] sm:max-w-3xl">
				<SheetHeader className="sr-only">
					<SheetTitle>
						{position?.propertyLabel ?? "Position detail"}
					</SheetTitle>
					<SheetDescription>
						MIC position detail drawer with collateral, terms, payment, deal,
						transfer, and audit history.
					</SheetDescription>
				</SheetHeader>

				{position ? (
					<div className="px-5 pb-8 sm:px-7">
						<DrawerContent portalId={portalId} position={position} />
					</div>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
