"use client";

import { Link } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { Archive, Ban, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import { type FormEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

type DocumentRemediationAction =
	| "open_authoring"
	| "open_mapping"
	| "retry_instance"
	| "refresh_snapshot"
	| "waive_for_deal"
	| "archive_source_blueprint";

type DocumentRemediationEligibility =
	| "remediable_failed_instance"
	| "already_remediated"
	| "not_remediable";

interface DocumentRemediation {
	actions: Array<{
		action: DocumentRemediationAction;
		copy: string;
	}>;
	eligibility: DocumentRemediationEligibility;
	primaryAction: DocumentRemediationAction | null;
	summary: string;
}

export interface DocumentRemediationPanelDocument {
	displayName: string;
	instanceId: Id<"dealDocumentInstances">;
	lastError: string | null;
	mortgageId: Id<"mortgages"> | null;
	remediation: DocumentRemediation | null;
	remediationAction: string | null;
	remediationReason: string | null;
	sourceBlueprintId: Id<"mortgageDocumentBlueprints"> | null;
	status: string;
	supersededByInstanceId: Id<"dealDocumentInstances"> | null;
	templateId: Id<"documentTemplates"> | null;
}

const MIN_WAIVE_REASON_LENGTH = 3;

type PendingAction = "archive" | "refresh" | "retry" | "waive" | null;

function getErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

function hasAction(
	remediation: DocumentRemediation,
	action: DocumentRemediationAction
) {
	return remediation.actions.some((item) => item.action === action);
}

export function DocumentRemediationPanel({
	document,
}: {
	readonly document: DocumentRemediationPanelDocument;
}) {
	const remediation = document.remediation;
	const reasonInputId = useId();
	const retryDocumentInstance = useAction(
		api.documents.dealPackages.retryDealDocumentInstance
	);
	const refreshDocumentSnapshot = useAction(
		api.documents.dealPackages.refreshDealDocumentInstanceSnapshot
	);
	const waiveDocumentInstance = useMutation(
		api.documents.dealPackages.waiveDealDocumentInstance
	);
	const archiveSourceBlueprint = useMutation(
		api.documents.dealPackages.archiveSourceBlueprintForFutureDeals
	);
	const [pendingAction, setPendingAction] = useState<PendingAction>(null);
	const [isWaiveDialogOpen, setIsWaiveDialogOpen] = useState(false);
	const waiveReasonRef = useRef<HTMLTextAreaElement>(null);
	const [reasonError, setReasonError] = useState<string | null>(null);

	if (!remediation || remediation.eligibility === "not_remediable") {
		return null;
	}

	if (remediation.eligibility === "already_remediated") {
		return (
			<div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm">
				<p className="font-medium">
					{document.remediationAction === "waived_for_deal"
						? "Intentionally waived for this deal"
						: remediation.summary}
				</p>
				{document.remediationReason ? (
					<p className="mt-1 text-muted-foreground">
						Reason: {document.remediationReason}
					</p>
				) : null}
				{document.supersededByInstanceId ? (
					<p className="mt-1 text-muted-foreground">
						Replacement: {String(document.supersededByInstanceId)}
					</p>
				) : null}
			</div>
		);
	}

	const canOpenAuthoring =
		remediation.primaryAction === "open_authoring" && document.templateId;
	const canOpenMapping =
		remediation.primaryAction === "open_mapping" && document.mortgageId;
	const canRefreshSnapshot =
		document.sourceBlueprintId && hasAction(remediation, "refresh_snapshot");
	const canArchiveSource =
		document.sourceBlueprintId &&
		hasAction(remediation, "archive_source_blueprint");
	const isBusy = pendingAction !== null;

	async function handleRetry() {
		setPendingAction("retry");
		try {
			await retryDocumentInstance({ instanceId: document.instanceId });
			toast.success("Document retry started.");
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to retry document."));
		} finally {
			setPendingAction(null);
		}
	}

	async function handleRefreshSnapshot() {
		if (!document.sourceBlueprintId) {
			return;
		}

		setPendingAction("refresh");
		try {
			await refreshDocumentSnapshot({ instanceId: document.instanceId });
			toast.success("Document snapshot update started.");
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Unable to update document snapshot.")
			);
		} finally {
			setPendingAction(null);
		}
	}

	async function handleArchiveSourceBlueprint() {
		if (!document.sourceBlueprintId) {
			return;
		}

		setPendingAction("archive");
		try {
			await archiveSourceBlueprint({
				instanceId: document.instanceId,
				sourceBlueprintId: document.sourceBlueprintId,
			});
			toast.success("Source blueprint archived for future deals.");
		} catch (error) {
			toast.error(
				getErrorMessage(error, "Unable to archive source blueprint.")
			);
		} finally {
			setPendingAction(null);
		}
	}

	async function handleWaiveSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const reason = waiveReasonRef.current?.value.trim() ?? "";
		if (reason.length < MIN_WAIVE_REASON_LENGTH) {
			setReasonError("Enter at least 3 characters before waiving.");
			return;
		}

		setReasonError(null);
		setPendingAction("waive");
		try {
			await waiveDocumentInstance({
				instanceId: document.instanceId,
				reason,
			});
			toast.success("Intentionally waived for this deal");
			setIsWaiveDialogOpen(false);
			if (waiveReasonRef.current) {
				waiveReasonRef.current.value = "";
			}
		} catch (error) {
			toast.error(getErrorMessage(error, "Unable to waive document."));
		} finally {
			setPendingAction(null);
		}
	}

	return (
		<div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<p className="min-w-0 flex-1 text-amber-950 text-sm leading-6 dark:text-amber-100">
					{remediation.summary}
				</p>
				<div className="flex flex-wrap justify-end gap-2">
					{canOpenAuthoring ? (
						<Button asChild size="sm" type="button" variant="outline">
							<Link
								params={{ templateId: String(document.templateId) }}
								search={EMPTY_ADMIN_DETAIL_SEARCH}
								to="/admin/document-engine/designer/$templateId"
							>
								<ExternalLink className="size-3.5" />
								Open template
							</Link>
						</Button>
					) : null}
					{canOpenMapping ? (
						<Button asChild size="sm" type="button" variant="outline">
							<Link
								params={{ recordid: String(document.mortgageId) }}
								search={EMPTY_ADMIN_DETAIL_SEARCH}
								to="/admin/mortgages/$recordid"
							>
								<ExternalLink className="size-3.5" />
								Review mapping
							</Link>
						</Button>
					) : null}
					<Button
						disabled={isBusy}
						onClick={() => void handleRetry()}
						size="sm"
						type="button"
						variant="outline"
					>
						<RotateCcw className="size-3.5" />
						Retry document
					</Button>
					{canRefreshSnapshot ? (
						<Button
							disabled={isBusy}
							onClick={() => void handleRefreshSnapshot()}
							size="sm"
							type="button"
							variant="outline"
						>
							<RefreshCw className="size-3.5" />
							Update snapshot
						</Button>
					) : null}
					<Button
						disabled={isBusy}
						onClick={() => {
							setReasonError(null);
							setIsWaiveDialogOpen(true);
						}}
						size="sm"
						type="button"
						variant="outline"
					>
						<Ban className="size-3.5" />
						Remove from this deal
					</Button>
				</div>
			</div>
			{canArchiveSource ? (
				<div className="mt-2 border-border/60 border-t pt-2">
					<Button
						className="text-muted-foreground"
						disabled={isBusy}
						onClick={() => void handleArchiveSourceBlueprint()}
						size="sm"
						type="button"
						variant="ghost"
					>
						<Archive className="size-3.5" />
						Archive source blueprint for future deals
					</Button>
				</div>
			) : null}
			<Dialog onOpenChange={setIsWaiveDialogOpen} open={isWaiveDialogOpen}>
				<DialogContent>
					<form
						className="space-y-4"
						onSubmit={(event) => void handleWaiveSubmit(event)}
					>
						<DialogHeader>
							<DialogTitle>Remove document from this deal</DialogTitle>
							<DialogDescription>
								Why is this document waived for this deal?
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-2">
							<Label htmlFor={reasonInputId}>Waiver reason</Label>
							<Textarea
								id={reasonInputId}
								onChange={() => {
									if (reasonError) {
										setReasonError(null);
									}
								}}
								ref={waiveReasonRef}
							/>
							{reasonError ? (
								<p className="text-destructive text-sm">{reasonError}</p>
							) : null}
						</div>
						<DialogFooter>
							<Button
								disabled={pendingAction === "waive"}
								onClick={() => setIsWaiveDialogOpen(false)}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={pendingAction === "waive"} type="submit">
								Remove from this deal
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
