import { cva } from "class-variance-authority";
import {
	CalendarDays,
	CircleDollarSign,
	CirclePercent,
	Lock,
	MapPin,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import { Separator } from "#/components/ui/separator";
import { cn } from "#/lib/utils";
import { OwnershipBar } from "./OwnershipBar";

export interface HorizontalProps {
	address?: string;
	apr?: number;
	availablePercent?: number;
	fractionsSummary?: string;
	id?: string;
	imageSrc?: string;
	locked?: boolean;
	lockedPercent?: number;
	ltv?: number;
	marketValue?: number;
	maturityDate?: string;
	principal?: number;
	propertyType?: string;
	soldPercent?: number;
	title?: string;
	variant?: "default" | "nativeMobile";
}

const listingCardVariants = cva(
	"w-full min-w-0 max-w-full overflow-hidden transition-all duration-300",
	{
		defaultVariants: {
			variant: "default",
		},
		variants: {
			variant: {
				default:
					"gap-0 border-none bg-opacity-0 px-4 py-4 shadow-none hover:scale-[1.03] hover:shadow-black/10 hover:shadow-lg active:scale-100",
				nativeMobile:
					"rounded-[20px] border-none bg-background p-0 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_18px_rgba(15,23,42,0.07)] active:scale-[0.995] md:hidden",
			},
		},
	}
);

function formatCompactCurrency(value: number) {
	const absolute = Math.abs(value);

	if (absolute >= 1_000_000) {
		return `${value < 0 ? "-" : ""}$${(absolute / 1_000_000).toFixed(1)}M`;
	}

	if (absolute >= 1000) {
		return `${value < 0 ? "-" : ""}$${(absolute / 1000).toFixed(0)}K`;
	}

	return `${value < 0 ? "-" : ""}$${Math.round(absolute).toLocaleString()}`;
}

function formatPercentValue(
	value: number,
	options?: { ratioFallback?: boolean }
) {
	const normalized =
		options?.ratioFallback && value > 0 && value <= 1 ? value * 100 : value;
	return `${normalized.toFixed(normalized >= 10 ? 0 : 1)}%`;
}

function formatMonthlyIncome(principal: number, apr: number) {
	return formatCompactCurrency((principal * (apr / 100)) / 12);
}

export function Horizontal({
	title = "Malibu Beach Detached",
	address = "Malibu, CA",
	imageSrc,
	ltv = 80,
	apr = 9.5,
	principal = 350_000,
	marketValue = 500_000,
	propertyType,
	maturityDate = "01/01/2026",
	locked = false,
	availablePercent = 100,
	fractionsSummary,
	lockedPercent = 0,
	soldPercent = 0,
	variant = "default",
}: HorizontalProps = {}) {
	if (variant === "nativeMobile") {
		return (
			<Card className={listingCardVariants({ variant })}>
				<CardContent className="p-0">
					<div className="grid min-h-[156px] w-full min-w-0 max-w-full grid-cols-[104px_minmax(0,1fr)] min-[390px]:grid-cols-[112px_minmax(0,1fr)]">
						<div className="relative min-w-0 overflow-hidden bg-muted">
							{imageSrc ? (
								<img
									alt={`${title} thumbnail`}
									className="h-full w-full object-cover"
									height={360}
									src={imageSrc}
									width={300}
								/>
							) : (
								<div className="h-full w-full bg-[linear-gradient(135deg,#d8dde5,#f4f5f7)]" />
							)}
							<div className="absolute top-2 right-1.5 left-1.5 rounded-[10px] bg-background/95 px-1.5 py-1 shadow-[0_5px_14px_rgba(15,23,42,0.16)]">
								<div className="flex min-w-0 items-center gap-1.5">
									<span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
										<CircleDollarSign aria-hidden="true" className="size-3.5" />
									</span>
									<span className="min-w-0 leading-none">
										<span className="block font-semibold text-[9px] text-muted-foreground uppercase">
											Mo. income
										</span>
										<span className="block truncate font-bold text-[13px] text-foreground tabular-nums">
											{formatMonthlyIncome(principal, apr)}
										</span>
									</span>
								</div>
							</div>
							{locked ? (
								<Badge
									className="absolute bottom-2 left-2 gap-1"
									variant="destructive"
								>
									<Lock className="size-3" />
									Locked
								</Badge>
							) : null}
						</div>

						<div className="flex min-w-0 flex-col overflow-hidden px-3 py-2.5">
							<div className="w-full min-w-0 max-w-full overflow-hidden">
								<CardTitle className="line-clamp-2 max-w-full break-words font-semibold text-[16px] leading-[1.15] tracking-normal">
									{title}
								</CardTitle>
								<CardDescription className="mt-1 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
									<MapPin className="size-3 shrink-0" />
									<span className="truncate">
										{address}
										{propertyType ? ` • ${propertyType}` : ""}
									</span>
								</CardDescription>
							</div>

							<div className="mt-2 grid min-w-0 grid-cols-3 divide-x divide-border/60 text-center">
								<MobileMetric
									label="LTV"
									value={formatPercentValue(ltv, { ratioFallback: true })}
								/>
								<MobileMetric label="APR" value={formatPercentValue(apr)} />
								<MobileMetric
									label="Principal"
									value={formatCompactCurrency(principal)}
								/>
							</div>

							<div className="mt-auto grid min-w-0 grid-cols-[88px_minmax(0,1fr)] items-end gap-2 pt-2">
								<div className="min-w-0">
									<CardDescription className="flex items-center gap-1 text-[11px]">
										<CalendarDays className="size-3.5" />
										Maturity
									</CardDescription>
									<p className="mt-0.5 font-semibold text-[12px] tabular-nums">
										{maturityDate}
									</p>
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
										<span>Available</span>
										<span className="font-semibold text-primary tabular-nums">
											{availablePercent}%
										</span>
									</div>
									<OwnershipBar
										availablePercent={availablePercent}
										lockedPercent={lockedPercent}
										soldPercent={soldPercent}
									/>
									{fractionsSummary ? (
										<p className="mt-1 truncate text-[10px] text-muted-foreground tabular-nums">
											{fractionsSummary}
										</p>
									) : null}
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={cn(listingCardVariants({ variant }))}>
			<CardContent className="min-w-0 p-0">
				<div className="flex min-w-0 flex-col gap-4 md:flex-row">
					<div className="relative aspect-video w-full min-w-0 shrink-0 overflow-hidden rounded-2xl md:aspect-square md:max-w-[180px] xl:aspect-auto">
						{imageSrc ? (
							<img
								alt={`${title} thumbnail`}
								className="pointer-events-none h-full w-full select-none rounded-xl object-cover transition-all duration-300 hover:scale-105"
								height={540}
								src={imageSrc}
								width={720}
							/>
						) : null}
						{locked ? (
							<div className="absolute top-2 left-2">
								<Badge className="gap-1" variant="destructive">
									<Lock className="h-3 w-3" />
									Locked
								</Badge>
							</div>
						) : null}
					</div>
					<div className="flex min-w-0 flex-1 flex-col gap-3">
						<CardHeader className="min-w-0 space-y-1 p-0">
							<CardTitle className="line-clamp-2 break-words leading-tight">
								{title}
							</CardTitle>
							<CardDescription className="flex w-full min-w-0 items-center gap-2 align-middle text-foreground/70">
								<MapPin className="h-4 w-4 shrink-0" />
								<span className="min-w-0 truncate">
									{address}
									{propertyType ? ` • ${propertyType}` : ""}
								</span>
							</CardDescription>
						</CardHeader>
						<div className="grid min-w-0 grid-cols-3 gap-x-1 gap-y-2 text-muted-foreground text-sm sm:flex sm:items-center sm:justify-around sm:gap-3 lg:gap-2 xl:flex min-[98rem]:grid min-[98rem]:grid-cols-2">
							<span className="flex min-w-0 items-center">
								<CirclePercent className="h-5 w-5 shrink-0" />
								<span className="ml-1 flex min-w-0 flex-col justify-around py-1 align-middle sm:ml-2">
									<CardDescription className="text-xs">LTV</CardDescription>
									<span className="font-bold text-sm tabular-nums">{ltv}</span>
								</span>
							</span>
							<Separator
								className="hidden h-8 bg-foreground/30 sm:block xl:block min-[98rem]:hidden"
								orientation="vertical"
							/>
							<span className="flex min-w-0 items-center">
								<CirclePercent className="h-5 w-5 shrink-0" />
								<span className="ml-1 flex min-w-0 flex-col justify-around py-1 align-middle sm:ml-2">
									<CardDescription className="text-xs">IR</CardDescription>
									<span className="font-bold text-sm tabular-nums">{apr}</span>
								</span>
							</span>
							<Separator
								className="hidden h-8 bg-foreground/30 sm:block xl:block min-[98rem]:hidden"
								orientation="vertical"
							/>
							<span className="flex min-w-0 items-center">
								<CircleDollarSign className="h-5 w-5 shrink-0" />
								<span className="ml-1 flex min-w-0 flex-col justify-around py-1 align-middle sm:ml-2">
									<CardDescription className="text-xs">
										Principal
									</CardDescription>
									<span className="font-bold text-sm tabular-nums">
										{(principal / 1000).toFixed(0)}K
									</span>
								</span>
							</span>
							<Separator
								className="hidden h-8 bg-foreground/30 lg:block xl:block min-[98rem]:hidden"
								orientation="vertical"
							/>
							<span className="col-span-3 hidden min-w-0 items-center lg:col-span-1 lg:flex">
								<CircleDollarSign className="h-5 w-5 shrink-0" />
								<span className="ml-1 flex min-w-0 flex-col justify-around py-1 align-middle sm:ml-2">
									<CardDescription className="text-xs">
										Market Value
									</CardDescription>
									<span className="font-bold text-sm tabular-nums">
										{(marketValue / 1000).toFixed(0)}K
									</span>
								</span>
							</span>
						</div>
						<CardFooter className="mt-auto grid w-full min-w-0 grid-cols-1 gap-3 border-0 p-0 sm:grid-cols-[minmax(0,auto)_minmax(0,1fr)] sm:items-start sm:gap-x-6 sm:gap-y-0">
							<div className="flex min-w-0 flex-col gap-1">
								<CardDescription className="flex items-center gap-0 text-foreground/50">
									<CalendarDays className="mr-1 h-4 w-4 shrink-0" />
									Maturity
								</CardDescription>
								<span className="font-medium text-foreground/60 text-sm tabular-nums">
									{maturityDate}
								</span>
							</div>
							<div className="min-w-0 space-y-1">
								<OwnershipBar
									availablePercent={availablePercent}
									lockedPercent={lockedPercent}
									soldPercent={soldPercent}
								/>
								{fractionsSummary ? (
									<p className="text-[11px] text-muted-foreground tabular-nums">
										{fractionsSummary}
									</p>
								) : null}
							</div>
						</CardFooter>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function MobileMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 px-1">
			<p className="truncate text-[10px] text-muted-foreground">{label}</p>
			<p className="mt-0.5 truncate font-bold text-[12px] tabular-nums">
				{value}
			</p>
		</div>
	);
}
