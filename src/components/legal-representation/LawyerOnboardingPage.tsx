import { useMutation } from "convex/react";
import {
	BadgeCheck,
	CheckCircle2,
	FileSignature,
	ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";

type LawyerOnboardingSession = Doc<"lawyerOnboardingSessions">;
type OnboardingStatus = LawyerOnboardingSession["status"];

export const checkpointActions = {
	identity_pending: api.legalRepresentation.onboarding.confirmIdentity,
	lso_pending: api.legalRepresentation.onboarding.submitLsoLicense,
	idv_pending: api.legalRepresentation.onboarding.completeMockIdv,
	engagement_pending:
		api.legalRepresentation.onboarding.acceptRepresentationEngagement,
} as const;

const titles = {
	auth_pending: "Connect your account",
	identity_pending: "Confirm identity",
	lso_pending: "Confirm LSO licence",
	idv_pending: "Confirm identity verification",
	engagement_pending: "Accept representation",
	complete: "Deal access ready",
	blocked: "Onboarding blocked",
	expired: "Onboarding expired",
} as const satisfies Record<OnboardingStatus, string>;

const checkpointOrder = [
	"auth_pending",
	"identity_pending",
	"lso_pending",
	"idv_pending",
	"engagement_pending",
	"complete",
] as const satisfies readonly OnboardingStatus[];

const checkpointDescriptions = {
	auth_pending: "WorkOS account connected",
	identity_pending: "Name and email matched",
	lso_pending: "Licence checked against selected counsel evidence",
	idv_pending: "Identity verification evidence recorded",
	engagement_pending: "Representation engagement accepted",
	complete: "Deal workspace unlocked",
	blocked: "Manual review required",
	expired: "Fresh invitation required",
} as const satisfies Record<OnboardingStatus, string>;

const terminalCopy = {
	blocked:
		"This onboarding session is blocked. Contact the FairLend deal team to remediate the invitation evidence.",
	complete:
		"Your lawyer account has access to the invited deal workspace. Continue from the deal portal.",
	expired:
		"This onboarding session expired. Ask the deal team to issue a fresh lawyer invitation.",
} as const satisfies Partial<Record<OnboardingStatus, string>>;

type ActionableStatus = keyof typeof checkpointActions;

function isActionableStatus(
	status: OnboardingStatus
): status is ActionableStatus {
	return Object.hasOwn(checkpointActions, status);
}

function actionForStatus(status: OnboardingStatus): ActionableStatus | null {
	if (status === "auth_pending") {
		return "identity_pending";
	}
	return isActionableStatus(status) ? status : null;
}

function checkpointState(
	checkpoint: (typeof checkpointOrder)[number],
	status: OnboardingStatus
) {
	if (status === checkpoint) {
		return "current";
	}
	if (status === "blocked" || status === "expired") {
		return "waiting";
	}
	const checkpointIndex = checkpointOrder.indexOf(checkpoint);
	const statusIndex = checkpointOrder.indexOf(
		status as (typeof checkpointOrder)[number]
	);
	return statusIndex > checkpointIndex ? "complete" : "waiting";
}

function formatIdentifier(value: string) {
	return value.replaceAll("_", " ");
}

function checkpointBody(status: OnboardingStatus) {
	if (status === "blocked" || status === "complete" || status === "expired") {
		return terminalCopy[status];
	}
	return checkpointDescriptions[status];
}

export function LawyerOnboardingPage({
	session,
}: {
	readonly session: LawyerOnboardingSession;
}) {
	const [currentSession, setCurrentSession] = useState(session);
	const [barNumber, setBarNumber] = useState("");
	const [jurisdiction, setJurisdiction] = useState("ON");
	const [pendingStatus, setPendingStatus] = useState<OnboardingStatus | null>(
		null
	);
	const [error, setError] = useState<string | null>(null);
	const confirmIdentity = useMutation(checkpointActions.identity_pending);
	const submitLsoLicense = useMutation(checkpointActions.lso_pending);
	const completeMockIdv = useMutation(checkpointActions.idv_pending);
	const acceptRepresentationEngagement = useMutation(
		checkpointActions.engagement_pending
	);
	const status = currentSession.status;
	const actionStatus = actionForStatus(status);
	const title = titles[status];
	const body = checkpointBody(status);
	const isPending = pendingStatus === status;
	const activeStepLabel = useMemo(() => formatIdentifier(status), [status]);

	useEffect(() => {
		setCurrentSession(session);
	}, [session]);

	async function runCheckpointAction() {
		if (!actionStatus) {
			return;
		}
		setError(null);
		setPendingStatus(status);
		try {
			const sessionId = currentSession._id;
			const nextSession =
				actionStatus === "identity_pending"
					? await confirmIdentity({ sessionId })
					: actionStatus === "lso_pending"
						? await submitLsoLicense({
								barNumber,
								jurisdiction,
								sessionId,
							})
						: actionStatus === "idv_pending"
							? await completeMockIdv({ sessionId })
							: await acceptRepresentationEngagement({ sessionId });
			setCurrentSession(nextSession);
		} catch (unknownError) {
			setError(
				unknownError instanceof Error
					? unknownError.message
					: "Onboarding checkpoint failed."
			);
		} finally {
			setPendingStatus(null);
		}
	}

	return (
		<main className="min-h-screen bg-stone-50 text-slate-950">
			<section className="border-slate-200 border-b bg-white">
				<div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-8 md:flex-row md:items-end md:justify-between lg:px-8">
					<div className="max-w-3xl space-y-3">
						<p className="font-semibold text-slate-500 text-xs uppercase tracking-[0.18em]">
							Lawyer onboarding
						</p>
						<h1 className="font-semibold text-3xl tracking-normal md:text-4xl">
							{title}
						</h1>
						<p className="max-w-2xl text-base text-slate-600 leading-7">
							{checkpointDescriptions[status]}
						</p>
					</div>
					<div className="grid grid-cols-2 gap-3 text-sm md:min-w-72">
						<div className="border-slate-200 border-l pl-4">
							<p className="text-slate-500">Session</p>
							<p className="truncate font-medium">
								{String(currentSession._id)}
							</p>
						</div>
						<div className="border-slate-200 border-l pl-4">
							<p className="text-slate-500">Checkpoint</p>
							<p className="font-medium capitalize">{activeStepLabel}</p>
						</div>
					</div>
				</div>
			</section>

			<div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:px-8">
				<aside aria-label="Onboarding checkpoints" className="lg:pt-2">
					<ol className="space-y-2">
						{checkpointOrder.map((checkpoint) => {
							const state = checkpointState(checkpoint, status);
							return (
								<li
									className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-3"
									key={checkpoint}
								>
									<span
										className={
											state === "complete"
												? "mt-0.5 flex size-7 items-center justify-center rounded-full bg-emerald-700 text-white"
												: state === "current"
													? "mt-0.5 flex size-7 items-center justify-center rounded-full border border-slate-950 bg-white text-slate-950"
													: "mt-0.5 flex size-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400"
										}
									>
										<CheckCircle2 aria-hidden="true" className="size-4" />
									</span>
									<div className="min-w-0 pb-4">
										<p className="font-medium text-sm">{titles[checkpoint]}</p>
										<p className="text-slate-500 text-xs leading-5">
											{checkpointDescriptions[checkpoint]}
										</p>
									</div>
								</li>
							);
						})}
					</ol>
				</aside>

				<section className="border border-slate-200 bg-white">
					<div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="space-y-6 p-6 md:p-8">
							<div className="flex items-start gap-4">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white">
									{status === "engagement_pending" ? (
										<FileSignature aria-hidden="true" className="size-5" />
									) : status === "lso_pending" ? (
										<BadgeCheck aria-hidden="true" className="size-5" />
									) : (
										<ShieldCheck aria-hidden="true" className="size-5" />
									)}
								</div>
								<div className="min-w-0 space-y-2">
									<h2 className="font-semibold text-2xl">Current checkpoint</h2>
									<p className="text-slate-600 leading-7">{body}</p>
								</div>
							</div>

							{status === "lso_pending" ? (
								<form
									className="grid gap-4 sm:grid-cols-2"
									onSubmit={(event) => {
										event.preventDefault();
										void runCheckpointAction();
									}}
								>
									<div className="space-y-2">
										<Label htmlFor="bar-number">Bar number</Label>
										<Input
											autoComplete="off"
											id="bar-number"
											onChange={(event) => setBarNumber(event.target.value)}
											placeholder="L12345"
											value={barNumber}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="jurisdiction">Jurisdiction</Label>
										<Input
											autoComplete="off"
											id="jurisdiction"
											onChange={(event) => setJurisdiction(event.target.value)}
											placeholder="ON"
											value={jurisdiction}
										/>
									</div>
									<div className="sm:col-span-2">
										<Button
											disabled={
												isPending ||
												barNumber.trim().length === 0 ||
												jurisdiction.trim().length === 0
											}
											type="submit"
										>
											<BadgeCheck aria-hidden="true" />
											{isPending ? "Confirming LSO licence" : title}
										</Button>
									</div>
								</form>
							) : actionStatus ? (
								<Button
									disabled={isPending}
									onClick={() => void runCheckpointAction()}
									type="button"
								>
									<ShieldCheck aria-hidden="true" />
									{isPending ? "Recording checkpoint" : title}
								</Button>
							) : null}

							{error ? (
								<p className="border border-red-200 bg-red-50 px-3 py-2 text-red-800 text-sm">
									{error}
								</p>
							) : null}
						</div>

						<div className="border-slate-200 border-t bg-slate-50 p-6 md:border-t-0 md:border-l">
							<dl className="space-y-5 text-sm">
								<div>
									<dt className="text-slate-500">Deal</dt>
									<dd className="mt-1 truncate font-medium">
										{String(currentSession.dealId)}
									</dd>
								</div>
								<div>
									<dt className="text-slate-500">Target email</dt>
									<dd className="mt-1 truncate font-medium">
										{currentSession.normalizedTargetEmail ?? "Not recorded"}
									</dd>
								</div>
								<div>
									<dt className="text-slate-500">Return path</dt>
									<dd className="mt-1 truncate font-medium">
										{currentSession.returnPath}
									</dd>
								</div>
							</dl>
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
