import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Separator } from "#/components/ui/separator";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { ScheduleReplacementControls } from "./ScheduleReplacementControls";
import { ScheduleReplacementPadUpload } from "./ScheduleReplacementPadUpload";
import {
	type ScheduleReplacementPreviewRowView,
	ScheduleReplacementPreviewTable,
} from "./ScheduleReplacementPreviewTable";
import {
	formatPaymentScheduleDate,
	formatPaymentScheduleMoney,
	type replacementRailLabels,
} from "./types";

type ReplacementRail = keyof typeof replacementRailLabels;
type ReplacementFrequency =
	| "accelerated_bi_weekly"
	| "bi_weekly"
	| "monthly"
	| "weekly";

interface DraftView {
	bankAccountId?: Id<"bankAccounts">;
	interestPaymentAmount: number;
	lastError?: string;
	padAuthorizationAssetId?: Id<"documentAssets">;
	paymentFrequency: ReplacementFrequency;
	previewRows: ScheduleReplacementPreviewRowView[];
	replacementRail: ReplacementRail;
	sliderBounds: {
		maxInterestPaymentAmount: number;
		maxInterestRows: number;
		minInterestPaymentAmount: number;
		step: number;
	};
	startDate: number;
	status:
		| "draft"
		| "ready"
		| "activating"
		| "activated"
		| "activation_failed"
		| "cancelled";
	validationIssues: Array<{ code: string; message: string; rowKey?: string }>;
}

type DraftPatch = Partial<
	Pick<
		DraftView,
		| "bankAccountId"
		| "interestPaymentAmount"
		| "padAuthorizationAssetId"
		| "paymentFrequency"
		| "replacementRail"
		| "startDate"
	>
>;

interface ScheduleReplacementDialogProps {
	mortgageId: Id<"mortgages"> | null;
	onOpenChange: (open: boolean) => void;
	open: boolean;
}

function previewRowsForDisplay(args: {
	archiveRows?: ScheduleReplacementPreviewRowView[];
	contextRows?: ScheduleReplacementPreviewRowView[];
	draft: DraftView;
	hasPersistedDraft: boolean;
}) {
	if (args.hasPersistedDraft) {
		return args.draft.previewRows;
	}

	return [
		...(args.contextRows ?? []),
		...(args.archiveRows ?? []),
		...args.draft.previewRows,
	];
}

export function ScheduleReplacementDialog({
	mortgageId,
	onOpenChange,
	open,
}: ScheduleReplacementDialogProps) {
	const context = useQuery(
		api.payments.scheduleReplacement.drafts.getScheduleReplacementContext,
		mortgageId && open ? { mortgageId } : "skip"
	);
	const createOrUpdateDraft = useMutation(
		api.payments.scheduleReplacement.drafts
			.createOrUpdateScheduleReplacementDraft
	);
	const adjustDraftRowDate = useMutation(
		api.payments.scheduleReplacement.drafts.adjustDraftRowDate
	);
	const applyDraft = useAction(
		api.payments.scheduleReplacement.apply.applyScheduleReplacementDraft
	);
	const generateUploadUrl = useMutation(api.documents.assets.generateUploadUrl);
	const extractPdfMetadata = useAction(api.documents.assets.extractPdfMetadata);
	const createAsset = useMutation(api.documents.assets.create);
	const [draftId, setDraftId] =
		useState<Id<"paymentScheduleReplacementDrafts"> | null>(null);
	const [applyError, setApplyError] = useState<string | null>(null);
	const [isApplying, setIsApplying] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const pendingSaveRef =
		useRef<Promise<Id<"paymentScheduleReplacementDrafts"> | null> | null>(null);
	const pendingSaveTokenRef = useRef<symbol | null>(null);
	const draft = useQuery(
		api.payments.scheduleReplacement.drafts.getScheduleReplacementDraft,
		draftId ? { draftId } : "skip"
	);

	useEffect(() => {
		if (!open) {
			setDraftId(null);
			setApplyError(null);
			setIsApplying(false);
			setIsSavingDraft(false);
			pendingSaveRef.current = null;
			pendingSaveTokenRef.current = null;
		}
	}, [open]);

	const currentDraft = (draft ??
		context?.suggestedDraft ??
		null) as DraftView | null;
	const minStartDate = useMemo(
		() => context?.minStartDate ?? Date.UTC(2026, 0, 1),
		[context?.minStartDate]
	);
	const previewRows =
		currentDraft && context
			? previewRowsForDisplay({
					archiveRows: context.archiveCandidateRows,
					contextRows: context.previewContextRows,
					draft: currentDraft,
					hasPersistedDraft: draft !== null && draft !== undefined,
				})
			: [];
	const canRetryProviderFailure =
		currentDraft?.status === "activation_failed" &&
		currentDraft.replacementRail === "provider_managed_rotessa";
	const canApply =
		!(isApplying || isSavingDraft) &&
		(currentDraft?.status === "ready" || canRetryProviderFailure) &&
		currentDraft.validationIssues.length === 0;
	const activationFailureMessage =
		currentDraft?.status === "activation_failed"
			? (currentDraft.lastError ??
				"Provider activation failed. Review the provider state and retry the replacement.")
			: null;
	const applyButtonLabel = isApplying
		? canRetryProviderFailure
			? "Retrying"
			: "Applying"
		: canRetryProviderFailure
			? "Retry replacement"
			: "Apply replacement";

	async function saveDraft(patch: DraftPatch = {}) {
		if (!(mortgageId && currentDraft)) {
			return null;
		}
		const nextDraft = {
			...currentDraft,
			...patch,
		};
		const saveToken = Symbol("payment-schedule-replacement-save");
		const savePromise = (async () => {
			try {
				const result = await createOrUpdateDraft({
					bankAccountId: nextDraft.bankAccountId,
					draftId: draftId ?? undefined,
					interestPaymentAmount: nextDraft.interestPaymentAmount,
					mortgageId,
					padAuthorizationAssetId: nextDraft.padAuthorizationAssetId,
					paymentFrequency: nextDraft.paymentFrequency,
					replacementRail: nextDraft.replacementRail,
					startDate: nextDraft.startDate,
				});
				setDraftId(result.draftId);
				return result.draftId;
			} catch (error) {
				setApplyError(
					error instanceof Error
						? error.message
						: "Payment schedule replacement draft could not be saved."
				);
				return null;
			} finally {
				if (pendingSaveTokenRef.current === saveToken) {
					pendingSaveRef.current = null;
					pendingSaveTokenRef.current = null;
					setIsSavingDraft(false);
				}
			}
		})();
		pendingSaveRef.current = savePromise;
		pendingSaveTokenRef.current = saveToken;
		setIsSavingDraft(true);
		return savePromise;
	}

	async function handleApply() {
		if (!canApply) {
			return;
		}
		setIsApplying(true);
		setApplyError(null);
		try {
			const savedDraftId = pendingSaveRef.current
				? await pendingSaveRef.current
				: null;
			const activeDraftId = savedDraftId ?? draftId ?? (await saveDraft());
			if (!activeDraftId) {
				return;
			}
			const result = await applyDraft({ draftId: activeDraftId });
			if (result.outcome === "rejected") {
				setApplyError(result.reasonDetail);
				return;
			}
			onOpenChange(false);
		} finally {
			setIsApplying(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Replace payment schedule</DialogTitle>
					<DialogDescription className="sr-only">
						Create, review, apply, or retry a mortgage payment schedule
						replacement draft.
					</DialogDescription>
				</DialogHeader>
				{context && currentDraft ? (
					<div className="space-y-6">
						<div className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-4">
							<div>
								<div className="text-muted-foreground">
									Outstanding interest
								</div>
								<div className="font-semibold">
									{formatPaymentScheduleMoney(
										context.outstandingInterestAmount
									)}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground">Principal payoff</div>
								<div className="font-semibold">
									{formatPaymentScheduleMoney(context.principalPayoffAmount)}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground">Deadline</div>
								<div className="font-semibold">
									{formatPaymentScheduleDate(context.deadlineDate)}
								</div>
							</div>
							<div>
								<div className="text-muted-foreground">Current rail</div>
								<div className="font-semibold">{context.currentRailLabel}</div>
							</div>
						</div>

						<ScheduleReplacementControls
							deadlineDate={context.deadlineDate}
							draft={currentDraft}
							eligibleBankAccounts={context.eligibleBankAccounts}
							minStartDate={minStartDate}
							onChange={(patch) => {
								void saveDraft(patch);
							}}
						/>

						{currentDraft.replacementRail === "provider_managed_rotessa" ? (
							<div className="space-y-2">
								<ScheduleReplacementPadUpload
									createAsset={createAsset}
									extractPdfMetadata={extractPdfMetadata}
									generateUploadUrl={generateUploadUrl}
									onUploaded={(padAuthorizationAssetId) => {
										void saveDraft({ padAuthorizationAssetId });
									}}
								/>
								{currentDraft.padAuthorizationAssetId ? (
									<div className="flex items-center gap-2 text-emerald-700 text-sm">
										<CheckCircle2Icon className="size-4" />
										PAD approval uploaded
									</div>
								) : null}
							</div>
						) : null}

						<Separator />
						<ScheduleReplacementPreviewTable
							maxDate={context.deadlineDate}
							minDate={minStartDate}
							onAdjustDate={(row, scheduledDate) => {
								void (async () => {
									const activeDraftId = draftId ?? (await saveDraft());
									if (!activeDraftId) {
										return;
									}
									await adjustDraftRowDate({
										draftId: activeDraftId,
										rowKey: row.rowKey,
										scheduledDate,
									});
								})();
							}}
							rows={previewRows}
						/>

						<div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 text-sm">
							<div className="flex gap-2">
								<AlertTriangleIcon className="mt-0.5 size-4" />
								<div>
									Applying this draft archives old unpaid rows, cancels any
									replaced Rotessa provider schedule when applicable, and
									activates the replacement schedule. Preview generation and
									date adjustments are non-destructive.
								</div>
							</div>
						</div>
						{activationFailureMessage ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
								{activationFailureMessage}
							</div>
						) : null}
						{applyError ? (
							<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
								{applyError}
							</div>
						) : null}
					</div>
				) : (
					<div className="py-12 text-center text-muted-foreground text-sm">
						Loading replacement workspace
					</div>
				)}
				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button disabled={!canApply} onClick={handleApply} type="button">
						{applyButtonLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
