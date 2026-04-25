import {
	ArrowRight,
	BadgeCheck,
	CircleDollarSign,
	ShieldCheck,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import {
	buildBorrowerFinancingReturnPath,
	buildFinancingReturnPath,
	type FinancingContinuationKind,
	type FinancingPrefill,
} from "#/lib/portal/financing-prefill";
import type { RootRoutePortalContext } from "#/routes/__root";

const SLUG_WORD_SEPARATOR_PATTERN = /[-_]+/;

interface ActivePortalContext {
	canonicalHost: string;
	portal: Extract<RootRoutePortalContext, { kind: "portal" }>["portal"];
	requestedHost: string;
}

function getPortalBrandLabel(portalContext: ActivePortalContext) {
	if (portalContext.portal.portalType === "fairlend") {
		return "FairLend";
	}

	return String(portalContext.portal.slug)
		.split(SLUG_WORD_SEPARATOR_PATTERN)
		.filter(Boolean)
		.map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function hasPrefill(prefill: FinancingPrefill) {
	return Boolean(prefill.fullName || prefill.email || prefill.amountNeeded);
}

export function PortalFinancingStartPage({
	kind,
	portalContext,
	prefill,
}: {
	kind: FinancingContinuationKind;
	portalContext: ActivePortalContext;
	prefill: FinancingPrefill;
}) {
	const brandLabel = getPortalBrandLabel(portalContext);
	const isPreApproval = kind === "pre-approval";
	const title = isPreApproval
		? `Start pre-approval with ${brandLabel}`
		: `Start financing with ${brandLabel}`;
	const body = isPreApproval
		? "Continue from the broker landing page into a dedicated pre-approval path. The broker portal remains the attribution source before identity or application records are created."
		: "Continue from the broker landing page into a dedicated financing intake path. The broker portal remains the attribution source before identity or application records are created.";
	const returnPath = buildBorrowerFinancingReturnPath(kind, prefill);
	const signUpHref = `/sign-up?redirect=${encodeURIComponent(returnPath)}`;
	const alternateKind = isPreApproval ? "intake" : "pre-approval";
	const alternateHref = buildFinancingReturnPath(alternateKind, prefill);
	const resolvedHost =
		portalContext.canonicalHost || portalContext.requestedHost;

	return (
		<main className="min-h-screen bg-[#f7f5ef] text-stone-950">
			<nav
				aria-label="Financing continuation navigation"
				className="border-stone-200 border-b bg-white/72 backdrop-blur"
			>
				<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
					<a
						className="font-semibold text-[13px] uppercase tracking-[0.12em]"
						href="/"
					>
						{brandLabel}
					</a>
					<a className="text-sm text-stone-600 hover:text-stone-950" href="/">
						Back to portal home
					</a>
				</div>
			</nav>

			<section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-14">
				<div>
					<p className="font-semibold text-[11px] text-emerald-900 uppercase tracking-[0.18em]">
						Borrower / Mortgage Applicant
					</p>
					<h1 className="mt-3 text-balance font-serif text-5xl tracking-normal">
						{title}
					</h1>
					<p className="mt-5 max-w-2xl text-pretty text-base text-stone-600 leading-8">
						{body}
					</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<Button
							asChild
							className="bg-emerald-950 text-white hover:bg-emerald-900"
						>
							<a href={signUpHref}>
								{isPreApproval
									? "Continue pre-approval"
									: "Continue financing intake"}
								<ArrowRight aria-hidden className="size-4" />
							</a>
						</Button>
						<Button asChild variant="outline">
							<a href={alternateHref}>
								{isPreApproval ? "Use general intake" : "Jump to pre-approval"}
								<ArrowRight aria-hidden className="size-4" />
							</a>
						</Button>
					</div>
				</div>

				<Card className="rounded-lg border-stone-200 bg-white/82 shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-base">
							<ShieldCheck aria-hidden className="size-5 text-emerald-900" />
							Portal attribution
						</CardTitle>
					</CardHeader>
					<CardContent className="grid gap-5 text-sm text-stone-600">
						<div className="grid gap-2">
							<div className="flex items-center gap-2 text-stone-950">
								<BadgeCheck aria-hidden className="size-4 text-emerald-900" />
								<span className="font-medium">Resolved portal</span>
							</div>
							<p>
								This continuation is running on <strong>{resolvedHost}</strong>{" "}
								and carries broker portal attribution into the authenticated
								application flow.
							</p>
						</div>

						<div className="grid gap-3 border-stone-200 border-t pt-5">
							<div className="flex items-center gap-2 text-stone-950">
								<CircleDollarSign
									aria-hidden
									className="size-4 text-emerald-900"
								/>
								<span className="font-medium">Lightweight prefill</span>
							</div>
							{hasPrefill(prefill) ? (
								<dl className="grid gap-2">
									{prefill.fullName ? (
										<div className="grid gap-1">
											<dt className="text-[12px] text-stone-500">Full name</dt>
											<dd className="text-stone-950">{prefill.fullName}</dd>
										</div>
									) : null}
									{prefill.email ? (
										<div className="grid gap-1">
											<dt className="text-[12px] text-stone-500">Email</dt>
											<dd className="text-stone-950">{prefill.email}</dd>
										</div>
									) : null}
									{prefill.amountNeeded ? (
										<div className="grid gap-1">
											<dt className="text-[12px] text-stone-500">
												Amount needed
											</dt>
											<dd className="text-stone-950">{prefill.amountNeeded}</dd>
										</div>
									) : null}
								</dl>
							) : (
								<p>No landing-page prefill was provided.</p>
							)}
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
