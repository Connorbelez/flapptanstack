import { PlayCircle, Save, SendHorizonal } from "lucide-react";
import {
	cloneElement,
	isValidElement,
	type ReactNode,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Progress } from "#/components/ui/progress";
import { Textarea } from "#/components/ui/textarea";
import {
	type BrokerOnboardingReadModel,
	getChapterProgress,
	ONBOARDING_CHAPTERS,
	type SaveDraftArgs,
	type SaveDraftFn,
	type StartIdentityVerificationFn,
	type SubmitFn,
} from "../-lib/viewModel";
import { PortalTeaserCard } from "./PortalTeaserCard";

interface OnboardingWizardProps {
	readModel: BrokerOnboardingReadModel;
	saveDraft: SaveDraftFn;
	startIdentityVerification: StartIdentityVerificationFn;
	submit: SubmitFn;
}

interface DraftFormState {
	brokerageName: string;
	brokerageNumber: string;
	businessPhone: string;
	licenseNumber: string;
	licenseProvince: string;
	requestedPortalSlug: string;
	selfReportedFullName: string;
}

function draftToForm(readModel: BrokerOnboardingReadModel): DraftFormState {
	const draft = readModel.application.draftData;
	return {
		brokerageName: draft.brokerageName ?? "",
		brokerageNumber: draft.brokerageNumber ?? "",
		businessPhone: draft.businessPhone ?? "",
		licenseNumber: draft.licenseNumber ?? "",
		licenseProvince: draft.licenseProvince ?? "ON",
		requestedPortalSlug: draft.requestedPortalSlug ?? "",
		selfReportedFullName: draft.selfReportedName?.fullName ?? "",
	};
}

function formToDraftData(form: DraftFormState): SaveDraftArgs["draftData"] {
	return {
		brokerageName: form.brokerageName,
		brokerageNumber: form.brokerageNumber,
		businessPhone: form.businessPhone,
		licenseNumber: form.licenseNumber,
		licenseProvince: form.licenseProvince,
		requestedPortalSlug: form.requestedPortalSlug,
		selfReportedName: { fullName: form.selfReportedFullName },
	};
}

export function OnboardingWizard({
	readModel,
	saveDraft,
	startIdentityVerification,
	submit,
}: OnboardingWizardProps) {
	const applicationId = readModel.application._id;
	const hydratedApplicationIdRef = useRef(applicationId);
	const [form, setForm] = useState(() => draftToForm(readModel));
	const [isSaving, setIsSaving] = useState(false);
	const [isStartingIdv, setIsStartingIdv] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const progress = getChapterProgress(readModel.application);
	const isBusy = isSaving || isStartingIdv || isSubmitting;

	useEffect(() => {
		if (hydratedApplicationIdRef.current === applicationId) {
			return;
		}
		hydratedApplicationIdRef.current = applicationId;
		setForm(draftToForm(readModel));
	}, [applicationId, readModel]);

	function updateField<K extends keyof DraftFormState>(
		field: K,
		value: DraftFormState[K]
	) {
		setForm((current) => ({ ...current, [field]: value }));
	}

	async function handleSave(
		currentStep = progress.activeKey
	): Promise<boolean> {
		if (isBusy) {
			return false;
		}
		setIsSaving(true);
		setError(null);
		setMessage(null);
		try {
			await saveDraft({
				applicationId,
				currentStep,
				draftData: formToDraftData(form),
			});
			setMessage("Draft saved to the application record.");
			return true;
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not save draft"
			);
			return false;
		} finally {
			setIsSaving(false);
		}
	}

	async function handleStartIdentityVerification() {
		if (isBusy) {
			return;
		}
		const didSave = await handleSave("verification");
		if (!didSave) {
			return;
		}
		setIsStartingIdv(true);
		setError(null);
		setMessage(null);
		try {
			const result = await startIdentityVerification({
				applicationId,
			});
			if (result.ok) {
				setMessage(
					result.session.launchUrl
						? `Identity verification session ${result.session.status}.`
						: `Identity verification session ${result.session.status}; provider has no launch URL.`
				);
				return;
			}
			if ("blockedReasonCodes" in result) {
				setError(
					`Verification is blocked: ${result.blockedReasonCodes.join(", ")}`
				);
				return;
			}
			if (result.error === "rate_limited") {
				setError(
					`Verification is rate limited. Retry after ${result.retryAfter}s.`
				);
				return;
			}
			setError("Identity provider is unavailable.");
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "Could not start identity verification"
			);
		} finally {
			setIsStartingIdv(false);
		}
	}

	async function handleSubmit() {
		if (isBusy) {
			return;
		}
		const didSave = await handleSave("submit");
		if (!didSave) {
			return;
		}
		setIsSubmitting(true);
		setError(null);
		setMessage(null);
		try {
			await submit({ applicationId });
			setMessage("Application submitted for review.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not submit");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-8 text-stone-950">
			<div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_1fr]">
				<aside className="h-fit rounded-lg border bg-white p-4 shadow-sm">
					<p className="font-medium text-sm text-teal-700">Broker onboarding</p>
					<h1 className="mt-2 font-semibold text-2xl tracking-normal">
						Chaptered setup
					</h1>
					<Progress className="mt-4" value={progress.percent} />
					<div className="mt-5 space-y-3">
						{ONBOARDING_CHAPTERS.map((chapter, index) => (
							<div
								className={
									index === progress.activeIndex
										? "rounded-md border border-teal-700/30 bg-teal-50 p-3"
										: "rounded-md border bg-stone-50 p-3"
								}
								key={chapter.key}
							>
								<p className="font-medium text-sm">{chapter.label}</p>
								<p className="mt-1 text-stone-500 text-xs">
									{chapter.description}
								</p>
							</div>
						))}
					</div>
				</aside>

				<div className="grid gap-6">
					<section className="rounded-lg border bg-white p-5 shadow-sm">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div>
								<p className="font-medium text-sm text-teal-700">
									Server-backed draft
								</p>
								<h2 className="mt-2 font-semibold text-3xl tracking-normal">
									Brokerage and principal profile
								</h2>
								<p className="mt-2 max-w-2xl text-sm text-stone-600">
									These fields save into `brokerOnboardingApplication`.
									Verification, review, and activation status remain
									server-owned.
								</p>
							</div>
							<Button
								disabled={isBusy}
								onClick={() => void handleSave()}
								variant="outline"
							>
								<Save className="size-4" />
								{isSaving ? "Saving..." : "Save draft"}
							</Button>
						</div>

						<div className="mt-6 grid gap-4 md:grid-cols-2">
							<Field label="Legal full name">
								<Input
									onChange={(event) =>
										updateField("selfReportedFullName", event.target.value)
									}
									value={form.selfReportedFullName}
								/>
							</Field>
							<Field label="Business phone">
								<Input
									onChange={(event) =>
										updateField("businessPhone", event.target.value)
									}
									value={form.businessPhone}
								/>
							</Field>
							<Field label="Brokerage name">
								<Input
									onChange={(event) =>
										updateField("brokerageName", event.target.value)
									}
									value={form.brokerageName}
								/>
							</Field>
							<Field label="Brokerage number">
								<Input
									onChange={(event) =>
										updateField("brokerageNumber", event.target.value)
									}
									value={form.brokerageNumber}
								/>
							</Field>
							<Field label="License number">
								<Input
									onChange={(event) =>
										updateField("licenseNumber", event.target.value)
									}
									value={form.licenseNumber}
								/>
							</Field>
							<Field label="Province">
								<Input
									onChange={(event) =>
										updateField("licenseProvince", event.target.value)
									}
									value={form.licenseProvince}
								/>
							</Field>
						</div>
					</section>

					<PortalTeaserCard
						application={{
							...readModel.application,
							draftData: {
								...readModel.application.draftData,
								requestedPortalSlug: form.requestedPortalSlug,
							},
						}}
						onSlugChange={(slug) => updateField("requestedPortalSlug", slug)}
					/>

					<section className="rounded-lg border bg-white p-5 shadow-sm">
						<h2 className="font-semibold text-xl tracking-normal">
							Verification and submit
						</h2>
						<p className="mt-2 text-sm text-stone-600">
							WorkOS email, regulator evidence, and IDV run through backend
							contracts. The UI never decides review outcomes.
						</p>
						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							<Button
								disabled={isBusy}
								onClick={() => void handleStartIdentityVerification()}
								variant="outline"
							>
								<PlayCircle className="size-4" />
								{isStartingIdv ? "Starting..." : "Start identity verification"}
							</Button>
							<Button disabled={isBusy} onClick={() => void handleSubmit()}>
								<SendHorizonal className="size-4" />
								{isSubmitting ? "Submitting..." : "Submit for review"}
							</Button>
						</div>
						<div className="mt-4 grid gap-2">
							<Label htmlFor="review-notes">Submission context</Label>
							<Textarea
								id="review-notes"
								placeholder="Add any context in the reviewer thread after submission."
								readOnly
							/>
						</div>
						{message ? (
							<p className="mt-4 text-sm text-teal-700">{message}</p>
						) : null}
						{error ? (
							<p className="mt-4 text-destructive text-sm">{error}</p>
						) : null}
					</section>
				</div>
			</div>
		</main>
	);
}

function Field({
	children,
	label,
}: Readonly<{ children: ReactNode; label: string }>) {
	const generatedId = useId();
	const child =
		isValidElement<{ id?: string }>(children) && children.props.id === undefined
			? cloneElement(children, { id: generatedId })
			: children;
	const htmlFor =
		isValidElement<{ id?: string }>(children) && children.props.id
			? children.props.id
			: generatedId;

	return (
		<div className="grid gap-2">
			<Label htmlFor={htmlFor}>{label}</Label>
			{child}
		</div>
	);
}
