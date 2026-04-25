import {
	ArrowRight,
	BadgeCheck,
	Building2,
	CircleDollarSign,
	Handshake,
	ShieldCheck,
} from "lucide-react";
import type { CSSProperties } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type {
	PublicPortalLandingAction,
	PublicPortalLandingListing,
	PublicPortalLandingPageContract,
} from "./landing-types";

const MAX_VISIBLE_LISTING_CARDS = 3;
type LandingThemeStyle = CSSProperties & {
	"--portal-landing-accent": string;
	"--portal-landing-bg": string;
	"--portal-landing-border": string;
	"--portal-landing-muted": string;
	"--portal-landing-primary": string;
	"--portal-landing-primary-hover": string;
	"--portal-landing-surface": string;
	"--portal-landing-text": string;
};

function buildLandingThemeStyle(
	landing: PublicPortalLandingPageContract
): LandingThemeStyle {
	return {
		"--portal-landing-accent": landing.theme.accentColor,
		"--portal-landing-bg": landing.theme.backgroundColor,
		"--portal-landing-border": landing.theme.borderColor,
		"--portal-landing-muted": landing.theme.mutedTextColor,
		"--portal-landing-primary": landing.theme.primaryColor,
		"--portal-landing-primary-hover": landing.theme.primaryHoverColor,
		"--portal-landing-surface": landing.theme.surfaceColor,
		"--portal-landing-text": landing.theme.textColor,
	};
}

function LandingActionLink({
	action,
	className,
	style,
	variant = "default",
}: {
	action: PublicPortalLandingAction;
	className?: string;
	style?: CSSProperties;
	variant?: "default" | "outline" | "secondary" | "ghost";
}) {
	return (
		<Button asChild className={className} style={style} variant={variant}>
			<a href={action.href}>
				{action.label}
				<ArrowRight aria-hidden className="size-4" />
			</a>
		</Button>
	);
}

function PortalLandingNavigation({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<nav
			aria-label="Portal landing navigation"
			className="border-[var(--portal-landing-border)] border-b bg-[var(--portal-landing-surface)]/72 backdrop-blur"
		>
			<div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-4 md:grid-cols-[auto_1fr_auto] lg:px-8">
				<a className="flex items-center gap-3" href="/">
					{landing.brand.logoUrl ? (
						<img
							alt={landing.brand.logoAlt}
							className="h-9 w-auto max-w-36 object-contain"
							height={36}
							src={landing.brand.logoUrl}
							width={144}
						/>
					) : null}
					<span className="grid gap-0.5">
						<span className="font-semibold text-[13px] text-[var(--portal-landing-text)] uppercase tracking-[0.12em]">
							{landing.navigation.brandLabel}
						</span>
						<span className="text-[12px] text-[var(--portal-landing-muted)]">
							{landing.navigation.poweredByLabel}
						</span>
					</span>
				</a>
				<div className="flex gap-4 overflow-x-auto whitespace-nowrap text-[13px] text-[var(--portal-landing-muted)] md:justify-center md:overflow-visible">
					{landing.navigation.items.map((item) => (
						<a
							className="transition-colors hover:text-[var(--portal-landing-text)]"
							href={item.href}
							key={`${item.href}-${item.label}`}
						>
							{item.label}
						</a>
					))}
				</div>
				<div className="text-[12px] text-[var(--portal-landing-muted)] md:text-right">
					{landing.navigation.rightLabel}
				</div>
			</div>
		</nav>
	);
}

function PortalLandingHero({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<section
			className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14"
			id="how-it-works"
		>
			<div className="max-w-4xl">
				<p className="font-semibold text-[11px] text-[var(--portal-landing-primary)] uppercase tracking-[0.18em]">
					{landing.hero.eyebrow}
				</p>
				<h1 className="mt-3 max-w-4xl text-balance font-serif text-5xl text-[var(--portal-landing-text)] tracking-normal sm:text-6xl lg:text-7xl">
					{landing.hero.headline}
				</h1>
				<p className="mt-5 max-w-2xl text-pretty text-[var(--portal-landing-muted)] text-base leading-8">
					{landing.hero.body}
				</p>
				<div className="mt-7 flex flex-wrap gap-3">
					<LandingActionLink
						action={landing.hero.primaryAction}
						className="text-white"
						style={{ backgroundColor: landing.theme.primaryColor }}
					/>
					<LandingActionLink
						action={landing.hero.secondaryAction}
						variant="outline"
					/>
				</div>
			</div>
			<div className="grid content-start gap-4 border-[var(--portal-landing-border)] border-l bg-[var(--portal-landing-surface)]/48 p-6">
				<div className="flex items-center gap-3 text-[var(--portal-landing-text)]">
					<Handshake
						aria-hidden
						className="size-5 text-[var(--portal-landing-primary)]"
					/>
					<h2 className="font-semibold text-[12px] uppercase tracking-[0.14em]">
						Broker-led access
					</h2>
				</div>
				<p className="text-[var(--portal-landing-muted)] text-sm leading-7">
					{landing.navigation.brandLabel} leads the relationship. FairLend
					provides the operating layer behind listings, financing starts, and
					secure handoff.
				</p>
				<div className="grid gap-3 border-[var(--portal-landing-border)] border-t pt-4 text-[var(--portal-landing-muted)] text-sm">
					<div className="flex items-center gap-2">
						<Building2
							aria-hidden
							className="size-4 text-[var(--portal-landing-primary)]"
						/>
						<span>{landing.switchboard.lender.label}</span>
					</div>
					<div className="flex items-center gap-2">
						<CircleDollarSign
							aria-hidden
							className="size-4 text-[var(--portal-landing-primary)]"
						/>
						<span>{landing.switchboard.borrower.label}</span>
					</div>
				</div>
			</div>
		</section>
	);
}

function PortalLandingTrustStrip({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<section
			aria-label="Broker trust indicators"
			className="border-[var(--portal-landing-border)] border-y bg-[var(--portal-landing-surface)]/70"
		>
			<div className="mx-auto flex max-w-7xl flex-wrap justify-center gap-3 px-4 py-5 lg:px-8">
				{landing.trustStrip.items.map((item) => (
					<div
						className="inline-flex items-center gap-2 border border-[var(--portal-landing-primary)]/20 border-dashed bg-[var(--portal-landing-surface)] px-3 py-2 text-[12px] text-[var(--portal-landing-muted)]"
						key={item.label}
					>
						<ShieldCheck
							aria-hidden
							className="size-4 text-[var(--portal-landing-primary)]"
						/>
						<span>{item.label}</span>
					</div>
				))}
			</div>
		</section>
	);
}

function PortalLandingSwitchboard({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<section
			aria-labelledby="portal-path-heading"
			className="border-[var(--portal-landing-border)] border-b bg-[var(--portal-landing-surface)]/42"
		>
			<div className="mx-auto grid max-w-7xl border-stone-200 px-4 md:grid-cols-[260px_1fr_1fr] lg:px-8">
				<div className="border-stone-200 border-b bg-emerald-950/5 py-6 md:border-r md:border-b-0 md:px-5">
					<p className="font-semibold text-[11px] text-stone-500 uppercase tracking-[0.16em]">
						{landing.switchboard.intro.kicker}
					</p>
					<h2
						className="mt-3 font-serif text-3xl text-stone-950 tracking-normal"
						id="portal-path-heading"
					>
						{landing.switchboard.intro.title}
					</h2>
					<p className="mt-3 text-sm text-stone-600 leading-6">
						{landing.switchboard.intro.body}
					</p>
				</div>
				<div className="border-stone-200 border-b py-6 md:border-r md:border-b-0 md:px-5">
					<p className="font-semibold text-[12px] text-stone-500 uppercase tracking-[0.14em]">
						{landing.switchboard.lender.label}
					</p>
					<p className="mt-3 min-h-16 text-sm text-stone-600 leading-6">
						{landing.switchboard.lender.body}
					</p>
					<LandingActionLink
						action={landing.switchboard.lender.primaryAction}
						className="mt-5 w-full justify-between text-white"
						style={{ backgroundColor: landing.theme.primaryColor }}
					/>
					<p className="mt-3 text-[12px] text-stone-500 leading-5">
						{landing.switchboard.lender.helper}
					</p>
				</div>
				<div className="py-6 md:px-5">
					<p className="font-semibold text-[12px] text-stone-500 uppercase tracking-[0.14em]">
						{landing.switchboard.borrower.label}
					</p>
					<p className="mt-3 min-h-16 text-sm text-stone-600 leading-6">
						{landing.switchboard.borrower.body}
					</p>
					<LandingActionLink
						action={landing.switchboard.borrower.primaryAction}
						className="mt-5 w-full justify-between text-white"
						style={{ backgroundColor: landing.theme.primaryHoverColor }}
					/>
					<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
						{landing.switchboard.borrower.nestedActions.map((action) => (
							<Button
								asChild
								className="justify-between bg-white"
								key={`${action.href}-${action.label}`}
								variant="outline"
							>
								<a href={action.href}>
									{action.label}
									<ArrowRight aria-hidden className="size-4" />
								</a>
							</Button>
						))}
					</div>
					<p className="mt-3 text-[12px] text-stone-500 leading-5">
						{landing.switchboard.borrower.helper}
					</p>
				</div>
			</div>
		</section>
	);
}

function PortalLandingTeaserCard({
	listing,
}: {
	listing: PublicPortalLandingListing;
}) {
	const isSecondPosition = listing.mortgagePositionLabel === "2nd";

	return (
		<article
			aria-label={`Featured listing: ${listing.title}`}
			className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm"
		>
			<div className="relative flex aspect-[16/10] items-center justify-center bg-stone-200">
				{listing.heroImageUrl ? (
					<img
						alt=""
						className="h-full w-full object-cover"
						height={360}
						src={listing.heroImageUrl}
						width={576}
					/>
				) : (
					<Building2 aria-hidden className="size-10 text-stone-400" />
				)}
			</div>
			<div className="grid gap-3 p-5">
				<div className="flex flex-wrap items-center gap-2 text-[12px] text-stone-500">
					<span
						className={cn(
							"rounded-md px-2 py-1 font-semibold text-white",
							isSecondPosition ? "bg-stone-700" : "bg-emerald-950"
						)}
					>
						{listing.mortgagePositionLabel}
					</span>
					<span>{listing.propertyTypeLabel}</span>
					<span className="ml-auto font-semibold text-emerald-800">
						{listing.statusLabel}
					</span>
				</div>
				<h3 className="line-clamp-2 min-h-11 font-semibold text-lg text-stone-950 leading-6">
					{listing.title}
				</h3>
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-stone-500">
					<strong className="text-base text-stone-950">
						{listing.amountLabel}
					</strong>
					<span className="font-semibold text-emerald-800">
						{listing.rateLabel}
					</span>
					<span>{listing.ltvLabel}</span>
					<span>{listing.termLabel}</span>
				</div>
			</div>
		</article>
	);
}

function PortalLandingFeaturedListings({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	const visibleItems = landing.featuredListings.items.slice(
		0,
		Math.min(
			MAX_VISIBLE_LISTING_CARDS,
			landing.featuredListings.visibleCardCount
		)
	);
	const showEmptyState =
		landing.featuredListings.enabled && visibleItems.length === 0;

	return (
		<section
			aria-labelledby="featured-listings-heading"
			className="mx-auto max-w-7xl px-4 py-12 lg:px-8"
		>
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h2
						className="font-semibold text-[13px] text-stone-950 uppercase tracking-[0.12em]"
						id="featured-listings-heading"
					>
						{landing.featuredListings.label}
					</h2>
					<p className="mt-2 text-sm text-stone-500">
						{landing.featuredListings.subcopy}
					</p>
				</div>
				{landing.featuredListings.enabled ? (
					<a
						className="inline-flex items-center gap-2 font-semibold text-emerald-900 text-sm"
						href={landing.featuredListings.viewAllAction.href}
					>
						{landing.featuredListings.viewAllAction.label}
						<ArrowRight aria-hidden className="size-4" />
					</a>
				) : null}
			</div>

			{landing.featuredListings.enabled ? null : (
				<div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
					Featured listings are not currently published for this portal.
				</div>
			)}
			{showEmptyState ? (
				<div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
					No featured mortgage opportunities are available right now.
				</div>
			) : null}
			{visibleItems.length > 0 ? (
				<div className="mt-6 grid gap-5 md:grid-cols-3">
					{visibleItems.map((listing) => (
						<PortalLandingTeaserCard key={listing.id} listing={listing} />
					))}
				</div>
			) : null}
			{landing.featuredListings.hasBlurredContinuation ? (
				<div
					aria-hidden
					className="mt-5 h-12 overflow-hidden [mask-image:linear-gradient(to_bottom,black,transparent)]"
					data-testid="featured-listings-continuation"
				>
					<div className="grid translate-y-2 gap-5 opacity-45 blur-[2.5px] md:grid-cols-3">
						<div className="h-24 rounded-lg border border-stone-200 bg-white" />
						<div className="h-24 rounded-lg border border-stone-200 bg-white" />
						<div className="h-24 rounded-lg border border-stone-200 bg-white" />
					</div>
				</div>
			) : null}
		</section>
	);
}

function PortalLandingFinancingStrip({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<section
			aria-labelledby="financing-strip-heading"
			className="border-stone-200 border-t bg-white/44"
		>
			<div className="mx-auto grid max-w-7xl gap-0 px-4 md:grid-cols-[1.05fr_0.95fr] lg:px-8">
				<div className="border-stone-200 border-b py-8 md:border-r md:border-b-0 md:pr-8">
					<p className="font-semibold text-[11px] text-stone-500 uppercase tracking-[0.16em]">
						{landing.financingStrip.kicker}
					</p>
					<h2
						className="mt-3 font-serif text-4xl text-stone-950 tracking-normal"
						id="financing-strip-heading"
					>
						{landing.financingStrip.title}
					</h2>
					<p className="mt-3 max-w-2xl text-sm text-stone-600 leading-7">
						{landing.financingStrip.body}
					</p>
				</div>
				<div className="py-8 md:pl-8">
					<div className="flex items-center gap-2">
						<BadgeCheck aria-hidden className="size-4 text-emerald-900" />
						<p className="font-semibold text-[11px] text-stone-500 uppercase tracking-[0.16em]">
							Inline pre-start
						</p>
					</div>
					<form
						action={landing.financingStrip.submitAction.href}
						className="mt-4 grid gap-2 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto]"
						method="get"
					>
						{landing.financingStrip.fields.map((field) => (
							<input
								aria-label={field.label}
								className="min-h-11 rounded-md border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-900 focus:ring-2 focus:ring-emerald-900/15"
								key={field.key}
								name={field.key}
								placeholder={field.label}
							/>
						))}
						<Button
							className="min-h-11 bg-emerald-950 text-white hover:bg-emerald-900"
							type="submit"
						>
							{landing.financingStrip.submitAction.label}
							<ArrowRight aria-hidden className="size-4" />
						</Button>
					</form>
				</div>
			</div>
		</section>
	);
}

export function PortalLandingPage({
	landing,
}: {
	landing: PublicPortalLandingPageContract;
}) {
	return (
		<main
			className="min-h-screen bg-[var(--portal-landing-bg)] text-[var(--portal-landing-text)]"
			data-testid="portal-landing-page"
			style={buildLandingThemeStyle(landing)}
		>
			<PortalLandingNavigation landing={landing} />
			<PortalLandingHero landing={landing} />
			<PortalLandingTrustStrip landing={landing} />
			<PortalLandingSwitchboard landing={landing} />
			<PortalLandingFeaturedListings landing={landing} />
			<PortalLandingFinancingStrip landing={landing} />
		</main>
	);
}
