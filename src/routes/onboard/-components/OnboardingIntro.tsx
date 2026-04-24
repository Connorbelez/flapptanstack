import { ArrowRight, Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "#/components/ui/button";
import type { RootPortalContext } from "#/lib/portal/host-resolution";
import {
	buildOnboardingRedirect,
	type OnboardingReferralSearch,
} from "../-lib/referral";

interface OnboardingIntroProps {
	portalContext: RootPortalContext;
	search: OnboardingReferralSearch;
}

function authHref(
	route: "sign-in" | "sign-up",
	search: OnboardingReferralSearch
) {
	const redirect = buildOnboardingRedirect(search) ?? "/onboard";
	return `/${route}?redirect=${encodeURIComponent(redirect)}`;
}

function resolveHostLabel(portalContext: RootPortalContext) {
	if (portalContext.kind === "portal") {
		return portalContext.portal.slug;
	}
	if (portalContext.kind === "marketing") {
		return "FairLend";
	}
	return portalContext.canonicalHost;
}

export function OnboardingIntro({
	portalContext,
	search,
}: OnboardingIntroProps) {
	const hostLabel = resolveHostLabel(portalContext);
	return (
		<main className="min-h-[calc(100vh-4rem)] bg-stone-50 text-stone-950">
			<section className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-14">
				<div className="self-center">
					<p className="font-medium text-sm text-teal-700">
						{hostLabel} broker onboarding
					</p>
					<h1 className="mt-4 max-w-3xl font-semibold text-4xl tracking-normal md:text-6xl">
						Build your verified broker workspace with FairLend.
					</h1>
					<p className="mt-5 max-w-2xl text-lg text-stone-600">
						Get verified, preview your branded portal, and move into a
						production broker dashboard without a manual back-and-forth setup
						process.
					</p>
					<div className="mt-7 flex flex-wrap gap-3">
						<Button asChild size="lg">
							<a href={authHref("sign-up", search)}>
								Start onboarding
								<ArrowRight className="size-4" />
							</a>
						</Button>
						<Button asChild size="lg" variant="outline">
							<a href={authHref("sign-in", search)}>Resume application</a>
						</Button>
					</div>
				</div>
				<div className="rounded-lg border bg-white p-5 shadow-sm">
					<div className="rounded-md bg-teal-950 p-5 text-white">
						<div className="flex items-center gap-2 text-sm text-teal-100">
							<Building2 className="size-4" />
							Branded portal preview
						</div>
						<p className="mt-4 font-semibold text-3xl tracking-normal">
							{hostLabel.toLowerCase()}.fairlend.ca
						</p>
						<p className="mt-3 text-sm text-teal-50/80">
							Portal namespace is only reserved after verification and review.
						</p>
					</div>
					<div className="mt-5 grid gap-3">
						{[
							"WorkOS authentication before real data entry",
							"Regulator and IDV evidence normalized on the server",
							"Submitted and corrections states resume from the application record",
						].map((item) => (
							<div className="flex items-start gap-3" key={item}>
								<CheckCircle2 className="mt-0.5 size-4 text-teal-700" />
								<p className="text-sm text-stone-700">{item}</p>
							</div>
						))}
					</div>
					<div className="mt-5 flex items-start gap-3 rounded-md border bg-stone-50 p-3 text-sm">
						<ShieldCheck className="mt-0.5 size-4 text-teal-700" />
						<p className="text-stone-600">
							Referral context stays on the route through sign-in, resume, and
							submission.
						</p>
					</div>
				</div>
			</section>
		</main>
	);
}
