import type {
	ListingHeroImage,
	ListingValueTone,
} from "./listing-detail-types";

export const listingDetailHeroToneClasses: Record<
	ListingHeroImage["tone"],
	string
> = {
	mist: "bg-linear-to-br from-stone-100 via-stone-50 to-stone-200",
	pearl: "bg-linear-to-br from-neutral-100 via-stone-50 to-stone-200",
	sage: "bg-linear-to-br from-emerald-50 via-stone-100 to-stone-200",
	sand: "bg-linear-to-br from-amber-50 via-stone-100 to-stone-200",
	stone: "bg-linear-to-br from-stone-200 via-stone-100 to-stone-300",
	warm: "bg-linear-to-br from-orange-50 via-stone-100 to-stone-200",
};

export const listingDetailTextClasses = {
	checkoutLabel: "text-[color-mix(in_oklab,var(--sand)_58%,transparent)]",
	checkoutMeta: "text-[color-mix(in_oklab,var(--sand)_62%,transparent)]",
	checkoutSubtle: "text-[color-mix(in_oklab,var(--sand)_64%,transparent)]",
	sectionLabel:
		"font-semibold text-[12px] text-muted-foreground uppercase tracking-[0.22em]",
	warning: "text-[color-mix(in_oklab,var(--palm)_58%,var(--destructive))]",
} as const;

export const listingDetailValueToneClasses: Record<ListingValueTone, string> = {
	default: "text-foreground",
	positive: "text-[var(--palm)]",
	warning: listingDetailTextClasses.warning,
};

export const listingDetailSurfaceClasses = {
	checkoutInset:
		"border-[color-mix(in_oklab,var(--sand)_12%,transparent)] bg-[color-mix(in_oklab,var(--sand)_8%,transparent)]",
	checkoutPanel: "border-primary/20 bg-[var(--sea-ink)] text-[var(--sand)]",
	documentShell: "mt-5 flex overflow-hidden p-0",
	formInput:
		"rounded-lg border-border/80 bg-card/70 shadow-none focus-visible:ring-[var(--palm)]",
	header:
		"border-border/80 bg-card/75 backdrop-blur-lg supports-[backdrop-filter]:bg-card/65 dark:bg-card/60 dark:supports-[backdrop-filter]:bg-card/48",
	island:
		"rounded-xl border border-border/80 bg-card/90 text-card-foreground shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-card/78 dark:border-border/60 dark:bg-card/70 dark:supports-[backdrop-filter]:bg-card/52",
	mapUnavailable:
		"flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-4 py-6 text-center text-muted-foreground dark:bg-muted/25",
	mapUnavailableMarker:
		"relative flex size-[180px] items-center justify-center rounded-full border border-primary/25 border-dashed bg-background/50 dark:border-primary/35 dark:bg-background/30",
	mediaFallback: "flex h-full w-full items-center justify-center rounded-xl",
	lockStat: "rounded-lg border border-primary/15 bg-primary/10 px-3 py-2",
	mutedCard: "rounded-xl border border-border/70 bg-background/35 p-4",
	mutedPanel: "rounded-lg border border-border/70 bg-muted/35 px-4 py-4",
	outlineBadge:
		"border-border/80 bg-card/90 text-foreground/90 backdrop-blur-sm",
	popover:
		"rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg",
	primaryPill:
		"rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[12px] text-[var(--palm)]",
	primaryStat: "rounded-lg border border-primary/20 bg-primary/10",
	readOnlyMetric:
		"rounded-2xl border border-primary/15 bg-primary/10 px-5 py-4 text-right dark:border-primary/25 dark:bg-primary/15",
	segmentedControl: "rounded-lg border border-border/70 bg-muted/25 p-1",
	selectionIndicatorIdle: "border-muted-foreground/35 bg-card text-transparent",
	selectionIndicatorSelected:
		"border-[var(--palm)] bg-[var(--palm)] text-[var(--sand)]",
	selectableCardBase:
		"flex w-full items-start gap-3 rounded-xl border px-4 py-4 text-left transition-colors",
	selectableCardDisabled:
		"cursor-not-allowed opacity-60 hover:bg-background/40",
	selectableCardIdle:
		"border-border/80 bg-background/40 hover:bg-muted/45 dark:bg-background/25",
	selectableCardSelected:
		"border-primary/45 bg-primary/10 dark:border-primary/55 dark:bg-primary/15",
	tableHeader:
		"grid grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr] gap-3 bg-muted/40 px-4 py-3 text-[11px] text-muted-foreground uppercase tracking-[0.18em]",
	tableRow:
		"grid grid-cols-[1.6fr_1fr_0.9fr_0.8fr_0.8fr] gap-3 border-border/60 border-t px-4 py-3 text-sm",
} as const;

export const listingDetailActionClasses = {
	checkoutCta:
		"bg-[var(--sand)] text-[var(--sea-ink)] hover:bg-[color-mix(in_oklab,var(--sand)_92%,var(--lagoon))] disabled:bg-[color-mix(in_oklab,var(--sand)_35%,transparent)] disabled:text-[color-mix(in_oklab,var(--sea-ink)_70%,transparent)]",
	heroArrow:
		"absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border/60 bg-card/90 text-foreground shadow-md backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-50",
	primary:
		"bg-[var(--palm)] text-[var(--sand)] hover:bg-[color-mix(in_oklab,var(--palm)_86%,var(--sea-ink))]",
	secondaryPill: "border border-border/80 bg-background/60 hover:bg-muted/40",
} as const;

export const listingDetailBadgeClasses = {
	dark: "bg-[var(--palm)] text-[var(--sand)]",
	error:
		"bg-[color-mix(in_oklab,var(--destructive)_12%,var(--surface-strong))] text-destructive",
	imageCount:
		"bg-[color-mix(in_oklab,var(--sea-ink)_78%,transparent)] text-[var(--sand)]",
	positive:
		"bg-[color-mix(in_oklab,var(--palm)_12%,var(--surface-strong))] text-[var(--palm)]",
	statusPill:
		"border border-primary/15 bg-primary/10 text-[var(--palm)] dark:border-primary/25 dark:bg-primary/15",
} as const;

export const listingDetailStateClasses = {
	error: "border-destructive/25 bg-destructive/10 text-destructive",
	success:
		"border-[color-mix(in_oklab,var(--palm)_28%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_10%,var(--surface-strong))] text-[var(--palm)]",
	upcomingDue: "border border-primary/20 bg-primary/10",
	upcomingOverdue:
		"border border-destructive/20 bg-destructive/10 text-destructive",
	upcomingPlanned: "border border-primary/20",
	warning:
		"border-[color-mix(in_oklab,var(--palm)_22%,var(--line))] bg-[color-mix(in_oklab,var(--palm)_8%,var(--surface-strong))] text-[color-mix(in_oklab,var(--palm)_58%,var(--destructive))]",
} as const;

export const listingDetailPaymentClasses = {
	late: "bg-[color-mix(in_oklab,var(--palm)_58%,var(--destructive))] text-[var(--sand)]",
	onTime: "bg-[var(--palm)] text-[var(--sand)]",
} as const;
