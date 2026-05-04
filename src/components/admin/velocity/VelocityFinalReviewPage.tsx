"use client";

import { Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Play,
	ShieldCheck,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useAdminBreadcrumbLabel } from "#/components/admin/shell/AdminPageMetadataContext";
import {
	AdminNotFoundState,
	AdminPageSkeleton,
} from "#/components/admin/shell/AdminRouteStates";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { VelocitySnapshot, VelocityWorkspaceDetail } from "./types";
import {
	isVelocityActivationInFlight,
	VelocityActivationStatusPanel,
} from "./VelocityActivationStatusPanel";

interface VelocityFinalReviewPageProps {
	readonly workspaceId: string;
}

function formatCurrency(value: number | null | undefined) {
	if (value == null) {
		return "Not supplied";
	}
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function formatState(value: string) {
	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function display(value: string | number | null | undefined) {
	if (value == null || value === "") {
		return "Not supplied";
	}
	return String(value);
}

function currentReviewSnapshot(workspace: VelocityWorkspaceDetail) {
	return (
		workspace.snapshots.find(
			(snapshot) =>
				snapshot.normalizedCoreHash ===
					workspace.velocityOwned.normalizedCoreHash &&
				snapshot.snapshotType !== "final_review"
		) ??
		workspace.snapshots.find(
			(snapshot) =>
				snapshot.normalizedCoreHash ===
				workspace.velocityOwned.normalizedCoreHash
		) ??
		null
	);
}

function hasReviewDrift(workspace: VelocityWorkspaceDetail) {
	return (
		workspace.fairlendOwned.finalReview !== null &&
		workspace.fairlendOwned.finalReview.reviewedSnapshotHash !==
			workspace.velocityOwned.normalizedCoreHash
	);
}

function ActivationPreview({
	reviewSnapshot,
	workspace,
}: {
	readonly reviewSnapshot: VelocitySnapshot | null;
	readonly workspace: VelocityWorkspaceDetail;
}) {
	const mortgage = workspace.velocityOwned.mortgageRequest;
	const property = workspace.velocityOwned.subjectProperty;
	const enrichment = workspace.fairlendOwned.enrichment;
	const bank = enrichment.bankInput;
	const remediation = enrichment.activationRemediation;
	const interestRate = mortgage.rate ?? mortgage.netRate;
	const termStartDate =
		workspace.velocityOwned.upstream.closingDate ??
		mortgage.interestAdjustmentDate;

	return (
		<Card className="border-border/70">
			<CardHeader>
				<CardTitle>Activation preview</CardTitle>
				<p className="text-muted-foreground text-sm">
					Backend-owned package detail that feeds final review and activation.
				</p>
			</CardHeader>
			<CardContent className="space-y-5">
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<PreviewField
						label="Principal"
						value={formatCurrency(mortgage.requestedPrincipal)}
					/>
					<PreviewField
						label="Interest rate"
						value={interestRate == null ? null : `${interestRate}%`}
					/>
					<PreviewField
						label="Rate type"
						value={mortgage.fairlendRateType ?? mortgage.rateTypeLabel}
					/>
					<PreviewField label="Term months" value={mortgage.termInMonths} />
					<PreviewField
						label="Amortization months"
						value={mortgage.amortizationMonths ?? mortgage.amortization}
					/>
					<PreviewField
						label="Payment"
						value={formatCurrency(mortgage.paymentAmount)}
					/>
					<PreviewField
						label="Payment frequency"
						value={
							mortgage.fairlendPaymentFrequency ??
							mortgage.paymentFrequencyLabel
						}
					/>
					<PreviewField
						label="First payment"
						value={mortgage.firstPaymentDate}
					/>
					<PreviewField
						label="Interest adjustment"
						value={mortgage.interestAdjustmentDate}
					/>
					<PreviewField label="Term start" value={termStartDate} />
					<PreviewField label="Maturity" value={mortgage.maturityDate} />
					<PreviewField label="Loan type" value={remediation?.loanType} />
					<PreviewField
						label="Lien position"
						value={remediation?.lienPosition}
					/>
					<PreviewField
						label="Listing publication"
						value="After live activation"
					/>
					<PreviewField
						label="PAD evidence"
						value={enrichment.padEvidence?.originalFilename}
					/>
					<PreviewField
						label="Bank account"
						value={
							bank?.accountLast4
								? `${bank.accountHolderName ?? "Account"} ending ${bank.accountLast4}`
								: null
						}
					/>
				</div>

				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<PreviewField
						label="Property"
						value={[
							property.unit ? `Unit ${property.unit}` : undefined,
							property.streetNumber,
							property.streetName,
							property.city,
							property.province,
							property.postalCode,
						]
							.filter(Boolean)
							.join(", ")}
					/>
					<PreviewField
						label="Property type"
						value={property.propertyTypeRaw ?? "residential"}
					/>
					<PreviewField
						label="Purchase price"
						value={formatCurrency(property.purchasePrice)}
					/>
					<PreviewField
						label="Intended use"
						value={property.intendedUseLabel}
					/>
				</div>

				<div className="grid gap-3 lg:grid-cols-2">
					<div className="rounded-md border border-border/70 bg-muted/20 p-3">
						<p className="text-muted-foreground text-xs">
							Borrower identities and roles
						</p>
						<div className="mt-2 space-y-2">
							{workspace.velocityOwned.borrowers.map((borrower, index) => (
								<div key={`${borrower.fullName}-${borrower.email ?? index}`}>
									<p className="font-medium text-sm">{borrower.fullName}</p>
									<p className="text-muted-foreground text-xs">
										{index === 0 ? "Primary" : "Co-borrower"} /{" "}
										{borrower.email ?? "No email supplied"}
									</p>
								</div>
							))}
						</div>
					</div>
					<div className="rounded-md border border-border/70 bg-muted/20 p-3">
						<p className="text-muted-foreground text-xs">
							Rotessa schedule inputs
						</p>
						<div className="mt-2 grid gap-2 sm:grid-cols-2">
							<InlineField label="Provider" value="pad_rotessa" />
							<InlineField label="Mode" value="provider_managed_now" />
							<InlineField
								label="Amount"
								value={formatCurrency(mortgage.paymentAmount)}
							/>
							<InlineField
								label="Frequency"
								value={mortgage.fairlendPaymentFrequency}
							/>
							<InlineField
								label="Process date"
								value={mortgage.firstPaymentDate}
							/>
							<InlineField
								label="PAD source"
								value={enrichment.padEvidence ? "uploaded" : null}
							/>
						</div>
					</div>
				</div>

				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<PreviewField label="Workspace ID" value={workspace.workspaceId} />
					<PreviewField
						label="Link application ID"
						value={workspace.velocityOwned.identity.linkApplicationId}
					/>
					<PreviewField
						label="Loan code"
						value={workspace.velocityOwned.identity.loanCode}
					/>
					<PreviewField
						label="Lender reference"
						value={workspace.velocityOwned.identity.lenderReferenceNumber}
					/>
					<PreviewField
						label="Current normalized hash"
						value={workspace.velocityOwned.normalizedCoreHash}
					/>
					<PreviewField
						label="Review source snapshot"
						value={reviewSnapshot?.snapshotId}
					/>
					<PreviewField
						label="Review source hash"
						value={reviewSnapshot?.normalizedCoreHash}
					/>
					<PreviewField
						label="Final reviewed hash"
						value={workspace.fairlendOwned.finalReview?.reviewedSnapshotHash}
					/>
				</div>
			</CardContent>
		</Card>
	);
}

function ReadinessSummary({
	workspace,
}: {
	readonly workspace: VelocityWorkspaceDetail;
}) {
	const hasIssues =
		workspace.readiness.blockers.length > 0 ||
		workspace.readiness.warnings.length > 0;

	return (
		<Card className="border-border/70">
			<CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<CardTitle>Backend readiness</CardTitle>
					<p className="mt-1 text-muted-foreground text-sm">
						Action state comes from the package readiness payload.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge
						variant={workspace.readiness.canFinalReview ? "default" : "outline"}
					>
						{workspace.readiness.canFinalReview
							? "Review allowed"
							: "Review blocked"}
					</Badge>
					<Badge
						variant={workspace.readiness.canActivate ? "default" : "outline"}
					>
						{workspace.readiness.canActivate
							? "Activation allowed"
							: "Activation blocked"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{hasIssues ? (
					<div className="grid gap-3 lg:grid-cols-2">
						{workspace.readiness.blockers.map((blocker) => (
							<div
								className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
								key={`${blocker.code}-${blocker.fieldPath ?? blocker.message}`}
							>
								<p className="font-medium text-sm">
									{formatState(blocker.code)}
								</p>
								<p className="mt-1 text-sm">{blocker.message}</p>
								<p className="mt-2 text-xs">
									{blocker.source}
									{blocker.fieldPath ? ` / ${blocker.fieldPath}` : ""}
								</p>
							</div>
						))}
						{workspace.readiness.warnings.map((warning) => (
							<div
								className="rounded-md border border-border/70 bg-muted/30 p-3"
								key={`${warning.code}-${warning.fieldPath ?? warning.message}`}
							>
								<p className="font-medium text-sm">
									{formatState(warning.code)}
								</p>
								<p className="mt-1 text-sm">{warning.message}</p>
							</div>
						))}
					</div>
				) : (
					<div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
						<CheckCircle2 className="size-4" />
						<p className="text-sm">
							No backend blockers or warnings are active.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function VelocityFinalReviewPage({
	workspaceId,
}: VelocityFinalReviewPageProps) {
	const typedWorkspaceId = workspaceId as Id<"velocityPackageWorkspaces">;
	const workspace = useQuery(
		api.velocity.workspaces.getVelocityPackageWorkspace,
		{
			workspaceId: typedWorkspaceId,
		}
	);
	const confirmFinalReview = useMutation(
		api.velocity.review.confirmVelocityPackageFinalReview
	);
	const activateVelocityPackage = useAction(
		api.velocity.activation.activateVelocityPackage
	);
	const activationPendingRef = useRef(false);
	const [activationPending, setActivationPending] = useState(false);

	useAdminBreadcrumbLabel(
		workspace
			? `${workspace.velocityOwned.identity.loanCode} final review`
			: "Velocity final review"
	);

	const reviewSnapshot = workspace ? currentReviewSnapshot(workspace) : null;
	const reviewDrifted = workspace ? hasReviewDrift(workspace) : false;
	const inFlight = workspace
		? isVelocityActivationInFlight(workspace.activationAttempt)
		: false;
	const activationLocked = inFlight || activationPending;
	const canConfirmReview = Boolean(
		workspace?.readiness.canFinalReview && reviewSnapshot && !activationLocked
	);
	const canActivate = Boolean(
		workspace?.readiness.canActivate &&
			workspace.fairlendOwned.finalReview &&
			!reviewDrifted &&
			!activationLocked
	);
	const canRetry = Boolean(
		canActivate && workspace?.activationAttempt?.status === "failed"
	);

	async function handleConfirmReview() {
		if (!(workspace && reviewSnapshot)) {
			return;
		}
		try {
			await confirmFinalReview({
				normalizedCoreHash: workspace.velocityOwned.normalizedCoreHash,
				snapshotId: reviewSnapshot.snapshotId,
				workspaceId: typedWorkspaceId,
			});
			toast.success("Velocity final review confirmed.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to confirm Velocity final review."
			);
		}
	}

	async function handleActivate() {
		const finalReview = workspace?.fairlendOwned.finalReview;
		if (!(workspace && finalReview) || activationPendingRef.current) {
			return;
		}
		activationPendingRef.current = true;
		setActivationPending(true);
		try {
			const result = await activateVelocityPackage({
				reviewedSnapshotHash: finalReview.reviewedSnapshotHash,
				reviewedSnapshotId: finalReview.reviewedSnapshotId,
				workspaceId: typedWorkspaceId,
			});
			toast.success(`Velocity activation ${result.status}.`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Velocity activation failed."
			);
		} finally {
			activationPendingRef.current = false;
			setActivationPending(false);
		}
	}

	if (workspace === undefined) {
		return <AdminPageSkeleton descriptionWidth="w-72" titleWidth="w-64" />;
	}

	if (workspace === null) {
		return (
			<AdminNotFoundState
				entityType="velocity package workspace"
				recordId={workspaceId}
				variant="record"
			/>
		);
	}

	return (
		<div className="space-y-6">
			<section className="flex flex-col gap-4 rounded-md border border-border/70 bg-card px-6 py-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-3">
					<Button asChild size="sm" variant="ghost">
						<Link
							params={{
								entitytype: "velocity",
								recordid: workspace.workspaceId,
							}}
							search={EMPTY_ADMIN_DETAIL_SEARCH}
							to="/admin/$entitytype/$recordid"
						>
							<ArrowLeft className="mr-2 size-4" />
							Workspace
						</Link>
					</Button>
					<div>
						<h1 className="font-semibold text-3xl tracking-tight">
							Final review
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{workspace.velocityOwned.identity.loanCode} /{" "}
							{workspace.velocityOwned.identity.linkApplicationId}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="outline">
							{formatState(workspace.fairlendOwned.state)}
						</Badge>
						<Badge
							variant={workspace.readiness.canActivate ? "default" : "outline"}
						>
							{workspace.readiness.canActivate
								? "Ready to activate"
								: "Activation blocked"}
						</Badge>
						{workspace.fairlendOwned.finalReview ? (
							<Badge variant={reviewDrifted ? "destructive" : "default"}>
								{reviewDrifted ? "Review stale" : "Reviewed"}
							</Badge>
						) : (
							<Badge variant="outline">Not reviewed</Badge>
						)}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={!canConfirmReview}
						onClick={handleConfirmReview}
						variant="outline"
					>
						<ShieldCheck className="mr-2 size-4" />
						Confirm review
					</Button>
					<Button disabled={!canActivate} onClick={handleActivate}>
						<Play className="mr-2 size-4" />
						Activate package
					</Button>
				</div>
			</section>

			{reviewDrifted ? (
				<div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
					<div className="flex items-start gap-2">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						<div>
							<p className="font-medium text-sm">
								Velocity-owned data changed after final review.
							</p>
							<p className="mt-1 text-sm">
								Reviewed hash{" "}
								{workspace.fairlendOwned.finalReview?.reviewedSnapshotHash} no
								longer matches current hash{" "}
								{workspace.velocityOwned.normalizedCoreHash}.
							</p>
						</div>
					</div>
				</div>
			) : null}

			<ReadinessSummary workspace={workspace} />
			<ActivationPreview
				reviewSnapshot={reviewSnapshot}
				workspace={workspace}
			/>
			<VelocityActivationStatusPanel
				attempt={workspace.activationAttempt}
				canRetry={canRetry}
				isRetrying={activationPending}
				onRetry={handleActivate}
			/>
		</div>
	);
}

function PreviewField({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string | number | null | undefined;
}) {
	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 break-words font-medium text-sm">{display(value)}</p>
		</div>
	);
}

function InlineField({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string | number | null | undefined;
}) {
	return (
		<div>
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium text-sm">{display(value)}</p>
		</div>
	);
}
