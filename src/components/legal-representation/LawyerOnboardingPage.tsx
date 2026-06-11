import { useMutation } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
	ArrowRight,
	BadgeCheck,
	CheckCircle2,
	FileSignature,
	Loader2,
	ShieldCheck,
	UserCheck,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
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
	identity_pending: "Confirm your identity",
	lso_pending: "Verify LSO licence",
	idv_pending: "Identity verification",
	engagement_pending: "Accept representation",
	complete: "You're all set",
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

const stepTransition = {
	duration: 0.35,
	ease: [0.25, 1, 0.5, 1] as const,
};

const contentVariants = {
	hidden: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? 24 : -24,
	}),
	visible: {
		opacity: 1,
		x: 0,
		transition: stepTransition,
	},
	exit: (direction: number) => ({
		opacity: 0,
		x: direction > 0 ? -24 : 24,
		transition: { duration: 0.2, ease: [0.25, 1, 0.5, 1] as const },
	}),
};

const riseInVariants = {
	hidden: { opacity: 0, y: 12 },
	visible: (i: number) => ({
		opacity: 1,
		y: 0,
		transition: {
			delay: i * 0.06,
			duration: 0.5,
			ease: [0.16, 1, 0.3, 1] as const,
		},
	}),
};

const dotVariants = {
	waiting: { scale: 1, backgroundColor: "#ffffff" },
	current: {
		scale: [1, 1.15, 1],
		transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] as const },
	},
	complete: {
		scale: [1, 1.2, 1],
		backgroundColor: "#059669",
		transition: { duration: 0.4, ease: [0.25, 1, 0.5, 1] as const },
	},
};

const checkDrawVariants = {
	hidden: { pathLength: 0, opacity: 0 },
	visible: {
		pathLength: 1,
		opacity: 1,
		transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const },
	},
};

const errorShakeVariants = {
	hidden: { opacity: 0, y: 6, x: 0 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] as const },
	},
	shake: {
		x: [0, -6, 6, -4, 4, -2, 2, 0],
		transition: { duration: 0.4 },
	},
};

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

function isPlatformSession(session: LawyerOnboardingSession) {
	return (
		session.path === "platform_assigned" ||
		session.path === "platform_application"
	);
}

function titleForStatus(
	status: OnboardingStatus,
	session: LawyerOnboardingSession
) {
	if (isPlatformSession(session)) {
		if (status === "engagement_pending") {
			return "Accept platform agreement";
		}
		if (status === "complete") {
			return "Platform access ready";
		}
	}
	return titles[status];
}

function descriptionForStatus(
	status: OnboardingStatus,
	session: LawyerOnboardingSession
) {
	if (isPlatformSession(session)) {
		if (status === "engagement_pending") {
			return "Platform lawyer agreement accepted";
		}
		if (status === "complete") {
			return "Lawyer workspace unlocked";
		}
	}
	return checkpointDescriptions[status];
}

function checkpointBody(
	status: OnboardingStatus,
	session: LawyerOnboardingSession
) {
	if (status === "blocked" || status === "complete" || status === "expired") {
		if (status === "complete" && isPlatformSession(session)) {
			return "Your platform lawyer account is active. Continue from the lawyer workspace.";
		}
		return terminalCopy[status];
	}
	return descriptionForStatus(status, session);
}

function safeInternalPath(path: string | undefined, fallback: string) {
	if (path?.startsWith("/") && !path.startsWith("//")) {
		return path;
	}
	return fallback;
}

function fallbackCompletionPath(session: LawyerOnboardingSession) {
	if (isPlatformSession(session)) {
		return "/lawyer";
	}
	if (session.dealId !== undefined) {
		return `/deals/${String(session.dealId)}`;
	}
	return "/";
}

function completionHrefForSession(session: LawyerOnboardingSession) {
	return safeInternalPath(
		session.nextRoute ?? session.returnPath,
		fallbackCompletionPath(session)
	);
}

function completionActionLabel(session: LawyerOnboardingSession) {
	return isPlatformSession(session)
		? "Go to lawyer workspace"
		: "Go to deal workspace";
}

function CheckpointIcon({ status }: { readonly status: OnboardingStatus }) {
	if (status === "engagement_pending") {
		return <FileSignature aria-hidden="true" className="size-5" />;
	}
	if (status === "lso_pending") {
		return <BadgeCheck aria-hidden="true" className="size-5" />;
	}
	if (status === "identity_pending") {
		return <UserCheck aria-hidden="true" className="size-5" />;
	}
	return <ShieldCheck aria-hidden="true" className="size-5" />;
}

function AnimatedCheckCircle() {
	return (
		<motion.svg
			className="size-3.5"
			fill="none"
			stroke="currentColor"
			strokeLinecap="round"
			strokeLinejoin="round"
			strokeWidth={2.5}
			viewBox="0 0 24 24"
		>
			<motion.path
				animate="visible"
				d="M5 13l4 4L19 7"
				initial="hidden"
				variants={checkDrawVariants}
			/>
		</motion.svg>
	);
}

function CheckpointProgressDot({
	isCurrent,
	state,
}: {
	readonly isCurrent: boolean;
	readonly state: "complete" | "current" | "waiting";
}) {
	const shouldReduceMotion = useReducedMotion();

	if (state === "complete") {
		return (
			<motion.div
				animate={shouldReduceMotion ? undefined : "complete"}
				className="flex size-7 items-center justify-center rounded-full bg-emerald-600 text-white ring-4 ring-white"
				initial={false}
				variants={dotVariants}
			>
				<AnimatedCheckCircle />
			</motion.div>
		);
	}

	if (isCurrent) {
		return (
			<motion.div
				animate={shouldReduceMotion ? undefined : "current"}
				className="flex size-7 items-center justify-center rounded-full border-2 border-slate-900 bg-white text-slate-900 ring-4 ring-white"
				initial={false}
				variants={dotVariants}
			>
				<motion.div
					animate={{ scale: [1, 1.4, 1] }}
					className="size-1.5 rounded-full bg-slate-900"
					transition={
						shouldReduceMotion
							? undefined
							: {
									repeat: Number.POSITIVE_INFINITY,
									duration: 2,
									ease: "easeInOut" as const,
								}
					}
				/>
			</motion.div>
		);
	}

	return (
		<div className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-300 ring-4 ring-white">
			<div className="size-1.5 rounded-full bg-slate-200" />
		</div>
	);
}

function ProgressLine({ status }: { readonly status: OnboardingStatus }) {
	const shouldReduceMotion = useReducedMotion();
	const statusIndex = checkpointOrder.indexOf(
		status as (typeof checkpointOrder)[number]
	);
	const progress = Math.max(
		0,
		Math.min(1, statusIndex / (checkpointOrder.length - 1))
	);

	return (
		<div
			aria-hidden="true"
			className="absolute top-3 left-[0.6875rem] h-[calc(100%-1.5rem)] w-px overflow-hidden bg-slate-100"
		>
			<motion.div
				animate={{ scaleY: progress }}
				className="absolute inset-x-0 top-0 h-full origin-top bg-emerald-500"
				initial={{ scaleY: 0 }}
				transition={
					shouldReduceMotion
						? undefined
						: { duration: 0.6, ease: [0.25, 1, 0.5, 1] }
				}
			/>
		</div>
	);
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
	const [direction, setDirection] = useState(1);
	const errorId = useId();
	const shouldReduceMotion = useReducedMotion();

	const confirmIdentity = useMutation(checkpointActions.identity_pending);
	const submitLsoLicense = useMutation(checkpointActions.lso_pending);
	const completeMockIdv = useMutation(checkpointActions.idv_pending);
	const acceptRepresentationEngagement = useMutation(
		checkpointActions.engagement_pending
	);

	const status = currentSession.status;
	const actionStatus = actionForStatus(status);
	const title = titleForStatus(status, currentSession);
	const body = checkpointBody(status, currentSession);
	const isPending = pendingStatus === status;

	useEffect(() => {
		setCurrentSession(session);
		setError(null);
	}, [session]);

	async function runCheckpointAction() {
		if (!actionStatus) {
			return;
		}
		setError(null);
		setPendingStatus(status);
		try {
			const sessionId = currentSession._id;
			let nextSession: LawyerOnboardingSession;
			if (actionStatus === "identity_pending") {
				nextSession = await confirmIdentity({ sessionId });
			} else if (actionStatus === "lso_pending") {
				nextSession = await submitLsoLicense({
					barNumber,
					jurisdiction,
					sessionId,
				});
			} else if (actionStatus === "idv_pending") {
				nextSession = await completeMockIdv({ sessionId });
			} else {
				nextSession = await acceptRepresentationEngagement({ sessionId });
			}
			setDirection(1);
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

	let checkpointAction: ReactNode = null;
	if (status === "lso_pending") {
		checkpointAction = (
			<motion.form
				animate="visible"
				className="space-y-6"
				custom={direction}
				exit="exit"
				initial="hidden"
				key="lso-form"
				onSubmit={(event) => {
					event.preventDefault();
					void runCheckpointAction();
				}}
				variants={contentVariants}
			>
				<div className="grid gap-5 sm:grid-cols-2">
					<motion.div
						animate="visible"
						className="space-y-2"
						custom={0}
						initial="hidden"
						variants={riseInVariants}
					>
						<Label
							className="font-medium text-slate-700 text-sm"
							htmlFor="bar-number"
						>
							Bar number
						</Label>
						<Input
							autoComplete="off"
							className="h-11 border-slate-200 bg-white px-4 text-base transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
							id="bar-number"
							onChange={(event) => setBarNumber(event.target.value)}
							placeholder="e.g. L12345"
							value={barNumber}
						/>
					</motion.div>
					<motion.div
						animate="visible"
						className="space-y-2"
						custom={1}
						initial="hidden"
						variants={riseInVariants}
					>
						<Label
							className="font-medium text-slate-700 text-sm"
							htmlFor="jurisdiction"
						>
							Jurisdiction
						</Label>
						<Input
							autoComplete="off"
							className="h-11 border-slate-200 bg-white px-4 text-base transition-colors focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
							id="jurisdiction"
							onChange={(event) => setJurisdiction(event.target.value)}
							placeholder="e.g. ON"
							value={jurisdiction}
						/>
					</motion.div>
				</div>

				<motion.div
					animate="visible"
					className="rounded-xl border border-slate-100 bg-slate-50/50 p-5"
					custom={2}
					initial="hidden"
					variants={riseInVariants}
				>
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
							<CheckCircle2 className="size-4" />
						</div>
						<div className="space-y-1">
							<p className="font-medium text-slate-900 text-sm">
								LSO licence check
							</p>
							<p className="text-slate-500 text-sm leading-relaxed">
								Your licence will be verified against the Law Society of Ontario
								registry to confirm good standing.
							</p>
						</div>
					</div>
				</motion.div>

				<motion.div
					animate="visible"
					custom={3}
					initial="hidden"
					variants={riseInVariants}
				>
					<Button
						className="h-11 w-full font-medium text-base"
						disabled={
							isPending ||
							barNumber.trim().length === 0 ||
							jurisdiction.trim().length === 0
						}
						size="lg"
						type="submit"
					>
						{isPending ? (
							<>
								<Loader2
									aria-hidden="true"
									className="mr-2 size-4 animate-spin"
								/>
								Verifying...
							</>
						) : (
							<>
								<BadgeCheck aria-hidden="true" className="mr-2 size-4" />
								Confirm LSO licence
							</>
						)}
					</Button>
				</motion.div>
			</motion.form>
		);
	} else if (actionStatus) {
		checkpointAction = (
			<motion.div
				animate="visible"
				custom={direction}
				exit="exit"
				initial="hidden"
				key={status}
				variants={contentVariants}
			>
				<Button
					className="h-11 font-medium text-base"
					disabled={isPending}
					onClick={() => void runCheckpointAction()}
					size="lg"
					type="button"
				>
					{isPending ? (
						<>
							<Loader2
								aria-hidden="true"
								className="mr-2 size-4 animate-spin"
							/>
							Processing...
						</>
					) : (
						<>
							<ShieldCheck aria-hidden="true" className="mr-2 size-4" />
							{title}
						</>
					)}
				</Button>
			</motion.div>
		);
	} else if (status === "complete") {
		checkpointAction = (
			<motion.div
				animate="visible"
				custom={direction}
				exit="exit"
				initial="hidden"
				key="complete"
				variants={contentVariants}
			>
				<Button
					asChild
					className="h-11 w-full font-medium text-base sm:w-auto"
					size="lg"
				>
					<a href={completionHrefForSession(currentSession)}>
						{completionActionLabel(currentSession)}
						<ArrowRight aria-hidden="true" className="ml-1 size-4" />
					</a>
				</Button>
			</motion.div>
		);
	}

	const headerStepIndex = Math.max(
		1,
		checkpointOrder.indexOf(status as (typeof checkpointOrder)[number]) + 1
	);

	return (
		<main className="min-h-screen bg-white">
			{/* Top header bar */}
			<motion.header
				animate={{ opacity: 1, y: 0 }}
				className="border-slate-100 border-b"
				initial={{ opacity: 0, y: -12 }}
				transition={
					shouldReduceMotion
						? { duration: 0 }
						: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
				}
			>
				<div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
					<div className="flex items-center gap-2.5">
						<div className="flex size-8 items-center justify-center rounded-lg bg-slate-950 text-white">
							<ShieldCheck className="size-4" />
						</div>
						<span className="font-semibold text-slate-900 text-sm">
							FairLend
						</span>
					</div>
					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="text-slate-400 text-sm"
						initial={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
						key={headerStepIndex}
						transition={{ duration: 0.3 }}
					>
						Step{" "}
						<span className="font-medium text-slate-700">
							{headerStepIndex}
						</span>{" "}
						/ {checkpointOrder.length}
					</motion.div>
				</div>
			</motion.header>

			<div className="mx-auto grid max-w-5xl gap-0 lg:grid-cols-[280px_1fr] lg:gap-12">
				{/* Left sidebar — progress */}
				<aside className="border-slate-100 border-b px-6 py-8 lg:border-r lg:border-b-0 lg:py-12">
					<div className="lg:sticky lg:top-8">
						<motion.p
							animate={{ opacity: 1 }}
							className="mb-6 font-medium text-slate-400 text-xs uppercase tracking-widest"
							initial={{ opacity: 0 }}
							transition={{ delay: 0.15, duration: 0.4 }}
						>
							Onboarding progress
						</motion.p>
						<ol className="relative space-y-0">
							<ProgressLine status={status} />
							{checkpointOrder.map((checkpoint, index) => {
								const state = checkpointState(checkpoint, status);
								const isCurrent = state === "current";
								return (
									<motion.li
										animate={{ opacity: 1, x: 0 }}
										className="relative grid grid-cols-[2.25rem_1fr] items-start gap-3 pb-8 last:pb-0"
										initial={{ opacity: 0, x: -8 }}
										key={checkpoint}
										transition={
											shouldReduceMotion
												? undefined
												: {
														delay: 0.2 + index * 0.06,
														duration: 0.4,
														ease: [0.16, 1, 0.3, 1],
													}
										}
									>
										<div className="relative z-10">
											<CheckpointProgressDot
												isCurrent={isCurrent}
												state={state}
											/>
										</div>
										<motion.div
											animate={
												isCurrent && !shouldReduceMotion
													? { opacity: 1 }
													: undefined
											}
											className={`min-w-0 pt-0.5 ${
												state === "waiting" && !isCurrent ? "opacity-45" : ""
											}`}
										>
											<p
												className={`font-medium text-sm ${
													isCurrent ? "text-slate-900" : "text-slate-600"
												}`}
											>
												{titleForStatus(checkpoint, currentSession)}
											</p>
											<p className="mt-0.5 text-slate-400 text-xs leading-relaxed">
												{descriptionForStatus(checkpoint, currentSession)}
											</p>
										</motion.div>
									</motion.li>
								);
							})}
						</ol>
					</div>
				</aside>

				{/* Main content area */}
				<section className="px-6 py-8 lg:py-12">
					<div className="mx-auto max-w-lg">
						{/* Checkpoint header */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="mb-8 flex items-start gap-4"
							initial={{ opacity: 0, y: 16 }}
							transition={
								shouldReduceMotion
									? undefined
									: { delay: 0.15, duration: 0.5, ease: [0.16, 1, 0.3, 1] }
							}
						>
							<motion.div
								animate={{ scale: 1, opacity: 1 }}
								className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm"
								initial={
									shouldReduceMotion ? undefined : { scale: 0.85, opacity: 0 }
								}
								key={status}
								transition={{ duration: 0.35, ease: [0.25, 1, 0.5, 1] }}
							>
								<CheckpointIcon status={status} />
							</motion.div>
							<div className="min-w-0 space-y-1 pt-0.5">
								<AnimatePresence initial={false} mode="wait">
									<motion.h1
										animate={{ opacity: 1, y: 0 }}
										className="font-semibold text-slate-900 text-xl tracking-tight"
										exit={{ opacity: 0, y: -4 }}
										initial={
											shouldReduceMotion ? undefined : { opacity: 0, y: 6 }
										}
										key={title}
										transition={stepTransition}
									>
										{title}
									</motion.h1>
								</AnimatePresence>
								<AnimatePresence initial={false} mode="wait">
									<motion.p
										animate={{ opacity: 1, y: 0 }}
										className="text-slate-500 text-sm leading-relaxed"
										exit={{ opacity: 0 }}
										initial={
											shouldReduceMotion ? undefined : { opacity: 0, y: 4 }
										}
										key={body}
										transition={{
											...stepTransition,
											delay: 0.05,
										}}
									>
										{body}
									</motion.p>
								</AnimatePresence>
							</div>
						</motion.div>

						{/* Action area */}
						<div className="space-y-5">
							<AnimatePresence initial={false} mode="wait">
								{checkpointAction}
							</AnimatePresence>

							<AnimatePresence>
								{error ? (
									<motion.div
										animate="shake"
										aria-live="assertive"
										className="rounded-lg border border-red-200 bg-red-50 px-4 py-3"
										exit="hidden"
										id={errorId}
										initial="hidden"
										variants={errorShakeVariants}
									>
										<p className="text-red-700 text-sm">{error}</p>
									</motion.div>
								) : null}
							</AnimatePresence>
						</div>

						{/* Context metadata — subtle footer */}
						<motion.div
							animate={{ opacity: 1 }}
							className="mt-12 border-slate-100 border-t pt-6"
							initial={{ opacity: 0 }}
							transition={
								shouldReduceMotion ? undefined : { delay: 0.5, duration: 0.5 }
							}
						>
							<dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
								<div>
									<dt className="text-slate-400">Session</dt>
									<dd className="mt-1 truncate font-medium text-slate-600">
										{String(currentSession._id).slice(0, 8)}...
									</dd>
								</div>
								<div>
									<dt className="text-slate-400">Path</dt>
									<dd className="mt-1 truncate font-medium text-slate-600">
										{currentSession.path}
									</dd>
								</div>
								<div>
									<dt className="text-slate-400">Status</dt>
									<dd className="mt-1 truncate font-medium text-slate-600">
										{currentSession.status}
									</dd>
								</div>
							</dl>
						</motion.div>
					</div>
				</section>
			</div>
		</main>
	);
}
