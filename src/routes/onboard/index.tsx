import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { Button } from "#/components/ui/button";
import { useAppAuth } from "#/hooks/use-app-auth";
import { hasPermission } from "#/lib/auth";
import { api } from "../../../convex/_generated/api";
import { Route as RootRoute } from "../__root";
import { OnboardingCorrections } from "./-components/OnboardingCorrections";
import { OnboardingIntro } from "./-components/OnboardingIntro";
import { OnboardingStatusPage } from "./-components/OnboardingStatusPage";
import { OnboardingWizard } from "./-components/OnboardingWizard";
import {
	buildReferralMutationArgs,
	parseOnboardingSearch,
} from "./-lib/referral";

export const Route = createFileRoute("/onboard/")({
	component: OnboardRoutePage,
	validateSearch: (search: Record<string, unknown>) =>
		parseOnboardingSearch(search),
});

export function OnboardRoutePage() {
	const auth = useAppAuth();
	const search = Route.useSearch();
	const { portalContext } = RootRoute.useRouteContext();
	const [isStarting, setIsStarting] = useState(false);
	const canUseOnboarding = hasPermission(auth.permissions, "onboarding:access");
	const readModel = useQuery(
		api.onboarding.brokerApplication.queries.getCurrent,
		auth.user && canUseOnboarding ? {} : "skip"
	);
	const startOrResume = useMutation(
		api.onboarding.brokerApplication.mutations.startOrResume
	);
	const saveDraft = useMutation(
		api.onboarding.brokerApplication.mutations.saveDraft
	);
	const submit = useMutation(api.onboarding.brokerApplication.mutations.submit);
	const appendBrokerNote = useMutation(
		api.onboarding.brokerApplication.mutations.appendBrokerNote
	);
	const startIdentityVerification = useAction(
		api.onboarding.verification.actions
			.startBrokerOnboardingIdentityVerification
	);
	const activePortalId =
		portalContext.kind === "portal" ? portalContext.portal.portalId : undefined;

	async function handleStartOrResume() {
		setIsStarting(true);
		try {
			await startOrResume(
				buildReferralMutationArgs(search, activePortalId as string | undefined)
			);
		} finally {
			setIsStarting(false);
		}
	}

	if (auth.loading) {
		return <AppRoutePendingScreen />;
	}

	if (!auth.user) {
		return <OnboardingIntro portalContext={portalContext} search={search} />;
	}

	if (!canUseOnboarding) {
		return <OnboardingAccessPending />;
	}

	if (readModel === undefined) {
		return <AppRoutePendingScreen />;
	}

	if (readModel === null) {
		return (
			<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-10 text-stone-950">
				<section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
					<div>
						<p className="font-medium text-sm text-teal-700">Authenticated</p>
						<h1 className="mt-3 max-w-2xl font-semibold text-4xl tracking-normal">
							Start your broker onboarding workspace
						</h1>
						<p className="mt-4 max-w-xl text-stone-600">
							We will create a server-backed application record, preserve the
							entry context, and resume you here if you come back later.
						</p>
						<Button
							className="mt-6"
							disabled={isStarting}
							onClick={() => void handleStartOrResume()}
						>
							{isStarting ? "Starting..." : "Start onboarding"}
						</Button>
					</div>
					<div className="rounded-lg border bg-white p-5 shadow-sm">
						<h2 className="font-semibold text-lg">What happens next</h2>
						<ul className="mt-4 space-y-3 text-sm text-stone-600">
							<li>Profile and licensing details are saved as draft data.</li>
							<li>Verification evidence is normalized by the backend.</li>
							<li>
								Review and activation stay tied to the application record.
							</li>
						</ul>
					</div>
				</section>
			</main>
		);
	}

	if (
		readModel.isExpired ||
		readModel.application.status === "changes_requested"
	) {
		return (
			<OnboardingCorrections
				appendBrokerNote={appendBrokerNote}
				readModel={readModel}
				saveDraft={saveDraft}
				submit={submit}
			/>
		);
	}

	if (readModel.application.status === "draft") {
		return (
			<OnboardingWizard
				readModel={readModel}
				saveDraft={saveDraft}
				startIdentityVerification={startIdentityVerification}
				submit={submit}
			/>
		);
	}

	return (
		<OnboardingStatusPage
			appendBrokerNote={appendBrokerNote}
			readModel={readModel}
		/>
	);
}

function OnboardingAccessPending() {
	return (
		<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-10 text-stone-950">
			<section className="mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
				<p className="font-medium text-amber-700 text-sm">Access pending</p>
				<h1 className="mt-2 font-semibold text-3xl tracking-normal">
					Your WorkOS session is active, but onboarding access is not enabled.
				</h1>
				<p className="mt-4 text-stone-600">
					This route uses the existing WorkOS permission boundary for broker
					onboarding. Ask FairLend support to refresh your organization access,
					then return to this page.
				</p>
			</section>
		</main>
	);
}
