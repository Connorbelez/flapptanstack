"use client";

import { useMutation } from "convex/react";
import { CalendarClock, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
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
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Textarea } from "#/components/ui/textarea";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { AdminDealOperationAction } from "../../../../convex/deals/queries";

interface DealOperationActionControlsProps {
	readonly actions: readonly AdminDealOperationAction[];
	readonly dealId: Id<"deals">;
	readonly mode?: "compact" | "full";
}

function actionTitle(action: AdminDealOperationAction) {
	if (action.payloadKind === "closing_date") {
		return "Lock deal";
	}
	if (action.payloadKind === "verification_id") {
		return "Verify lawyer";
	}
	if (action.payloadKind === "manual_funds") {
		return "Confirm funds received";
	}
	if (action.payloadKind === "cancel_reason") {
		return "Cancel deal";
	}
	return action.label;
}

export function DealOperationActionControls({
	actions,
	dealId,
	mode = "compact",
}: DealOperationActionControlsProps) {
	const transitionDeal = useMutation(api.deals.mutations.transitionDeal);
	const confirmManualFundsReceipt = useMutation(
		api.deals.mutations.confirmManualFundsReceipt
	);
	const [activeAction, setActiveAction] =
		useState<AdminDealOperationAction | null>(null);
	const [closingDate, setClosingDate] = useState("");
	const [verificationId, setVerificationId] = useState("");
	const [evidenceNote, setEvidenceNote] = useState("");
	const [cancelReason, setCancelReason] = useState("");
	const [submitting, setSubmitting] = useState(false);

	function resetDialog() {
		setActiveAction(null);
		setClosingDate("");
		setVerificationId("");
		setEvidenceNote("");
		setCancelReason("");
		setSubmitting(false);
	}

	async function submitAction(action: AdminDealOperationAction) {
		setSubmitting(true);
		try {
			if (action.payloadKind === "manual_funds") {
				const note = evidenceNote.trim();
				if (!note) {
					toast.error("Funds evidence note required");
					return;
				}
				const result = await confirmManualFundsReceipt({
					dealId,
					evidenceNote: note,
					receivedAt: Date.now(),
				});
				if (result.success) {
					toast.success("Funds receipt confirmed");
					resetDialog();
					return;
				}
				toast.error(result.reason ?? "Funds confirmation failed");
				return;
			}

			const payload =
				action.payloadKind === "closing_date"
					? { closingDate: new Date(closingDate).getTime() }
					: action.payloadKind === "verification_id"
						? { verificationId: verificationId.trim() }
						: action.payloadKind === "cancel_reason"
							? { reason: cancelReason.trim() }
							: undefined;

			if (action.payloadKind === "closing_date" && !closingDate) {
				toast.error("Closing date required");
				return;
			}
			if (action.payloadKind === "verification_id" && !verificationId.trim()) {
				toast.error("Verification ID required");
				return;
			}
			if (action.payloadKind === "cancel_reason" && !cancelReason.trim()) {
				toast.error("Cancellation reason required");
				return;
			}

			const result = await transitionDeal({
				entityId: dealId,
				eventType: action.event,
				payload,
			});
			if (result.success) {
				toast.success(`${action.label} submitted`);
				resetDialog();
				return;
			}
			toast.error(result.reason ?? "Transition failed");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Action failed");
		} finally {
			setSubmitting(false);
		}
	}

	function openAction(action: AdminDealOperationAction) {
		if (action.disabledReason) {
			return;
		}
		if (!action.requiresPayload) {
			void submitAction(action);
			return;
		}
		setActiveAction(action);
	}

	function isPayloadReady(action: AdminDealOperationAction) {
		if (!action.requiresPayload) {
			return true;
		}
		if (action.payloadKind === "closing_date") {
			return closingDate.length > 0;
		}
		if (action.payloadKind === "verification_id") {
			return verificationId.trim().length > 0;
		}
		if (action.payloadKind === "manual_funds") {
			return evidenceNote.trim().length > 0;
		}
		if (action.payloadKind === "cancel_reason") {
			return cancelReason.trim().length > 0;
		}
		return false;
	}

	const visibleActions = actions.filter((action) => !action.disabledReason);
	const activeActionCanSubmit = activeAction
		? isPayloadReady(activeAction)
		: false;

	return (
		<>
			<div
				className={
					mode === "full" ? "flex flex-wrap gap-2" : "grid grid-cols-1 gap-2"
				}
			>
				{visibleActions.length > 0 ? (
					visibleActions.map((action) => (
						<Button
							key={action.event}
							onClick={() => openAction(action)}
							size="sm"
							type="button"
							variant={
								action.payloadKind === "cancel_reason" ? "outline" : "default"
							}
						>
							{action.payloadKind === "cancel_reason" ? (
								<XCircle className="mr-2 size-4" />
							) : action.payloadKind === "closing_date" ? (
								<CalendarClock className="mr-2 size-4" />
							) : (
								<CheckCircle2 className="mr-2 size-4" />
							)}
							{action.label}
						</Button>
					))
				) : (
					<p className="text-muted-foreground text-sm">
						No governed actions available.
					</p>
				)}
			</div>

			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						resetDialog();
					}
				}}
				open={activeAction !== null}
			>
				<DialogContent className="sm:max-w-md">
					{activeAction ? (
						<>
							<DialogHeader>
								<DialogTitle>{actionTitle(activeAction)}</DialogTitle>
								<DialogDescription>
									This action is submitted through the governed deal transition
									path or a subordinate evidence mutation.
								</DialogDescription>
							</DialogHeader>

							{activeAction.payloadKind === "closing_date" ? (
								<div className="space-y-2">
									<Label htmlFor="deal-closing-date">Closing date</Label>
									<Input
										id="deal-closing-date"
										onChange={(event) => setClosingDate(event.target.value)}
										type="date"
										value={closingDate}
									/>
								</div>
							) : null}

							{activeAction.payloadKind === "verification_id" ? (
								<div className="space-y-2">
									<Label htmlFor="lawyer-verification-id">
										Verification ID
									</Label>
									<Input
										id="lawyer-verification-id"
										onChange={(event) => setVerificationId(event.target.value)}
										placeholder="verification_..."
										value={verificationId}
									/>
								</div>
							) : null}

							{activeAction.payloadKind === "manual_funds" ? (
								<div className="space-y-2">
									<Label htmlFor="funds-evidence-note">Evidence note</Label>
									<Textarea
										className="min-h-[120px]"
										id="funds-evidence-note"
										onChange={(event) => setEvidenceNote(event.target.value)}
										placeholder="Wire receipt, trust account statement, reference number..."
										value={evidenceNote}
									/>
								</div>
							) : null}

							{activeAction.payloadKind === "cancel_reason" ? (
								<div className="space-y-2">
									<Label htmlFor="deal-cancel-reason">
										Cancellation reason
									</Label>
									<Textarea
										className="min-h-[120px]"
										id="deal-cancel-reason"
										onChange={(event) => setCancelReason(event.target.value)}
										placeholder="Explain why this deal is being cancelled..."
										value={cancelReason}
									/>
								</div>
							) : null}

							<DialogFooter>
								<Button
									disabled={submitting || !activeActionCanSubmit}
									onClick={() => submitAction(activeAction)}
								>
									{submitting ? "Submitting" : activeAction.label}
								</Button>
							</DialogFooter>
						</>
					) : null}
				</DialogContent>
			</Dialog>
		</>
	);
}
