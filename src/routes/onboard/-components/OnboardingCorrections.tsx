import { AlertTriangle, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	type AppendBrokerNoteFn,
	type BrokerOnboardingReadModel,
	getFieldLabel,
	getLatestReviewerEntry,
	getOpenReopenedFields,
	getReverificationCopy,
	type SaveDraftArgs,
	type SaveDraftFn,
	type SubmitFn,
} from "../-lib/viewModel";
import { ReviewThreadComposer } from "./ReviewThreadComposer";

interface OnboardingCorrectionsProps {
	appendBrokerNote: AppendBrokerNoteFn;
	readModel: BrokerOnboardingReadModel;
	saveDraft: SaveDraftFn;
	submit: SubmitFn;
}

function valueForField(
	readModel: BrokerOnboardingReadModel,
	fieldPath: string
) {
	const draft = readModel.application.draftData;
	switch (fieldPath) {
		case "draftData.selfReportedName":
		case "draftData.selfReportedName.fullName":
			return draft.selfReportedName?.fullName ?? "";
		case "draftData.brokerageName":
			return draft.brokerageName ?? "";
		case "draftData.brokerageNumber":
			return draft.brokerageNumber ?? "";
		case "draftData.businessPhone":
			return draft.businessPhone ?? "";
		case "draftData.licenseNumber":
			return draft.licenseNumber ?? "";
		case "draftData.licenseProvince":
			return draft.licenseProvince ?? "";
		case "draftData.requestedPortalSlug":
			return draft.requestedPortalSlug ?? "";
		default:
			return "";
	}
}

function fieldPatch(
	fieldPath: string,
	value: string
): SaveDraftArgs["draftData"] | null {
	switch (fieldPath) {
		case "draftData.selfReportedName":
		case "draftData.selfReportedName.fullName":
			return { selfReportedName: { fullName: value } };
		case "draftData.brokerageName":
			return { brokerageName: value };
		case "draftData.brokerageNumber":
			return { brokerageNumber: value };
		case "draftData.businessPhone":
			return { businessPhone: value };
		case "draftData.licenseNumber":
			return { licenseNumber: value };
		case "draftData.licenseProvince":
			return { licenseProvince: value };
		case "draftData.requestedPortalSlug":
			return { requestedPortalSlug: value };
		default:
			return null;
	}
}

export function OnboardingCorrections({
	appendBrokerNote,
	readModel,
	saveDraft,
	submit,
}: OnboardingCorrectionsProps) {
	const openFields = getOpenReopenedFields(readModel.application);
	const latestReviewerEntry = getLatestReviewerEntry(readModel);
	const [values, setValues] = useState(() =>
		Object.fromEntries(
			openFields.map((field) => [
				field.fieldPath,
				valueForField(readModel, field.fieldPath),
			])
		)
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleResubmit() {
		setIsSubmitting(true);
		setError(null);
		try {
			const draftData: SaveDraftArgs["draftData"] = {};
			for (const field of openFields) {
				const patch = fieldPatch(
					field.fieldPath,
					values[field.fieldPath] ?? ""
				);
				if (!patch) {
					setError(
						`Cannot resubmit until FairLend maps "${getFieldLabel(field.fieldPath)}" to an editable onboarding field.`
					);
					return;
				}
				Object.assign(draftData, patch);
			}
			await saveDraft({
				applicationId: readModel.application._id,
				currentStep: "submit",
				draftData,
			});
			await submit({ applicationId: readModel.application._id });
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Could not resubmit");
		} finally {
			setIsSubmitting(false);
		}
	}

	if (readModel.isExpired) {
		return (
			<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-8 text-stone-950">
				<section className="mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm">
					<AlertTriangle className="size-5 text-amber-700" />
					<h1 className="mt-3 font-semibold text-3xl tracking-normal">
						This onboarding application expired.
					</h1>
					<p className="mt-3 text-stone-600">
						The 30-day resume window closed. Start a fresh broker onboarding
						application to continue.
					</p>
				</section>
			</main>
		);
	}

	return (
		<main className="min-h-[calc(100vh-4rem)] bg-stone-50 px-4 py-8 text-stone-950">
			<div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_380px]">
				<section className="rounded-lg border bg-white p-6 shadow-sm">
					<p className="font-medium text-amber-700 text-sm">
						Changes requested
					</p>
					<h1 className="mt-2 font-semibold text-4xl tracking-normal">
						Update only the fields FairLend reopened.
					</h1>
					{latestReviewerEntry ? (
						<div className="mt-5 rounded-md border bg-amber-50 p-4">
							<p className="font-medium text-sm">Reviewer note</p>
							<p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
								{latestReviewerEntry.body}
							</p>
						</div>
					) : null}
					<p className="mt-4 text-sm text-stone-600">
						{getReverificationCopy(readModel.application)}
					</p>

					<div className="mt-6 grid gap-4">
						{openFields.length === 0 ? (
							<p className="rounded-md border bg-stone-50 p-3 text-sm text-stone-600">
								No structured reopened fields were provided. Add a broker note
								for the reviewer before resubmitting.
							</p>
						) : (
							openFields.map((field) => (
								<div className="grid gap-2" key={field.fieldPath}>
									<Label htmlFor={field.fieldPath}>
										{getFieldLabel(field.fieldPath)}
									</Label>
									<Input
										id={field.fieldPath}
										onChange={(event) =>
											setValues((current) => ({
												...current,
												[field.fieldPath]: event.target.value,
											}))
										}
										value={values[field.fieldPath] ?? ""}
									/>
									{field.reason ? (
										<p className="text-stone-500 text-xs">{field.reason}</p>
									) : null}
								</div>
							))
						)}
					</div>

					<div className="mt-6 flex flex-wrap items-center gap-3">
						<Button
							disabled={isSubmitting}
							onClick={() => void handleResubmit()}
						>
							<RotateCcw className="size-4" />
							{isSubmitting ? "Resubmitting..." : "Resubmit corrections"}
						</Button>
						{error ? <p className="text-destructive text-sm">{error}</p> : null}
					</div>
				</section>

				<ReviewThreadComposer
					appendBrokerNote={appendBrokerNote}
					readModel={readModel}
				/>
			</div>
		</main>
	);
}
