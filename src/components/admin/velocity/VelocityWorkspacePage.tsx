"use client";

import { Link } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ArrowLeft,
	CheckCircle2,
	Lock,
	RefreshCw,
	Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useAdminBreadcrumbLabel } from "#/components/admin/shell/AdminPageMetadataContext";
import {
	AdminNotFoundState,
	AdminPageSkeleton,
} from "#/components/admin/shell/AdminRouteStates";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Textarea } from "#/components/ui/textarea";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { VelocityWorkspaceDetail } from "./types";
import { VelocityDocumentPanel } from "./VelocityDocumentPanel";
import {
	buildFairLendFieldsPatch,
	buildInitialForm,
	type FairLendFormState,
	type LoanTypeSelectValue,
} from "./VelocityWorkspaceForm";

interface VelocityWorkspacePageProps {
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

function formatDateTime(value: number) {
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function formatState(value: string) {
	return value
		.split("_")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function display(value: string | number | boolean | null | undefined) {
	if (value == null || value === "") {
		return "Not supplied";
	}
	return String(value);
}

function DetailField({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string | number | boolean | null | undefined;
}) {
	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 break-words font-medium text-sm">{display(value)}</p>
		</div>
	);
}

function JsonSummary({ label, value }: { label: string; value: unknown }) {
	if (value == null) {
		return <DetailField label={label} value={null} />;
	}

	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		</div>
	);
}

function ReadinessPanel({ workspace }: { workspace: VelocityWorkspaceDetail }) {
	const hasIssues =
		workspace.readiness.blockers.length > 0 ||
		workspace.readiness.warnings.length > 0 ||
		workspace.exceptions.some((exception) => exception.status === "open");

	return (
		<section className="space-y-4 rounded-md border border-border/70 p-4">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="font-semibold text-lg">Readiness and remediation</h2>
					<p className="text-muted-foreground text-sm">
						Backend-derived blockers, warnings, and package exceptions.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Badge
						variant={workspace.readiness.canFinalReview ? "default" : "outline"}
					>
						{workspace.readiness.canFinalReview
							? "Final review ready"
							: "Review blocked"}
					</Badge>
					<Badge
						variant={workspace.readiness.canActivate ? "default" : "outline"}
					>
						{workspace.readiness.canActivate
							? "Activation ready"
							: "Activation blocked"}
					</Badge>
				</div>
			</div>

			{hasIssues ? (
				<div className="grid gap-3 lg:grid-cols-3">
					{workspace.readiness.blockers.map((blocker) => (
						<div
							className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
							key={`${blocker.code}-${blocker.fieldPath ?? blocker.message}`}
						>
							<p className="font-medium text-sm">{formatState(blocker.code)}</p>
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
							<p className="font-medium text-sm">{formatState(warning.code)}</p>
							<p className="mt-1 text-sm">{warning.message}</p>
						</div>
					))}
					{workspace.exceptions.map((exception) => (
						<div
							className={cn(
								"rounded-md border p-3",
								exception.status === "open"
									? "border-destructive/40 bg-destructive/10"
									: "border-border/70 bg-muted/20"
							)}
							key={exception.exceptionId}
						>
							<p className="font-medium text-sm">{exception.title}</p>
							<p className="mt-1 text-sm">{exception.message}</p>
							<p className="mt-2 text-muted-foreground text-xs">
								{formatState(exception.kind)} / {exception.status} / opened{" "}
								{formatDateTime(exception.openedAt)}
							</p>
						</div>
					))}
				</div>
			) : (
				<div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
					<CheckCircle2 className="size-4" />
					<p className="text-sm">No backend readiness blockers are active.</p>
				</div>
			)}
		</section>
	);
}

function VelocityOwnedSections({
	workspace,
}: {
	readonly workspace: VelocityWorkspaceDetail;
}) {
	const mortgage = workspace.velocityOwned.mortgageRequest;
	const property = workspace.velocityOwned.subjectProperty;

	return (
		<section className="space-y-4 rounded-md border border-border/70 p-4">
			<div className="flex items-start gap-2">
				<Lock className="mt-1 size-4 text-muted-foreground" />
				<div>
					<h2 className="font-semibold text-lg">Velocity-owned facts</h2>
					<p className="text-muted-foreground text-sm">
						These fields are synchronized from Velocity and are not editable in
						FairLend.
					</p>
				</div>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<DetailField
					label="Loan code"
					value={workspace.velocityOwned.identity.loanCode}
				/>
				<DetailField
					label="Link application ID"
					value={workspace.velocityOwned.identity.linkApplicationId}
				/>
				<DetailField
					label="Lender reference"
					value={workspace.velocityOwned.identity.lenderReferenceNumber}
				/>
				<DetailField
					label="Normalized hash"
					value={workspace.velocityOwned.normalizedCoreHash}
				/>
				<DetailField
					label="Source version"
					value={workspace.velocityOwned.sourceVersion}
				/>
				<DetailField
					label="Velocity agent"
					value={workspace.velocityOwned.upstream.agent}
				/>
				<DetailField
					label="Created in Velocity"
					value={workspace.velocityOwned.upstream.dateCreated}
				/>
				<DetailField
					label="Closing date"
					value={workspace.velocityOwned.upstream.closingDate}
				/>
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<DetailField
					label="Velocity status"
					value={workspace.velocityOwned.upstream.statusLabel}
				/>
				<DetailField
					label="Principal"
					value={formatCurrency(mortgage.requestedPrincipal)}
				/>
				<DetailField
					label="Payment"
					value={formatCurrency(mortgage.paymentAmount)}
				/>
				<DetailField
					label="Payment frequency"
					value={
						mortgage.paymentFrequencyLabel ?? mortgage.fairlendPaymentFrequency
					}
				/>
				<DetailField
					label="Rate"
					value={mortgage.rate == null ? null : `${mortgage.rate}%`}
				/>
				<DetailField
					label="Rate type"
					value={mortgage.rateTypeLabel ?? mortgage.fairlendRateType}
				/>
				<DetailField label="Term months" value={mortgage.termInMonths} />
				<DetailField label="Maturity date" value={mortgage.maturityDate} />
			</div>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
				<DetailField label="Street number" value={property.streetNumber} />
				<DetailField label="Street name" value={property.streetName} />
				<DetailField label="City" value={property.city} />
				<DetailField label="Province" value={property.province} />
				<DetailField label="Postal code" value={property.postalCode} />
				<DetailField label="Intended use" value={property.intendedUseLabel} />
				<DetailField
					label="Purchase price"
					value={formatCurrency(property.purchasePrice)}
				/>
				<DetailField label="Property type" value={property.propertyTypeRaw} />
			</div>
			<div className="grid gap-3 lg:grid-cols-2">
				<div className="rounded-md border border-border/70 bg-muted/20 p-3">
					<p className="text-muted-foreground text-xs">Borrowers</p>
					<div className="mt-2 space-y-2">
						{workspace.velocityOwned.borrowers.map((borrower) => (
							<div key={`${borrower.fullName}-${borrower.email ?? ""}`}>
								<p className="font-medium text-sm">{borrower.fullName}</p>
								<p className="text-muted-foreground text-xs">
									{[borrower.email, borrower.cellPhone, borrower.homePhone]
										.filter(Boolean)
										.join(" / ") || "No contact details"}
								</p>
							</div>
						))}
					</div>
				</div>
				<div className="rounded-md border border-border/70 bg-muted/20 p-3">
					<p className="text-muted-foreground text-xs">Conditions</p>
					<div className="mt-2 flex flex-wrap gap-2">
						{workspace.velocityOwned.conditions.length > 0 ? (
							workspace.velocityOwned.conditions.map((condition) => (
								<Badge key={condition.name} variant="outline">
									{condition.name}
								</Badge>
							))
						) : (
							<span className="text-muted-foreground text-sm">
								None supplied
							</span>
						)}
					</div>
				</div>
				<div className="rounded-md border border-border/70 bg-muted/20 p-3">
					<p className="text-muted-foreground text-xs">Lender conditions</p>
					<div className="mt-2 space-y-2">
						{workspace.velocityOwned.lenderConditions.length > 0 ? (
							workspace.velocityOwned.lenderConditions.map((condition) => (
								<p className="text-sm" key={condition}>
									{condition}
								</p>
							))
						) : (
							<span className="text-muted-foreground text-sm">
								None supplied
							</span>
						)}
					</div>
				</div>
				<div className="rounded-md border border-border/70 bg-muted/20 p-3">
					<p className="text-muted-foreground text-xs">Velocity notes</p>
					<div className="mt-2 space-y-2">
						{workspace.velocityOwned.notes.length > 0 ? (
							workspace.velocityOwned.notes.map((note) => (
								<div key={`${note.dateCreated ?? "undated"}-${note.text}`}>
									<p className="text-sm">{note.text}</p>
									<p className="text-muted-foreground text-xs">
										{note.dateCreated ?? "No note date"}
									</p>
								</div>
							))
						) : (
							<span className="text-muted-foreground text-sm">
								None supplied
							</span>
						)}
					</div>
				</div>
				<JsonSummary
					label="Referral"
					value={workspace.velocityOwned.referral}
				/>
				<JsonSummary
					label="Solicitor"
					value={workspace.velocityOwned.solicitor}
				/>
			</div>
		</section>
	);
}

function SnapshotHistory({
	workspace,
}: {
	readonly workspace: VelocityWorkspaceDetail;
}) {
	return (
		<section className="space-y-3 rounded-md border border-border/70 p-4">
			<h2 className="font-semibold text-lg">Snapshot history</h2>
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
				{workspace.snapshots.map((snapshot) => (
					<div
						className="rounded-md border border-border/70 bg-muted/20 p-3"
						key={snapshot.snapshotId}
					>
						<p className="font-medium text-sm">
							{formatState(snapshot.snapshotType)}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							{formatDateTime(snapshot.createdAt)} by {snapshot.createdBy}
						</p>
						<p className="mt-2 break-all text-muted-foreground text-xs">
							{snapshot.normalizedCoreHash}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}

export function VelocityWorkspacePage({
	workspaceId,
}: VelocityWorkspacePageProps) {
	const typedWorkspaceId = workspaceId as Id<"velocityPackageWorkspaces">;
	const workspace = useQuery(
		api.velocity.workspaces.getVelocityPackageWorkspace,
		{
			workspaceId: typedWorkspaceId,
		}
	);
	const updateFairLendFields = useMutation(
		api.velocity.workspaces.updateVelocityPackageFairLendFields
	);
	const syncNow = useAction(api.velocity.sync.syncVelocityPackageNow);
	const [form, setForm] = useState<FairLendFormState>(() =>
		buildInitialForm(undefined)
	);
	const [isDirty, setIsDirty] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [lastSavedState, setLastSavedState] = useState<string | null>(null);
	const hydratedWorkspaceIdRef = useRef<string | null>(null);
	const skipNextCleanHydrationRef = useRef(false);
	const updateForm = useCallback(
		(updater: (current: FairLendFormState) => FairLendFormState) => {
			setIsDirty(true);
			setForm(updater);
		},
		[]
	);

	useAdminBreadcrumbLabel(
		workspace?.velocityOwned.identity.loanCode ?? "Velocity package"
	);

	useEffect(() => {
		if (!workspace) {
			return;
		}

		if (
			hydratedWorkspaceIdRef.current === workspaceId &&
			!isDirty &&
			skipNextCleanHydrationRef.current
		) {
			skipNextCleanHydrationRef.current = false;
			return;
		}

		if (hydratedWorkspaceIdRef.current !== workspaceId || !isDirty) {
			setForm(buildInitialForm(workspace));
			setIsDirty(false);
			hydratedWorkspaceIdRef.current = workspaceId;
		}
	}, [isDirty, workspace, workspaceId]);

	const headerBadges = useMemo(() => {
		if (!workspace) {
			return [];
		}
		return [
			workspace.velocityOwned.upstream.statusLabel ?? "Velocity unknown",
			formatState(workspace.fairlendOwned.state),
			`${workspace.readiness.blockers.length} blockers`,
		];
	}, [workspace]);

	async function handleSave() {
		const patchResult = buildFairLendFieldsPatch(form);
		if (!patchResult.ok) {
			toast.error(patchResult.message);
			return;
		}

		setIsSaving(true);
		try {
			const result = await updateFairLendFields({
				patch: patchResult.patch,
				workspaceId: typedWorkspaceId,
			});
			skipNextCleanHydrationRef.current = true;
			setIsDirty(false);
			setLastSavedState(result.state);
			toast.success("FairLend-owned package fields saved.");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Failed to save FairLend-owned fields."
			);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleSyncNow() {
		setIsSyncing(true);
		try {
			const result = await syncNow({ workspaceId: typedWorkspaceId });
			toast.success(`Velocity sync ${result.result}.`);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Velocity sync failed."
			);
		} finally {
			setIsSyncing(false);
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
			<div className="flex flex-col gap-4 rounded-md border border-border/70 bg-card px-6 py-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-3">
					<Button asChild size="sm" variant="ghost">
						<Link
							params={{ entitytype: "velocity" }}
							search={EMPTY_ADMIN_DETAIL_SEARCH}
							to="/admin/$entitytype"
						>
							<ArrowLeft className="mr-2 size-4" />
							Velocity board
						</Link>
					</Button>
					<div>
						<h1 className="font-semibold text-3xl tracking-tight">
							{workspace.velocityOwned.identity.loanCode}
						</h1>
						<p className="mt-1 text-muted-foreground text-sm">
							{workspace.velocityOwned.borrowers[0]?.fullName ??
								"Unknown borrower"}{" "}
							/ {workspace.velocityOwned.identity.linkApplicationId}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						{headerBadges.map((badge) => (
							<Badge key={badge} variant="outline">
								{badge}
							</Badge>
						))}
					</div>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={isSyncing}
						onClick={handleSyncNow}
						variant="outline"
					>
						<RefreshCw
							className={cn("mr-2 size-4", isSyncing && "animate-spin")}
						/>
						{isSyncing ? "Syncing..." : "Sync now"}
					</Button>
					<Button disabled={isSaving} onClick={handleSave}>
						<Save className="mr-2 size-4" />
						{isSaving ? "Saving..." : "Save FairLend fields"}
					</Button>
				</div>
			</div>

			{lastSavedState ? (
				<div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 text-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
					<CheckCircle2 className="size-4" />
					Backend readiness recomputed. Current action state:{" "}
					{formatState(lastSavedState)}.
				</div>
			) : null}

			<ReadinessPanel workspace={workspace} />
			<VelocityOwnedSections workspace={workspace} />

			<Card className="border-border/70">
				<CardHeader>
					<CardTitle>FairLend-owned fields</CardTitle>
				</CardHeader>
				<CardContent className="space-y-5">
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-account-holder"
							>
								Account holder
							</label>
							<Input
								id="velocity-account-holder"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										accountHolderName: event.target.value,
									}))
								}
								value={form.accountHolderName}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-institution"
							>
								Institution
							</label>
							<Input
								id="velocity-institution"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										institutionNumber: event.target.value,
									}))
								}
								value={form.institutionNumber}
							/>
						</div>
						<div className="space-y-2">
							<label className="font-medium text-sm" htmlFor="velocity-transit">
								Transit
							</label>
							<Input
								id="velocity-transit"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										transitNumber: event.target.value,
									}))
								}
								value={form.transitNumber}
							/>
						</div>
						<div className="space-y-2">
							<label className="font-medium text-sm" htmlFor="velocity-account">
								Account number
							</label>
							<Input
								id="velocity-account"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										accountNumber: event.target.value,
									}))
								}
								value={form.accountNumber}
							/>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-loan-type"
							>
								Loan type
							</label>
							<Select
								onValueChange={(value) =>
									updateForm((current) => ({
										...current,
										loanType: value as LoanTypeSelectValue,
									}))
								}
								value={form.loanType}
							>
								<SelectTrigger className="w-full" id="velocity-loan-type">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Not selected</SelectItem>
									<SelectItem value="conventional">Conventional</SelectItem>
									<SelectItem value="insured">Insured</SelectItem>
									<SelectItem value="high_ratio">High ratio</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-lien-position"
							>
								Lien position
							</label>
							<Input
								id="velocity-lien-position"
								inputMode="numeric"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										lienPosition: event.target.value,
									}))
								}
								value={form.lienPosition}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-value-as-is"
							>
								Value as-is
							</label>
							<Input
								id="velocity-value-as-is"
								inputMode="decimal"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										valueAsIs: event.target.value,
									}))
								}
								value={form.valueAsIs}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-valuation-date"
							>
								Valuation date
							</label>
							<Input
								id="velocity-valuation-date"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										valuationDate: event.target.value,
									}))
								}
								type="date"
								value={form.valuationDate}
							/>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-staff-notes"
							>
								Staff notes
							</label>
							<Textarea
								id="velocity-staff-notes"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										staffNotes: event.target.value,
									}))
								}
								value={form.staffNotes}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-remediation-notes"
							>
								Remediation notes
							</label>
							<Textarea
								id="velocity-remediation-notes"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										remediationNotes: event.target.value,
									}))
								}
								value={form.remediationNotes}
							/>
						</div>
					</div>

					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-listing-title"
							>
								Listing title
							</label>
							<Input
								id="velocity-listing-title"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										listingTitle: event.target.value,
									}))
								}
								value={form.listingTitle}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-listing-slug"
							>
								SEO slug
							</label>
							<Input
								id="velocity-listing-slug"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										listingSeoSlug: event.target.value,
									}))
								}
								value={form.listingSeoSlug}
							/>
						</div>
						<div className="space-y-2 xl:col-span-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-marketplace-copy"
							>
								Marketplace copy
							</label>
							<Input
								id="velocity-marketplace-copy"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										listingMarketplaceCopy: event.target.value,
									}))
								}
								value={form.listingMarketplaceCopy}
							/>
						</div>
					</div>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-listing-description"
							>
								Listing description
							</label>
							<Textarea
								id="velocity-listing-description"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										listingDescription: event.target.value,
									}))
								}
								value={form.listingDescription}
							/>
						</div>
						<div className="space-y-2">
							<label
								className="font-medium text-sm"
								htmlFor="velocity-listing-admin-notes"
							>
								Listing admin notes
							</label>
							<Textarea
								id="velocity-listing-admin-notes"
								onChange={(event) =>
									updateForm((current) => ({
										...current,
										listingAdminNotes: event.target.value,
									}))
								}
								value={form.listingAdminNotes}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<VelocityDocumentPanel
				documents={workspace.documents}
				workspaceId={typedWorkspaceId}
			/>
			<SnapshotHistory workspace={workspace} />

			<div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/30 px-4 py-3 text-muted-foreground text-sm">
				<AlertTriangle className="mt-0.5 size-4" />
				<p>
					Final review and activation controls are intentionally downstream.
					This workspace only prepares the package and exposes current blockers.
				</p>
			</div>
		</div>
	);
}
