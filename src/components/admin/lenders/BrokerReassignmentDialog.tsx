"use client";

import { useAction, useQuery } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "#/components/ui/badge";
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
import type { Id } from "../../../../convex/_generated/dataModel";
import type {
	BrokerReassignmentPartySummary,
	BrokerReassignmentPreview,
} from "../../../../convex/admin/lenders/reassignmentTypes";

interface BrokerReassignmentDialogProps {
	readonly currentBrokerId: Id<"brokers">;
	readonly currentOrgId?: string;
	readonly lenderId: Id<"lenders">;
	readonly onOpenChange: (open: boolean) => void;
	readonly open: boolean;
}

interface ReassignBrokerResult {
	readonly attemptId: Id<"lenderBrokerReassignmentAttempts">;
	readonly targetBrokerId: Id<"brokers">;
	readonly targetOrgId: string;
	readonly targetPortalHost: string;
	readonly targetPortalId: Id<"portals">;
}

// Temporary codegen-blocked workaround. Replace with generated `api.*` refs
// after `bunx convex codegen` can run in this worktree.
const searchActiveBrokerTargetsRef = makeFunctionReference<
	"query",
	{ search?: string },
	BrokerReassignmentPartySummary[]
>("admin/lenders/reassignment:searchActiveBrokerTargets");

const previewBrokerReassignmentRef = makeFunctionReference<
	"query",
	{ lenderId: Id<"lenders">; targetBrokerId: Id<"brokers"> },
	BrokerReassignmentPreview
>("admin/lenders/reassignment:previewBrokerReassignment");

const reassignBrokerRef = makeFunctionReference<
	"action",
	{
		expectedCurrentBrokerId: Id<"brokers">;
		expectedCurrentOrgId?: string;
		lenderId: Id<"lenders">;
		targetBrokerId: Id<"brokers">;
	},
	ReassignBrokerResult
>("admin/lenders/reassignment:reassignBroker");

function describeError(error: unknown) {
	return error instanceof Error
		? error.message
		: "Unable to reassign lender broker";
}

function formatPortalHost(
	portal: BrokerReassignmentPartySummary["portal"],
	fallback: string
) {
	return portal?.host ?? fallback;
}

function TargetRow({
	onSelect,
	selected,
	target,
}: {
	readonly onSelect: () => void;
	readonly selected: boolean;
	readonly target: BrokerReassignmentPartySummary;
}) {
	return (
		<button
			aria-pressed={selected}
			className="flex w-full items-start justify-between gap-3 border-border border-b p-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 aria-pressed:bg-muted"
			onClick={onSelect}
			type="button"
		>
			<span className="min-w-0 space-y-1">
				<span className="block truncate font-medium text-sm">
					{target.displayName}
				</span>
				<span className="block break-all text-muted-foreground text-xs">
					{target.orgId} • {formatPortalHost(target.portal, "No active portal")}
				</span>
			</span>
			<Badge
				className="capitalize"
				variant={target.status === "active" ? "default" : "secondary"}
			>
				{target.status}
			</Badge>
		</button>
	);
}

export function BrokerReassignmentDialog({
	currentBrokerId,
	currentOrgId,
	lenderId,
	onOpenChange,
	open,
}: BrokerReassignmentDialogProps) {
	const [search, setSearch] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [targetBrokerId, setTargetBrokerId] = useState<Id<"brokers"> | null>(
		null
	);
	const targets = useQuery(
		searchActiveBrokerTargetsRef,
		open ? { search } : "skip"
	);
	const preview = useQuery(
		previewBrokerReassignmentRef,
		open && targetBrokerId ? { lenderId, targetBrokerId } : "skip"
	);
	const reassignBroker = useAction(reassignBrokerRef);
	const blockingReasons = preview?.blockingReasons ?? [];
	const canSubmit =
		Boolean(targetBrokerId && preview) &&
		blockingReasons.length === 0 &&
		!submitting;

	useEffect(() => {
		if (!open) {
			setSearch("");
			setSubmitting(false);
			setTargetBrokerId(null);
		}
	}, [open]);

	function handleSearchChange(value: string) {
		setSearch(value);
		setTargetBrokerId(null);
	}

	async function submitReassignment() {
		if (!(targetBrokerId && preview)) {
			return;
		}

		setSubmitting(true);
		try {
			await reassignBroker({
				expectedCurrentBrokerId: currentBrokerId,
				expectedCurrentOrgId: currentOrgId,
				lenderId,
				targetBrokerId,
			});
			toast.success("Lender broker reassigned");
			onOpenChange(false);
		} catch (error) {
			toast.error(describeError(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>Change broker</DialogTitle>
					<DialogDescription>
						Move this lender to another active broker and verify the portal
						access transition before applying the change.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							aria-label="Search active brokers"
							className="pl-9"
							onChange={(event) => handleSearchChange(event.target.value)}
							placeholder="Search active brokers"
							value={search}
						/>
					</div>

					<div className="max-h-56 overflow-y-auto rounded-md border">
						{targets === undefined ? (
							<p className="p-3 text-muted-foreground text-sm">
								Loading brokers...
							</p>
						) : targets.length > 0 ? (
							targets.map((target) => (
								<TargetRow
									key={String(target.brokerId)}
									onSelect={() => setTargetBrokerId(target.brokerId)}
									selected={target.brokerId === targetBrokerId}
									target={target}
								/>
							))
						) : (
							<p className="p-3 text-muted-foreground text-sm">
								No active brokers found.
							</p>
						)}
					</div>

					{preview ? (
						<div className="space-y-4 rounded-md border bg-muted/20 p-4">
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="space-y-1">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										Current access host
									</p>
									<p className="break-all font-medium text-sm">
										{formatPortalHost(
											preview.current.portal,
											"No active portal"
										)}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-muted-foreground text-xs uppercase tracking-[0.08em]">
										New access host
									</p>
									<p className="break-all font-medium text-sm">
										{formatPortalHost(
											preview.target.portal,
											"No active portal"
										)}
									</p>
									{preview.target.portal?.willEnsure ? (
										<p className="text-muted-foreground text-xs">
											Portal will be ensured during reassignment.
										</p>
									) : null}
								</div>
							</div>

							<p className="text-muted-foreground text-sm">
								Confirming moves the lender's WorkOS membership to the target
								broker organization. Existing deals, mortgages, ledger entries,
								portfolio positions, and audit history stay unchanged.
							</p>

							{blockingReasons.length > 0 ? (
								<div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
									<p className="font-medium text-destructive text-sm">
										Reassignment is blocked
									</p>
									<ul className="space-y-1 text-destructive text-sm">
										{blockingReasons.map((reason) => (
											<li key={reason}>{reason}</li>
										))}
									</ul>
								</div>
							) : null}
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button
						onClick={() => onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Cancel
					</Button>
					<Button
						disabled={!canSubmit}
						onClick={submitReassignment}
						type="button"
					>
						{submitting ? "Reassigning..." : "Confirm reassignment"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
