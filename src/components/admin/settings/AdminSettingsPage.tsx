"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	Building2,
	CheckCircle2,
	LoaderCircle,
	ShieldCheck,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
	AdminPageSkeleton,
	AdminTableSkeleton,
} from "#/components/admin/shell/AdminRouteStates";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "#/components/ui/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "#/components/ui/empty";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Separator } from "#/components/ui/separator";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { api } from "../../../../convex/_generated/api";
import type { MockOriginationBatchStatusSnapshot } from "../../../../convex/admin/settings/mockMortgages";
import type {
	AdminOrgMemberSummary,
	AdminOrgSettingsSnapshot,
} from "../../../../convex/admin/settings/queries";

function getErrorMessage(
	error: unknown,
	fallback = "Something went wrong while bootstrapping CRM objects."
) {
	if (error instanceof Error && error.message.trim().length > 0) {
		return error.message;
	}
	return fallback;
}

function formatTimestamp(value: number | null) {
	if (value === null) {
		return "Not saved yet";
	}

	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(value);
}

function formatMemberName(member: AdminOrgMemberSummary): string {
	const joined = `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
	if (joined.length > 0) {
		return joined;
	}
	return member.email ?? member.userWorkosId;
}

function formatMockBatchStatus(
	status: MockOriginationBatchStatusSnapshot["status"]
) {
	switch (status) {
		case "seeding":
			return "Seeding";
		case "ready":
			return "Ready";
		case "cleaning":
			return "Cleaning";
		case "failed":
			return "Seed failed";
		case "clean_failed":
			return "Cleanup failed";
		case "cleaned":
			return "Cleaned";
		default:
			return "Not seeded";
	}
}

function OrganizationCard({
	organization,
}: {
	readonly organization: AdminOrgSettingsSnapshot["organization"];
}) {
	if (!organization) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Current organization</CardTitle>
					<CardDescription>
						No organization record is synced for this session yet.
					</CardDescription>
				</CardHeader>
			</Card>
		);
	}

	const metadataEntries = Object.entries(organization.metadata ?? {});

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Building2 className="size-5" />
						</div>
						<div>
							<CardTitle>{organization.name}</CardTitle>
							<CardDescription>
								Active organization synced from WorkOS AuthKit.
							</CardDescription>
						</div>
					</div>
					<Badge variant="outline">WorkOS org</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<dl className="grid gap-3 sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							WorkOS ID
						</dt>
						<dd className="break-all font-mono text-xs">
							{organization.workosId}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							External ID
						</dt>
						<dd className="break-all font-mono text-xs">
							{organization.externalId ?? "—"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Profiles outside organization
						</dt>
						<dd>
							{organization.allowProfilesOutsideOrganization
								? "Allowed"
								: "Disallowed"}
						</dd>
					</div>
				</dl>
				{metadataEntries.length > 0 ? (
					<>
						<Separator />
						<div className="space-y-2">
							<p className="font-medium text-xs uppercase tracking-wide">
								Metadata
							</p>
							<dl className="grid gap-2 sm:grid-cols-2">
								{metadataEntries.map(([key, value]) => (
									<div key={key}>
										<dt className="text-muted-foreground text-xs">{key}</dt>
										<dd className="break-words">{value}</dd>
									</div>
								))}
							</dl>
						</div>
					</>
				) : null}
			</CardContent>
		</Card>
	);
}

function MembersCard({
	members,
}: {
	readonly members: readonly AdminOrgMemberSummary[];
}) {
	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between gap-3">
					<div>
						<CardTitle>Organization members</CardTitle>
						<CardDescription>
							People with a WorkOS membership in this organization.
						</CardDescription>
					</div>
					<Badge variant="outline">
						{members.length} {members.length === 1 ? "member" : "members"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				{members.length === 0 ? (
					<Empty className="rounded-xl border border-border/70 border-dashed p-6">
						<EmptyHeader>
							<EmptyTitle>No members synced</EmptyTitle>
							<EmptyDescription>
								WorkOS has not synced any memberships for this organization yet.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Email</TableHead>
								<TableHead>Role</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{members.map((member) => (
								<TableRow key={member.membershipWorkosId}>
									<TableCell className="font-medium">
										{formatMemberName(member)}
									</TableCell>
									<TableCell className="text-muted-foreground">
										{member.email ?? "—"}
									</TableCell>
									<TableCell>
										<div className="flex flex-wrap gap-1">
											{member.roleSlugs.map((role) => (
												<Badge
													key={`${member.membershipWorkosId}-${role}`}
													variant={role === "admin" ? "default" : "secondary"}
												>
													{role}
												</Badge>
											))}
										</div>
									</TableCell>
									<TableCell>
										<Badge variant="outline">{member.status}</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				)}
			</CardContent>
		</Card>
	);
}

export function BrokerPortalPricingCard({
	brokerPortalPricing,
}: {
	readonly brokerPortalPricing: AdminOrgSettingsSnapshot["brokerPortalPricing"];
}) {
	const saveBrokerPortalPricing = useMutation(
		api.admin.settings.mutations.setBrokerPortalPricing
	);
	async function handleSave(formData: FormData, form: HTMLFormElement) {
		const rawBrokerSplitPercent = String(
			formData.get("brokerSplitPercent") ?? ""
		).trim();
		const parsedBrokerSplitPercent = Number(rawBrokerSplitPercent);
		const isValidBrokerSplitPercent =
			rawBrokerSplitPercent.length > 0 &&
			Number.isFinite(parsedBrokerSplitPercent) &&
			parsedBrokerSplitPercent >= 0 &&
			parsedBrokerSplitPercent <= 100;

		if (!isValidBrokerSplitPercent) {
			toast.error("Broker portal pricing must be a number between 0 and 100.");
			return;
		}

		const submitButton = form.querySelector<HTMLButtonElement>(
			'button[type="submit"]'
		);
		if (form.dataset.saving === "true") {
			return;
		}

		form.dataset.saving = "true";
		submitButton?.setAttribute("disabled", "");
		submitButton?.setAttribute("aria-busy", "true");
		const previousLabel = submitButton?.textContent ?? null;
		if (submitButton) {
			submitButton.textContent = "Saving…";
		}
		try {
			const result = await saveBrokerPortalPricing({
				brokerSplitPercent: parsedBrokerSplitPercent,
			});
			toast.success(
				`Broker portal pricing saved at ${result.brokerSplitPercent}% across ${result.brokerPortalCount} broker portals. ${result.brokerPortalsUpdated} broker portal policies were updated.`
			);
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Unable to save broker portal pricing. Please try again."
				)
			);
		} finally {
			form.dataset.saving = "false";
			submitButton?.removeAttribute("disabled");
			submitButton?.removeAttribute("aria-busy");
			if (submitButton && previousLabel != null) {
				submitButton.textContent = previousLabel;
			}
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>Broker portal pricing</CardTitle>
						<CardDescription>
							Temporary global control for broker portals. FairLend&apos;s app
							portal stays pinned to a persisted 0% adjustment.
						</CardDescription>
					</div>
					<Badge variant="outline">
						{brokerPortalPricing.brokerPortalCount} broker
						{brokerPortalPricing.brokerPortalCount === 1 ? "" : "s"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<dl className="grid gap-3 sm:grid-cols-3">
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Current adjustment
						</dt>
						<dd>{brokerPortalPricing.brokerSplitPercent}%</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Drifted portals
						</dt>
						<dd>{brokerPortalPricing.driftedBrokerPortalCount}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Last updated
						</dt>
						<dd>{formatTimestamp(brokerPortalPricing.lastUpdatedAt)}</dd>
					</div>
				</dl>
				<form
					className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-4"
					onSubmit={(event) => {
						event.preventDefault();
						void handleSave(
							new FormData(event.currentTarget),
							event.currentTarget
						);
					}}
				>
					<div className="space-y-1">
						<Label htmlFor="broker-portal-pricing-percent">
							Broker portal price adjustment (%)
						</Label>
						<Input
							defaultValue={String(brokerPortalPricing.brokerSplitPercent)}
							id="broker-portal-pricing-percent"
							inputMode="decimal"
							max={100}
							min={0}
							name="brokerSplitPercent"
							placeholder="0"
							step="0.01"
							type="number"
						/>
						<p className="text-muted-foreground text-xs">
							This value is materialized into selected active pricing policies
							for every broker portal. A default 0% policy is persisted for new
							and backfilled portals.
						</p>
					</div>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-muted-foreground text-xs">
							{brokerPortalPricing.updatedByAuthId
								? `Last saved by ${brokerPortalPricing.updatedByAuthId}.`
								: "No explicit save has been recorded yet."}
						</p>
						<Button type="submit">Save broker pricing</Button>
					</div>
				</form>
			</CardContent>
		</Card>
	);
}

function BootstrapCard({
	bootstrapStatus,
}: {
	readonly bootstrapStatus: AdminOrgSettingsSnapshot["bootstrapStatus"];
}) {
	const bootstrap = useMutation(
		api.crm.systemAdapters.bootstrap.adminBootstrap
	);
	const [isSeeding, setIsSeeding] = useState(false);

	async function handleSeed() {
		setIsSeeding(true);
		try {
			const result = await bootstrap({});
			const createdCount = result.created.length;
			const repairedCount = result.repaired.length;
			toast.success(
				`CRM system objects ready — ${createdCount} created, ${repairedCount} repaired.`
			);
		} catch (error) {
			toast.error(getErrorMessage(error));
		} finally {
			setIsSeeding(false);
		}
	}

	const showSeedButton = !bootstrapStatus.isBootstrapped;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Sparkles className="size-5" />
						</div>
						<div>
							<CardTitle>CRM system objects</CardTitle>
							<CardDescription>
								Seed the canonical object definitions, fields, and default views
								that back the admin view engine.
							</CardDescription>
						</div>
					</div>
					{bootstrapStatus.isBootstrapped ? (
						<Badge className="gap-1" variant="default">
							<CheckCircle2 className="size-3.5" />
							Seeded
						</Badge>
					) : (
						<Badge variant="secondary">Not seeded</Badge>
					)}
				</div>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<dl className="grid gap-3 sm:grid-cols-2">
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Seeded
						</dt>
						<dd>
							{bootstrapStatus.seededSystemObjectCount} /{" "}
							{bootstrapStatus.expectedSystemObjectCount} system objects
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Missing
						</dt>
						<dd>
							{bootstrapStatus.missingSystemObjectNames.length === 0
								? "None"
								: bootstrapStatus.missingSystemObjectNames.join(", ")}
						</dd>
					</div>
				</dl>
				{showSeedButton ? (
					<div className="flex flex-col gap-3 rounded-xl border border-border/70 border-dashed bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-muted-foreground text-sm">
							Bootstrap will create any missing object definitions, fields, and
							default table views for this organization.
						</p>
						<Button
							disabled={isSeeding}
							onClick={() => {
								void handleSeed();
							}}
							type="button"
						>
							{isSeeding ? (
								<>
									<LoaderCircle className="size-4 animate-spin" />
									Seeding…
								</>
							) : (
								<>
									<Sparkles className="size-4" />
									Seed CRM objects
								</>
							)}
						</Button>
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

export function FairLendMicPortalCard() {
	const ensureFairLendMicPortal = useMutation(
		api.seed.seedPlatformOwnership.ensureFairLendMicPortal
	);

	async function handleRepair(button: HTMLButtonElement) {
		if (button.dataset.repairing === "true") {
			return;
		}

		button.dataset.repairing = "true";
		button.disabled = true;
		button.setAttribute("aria-busy", "true");
		const previousContent = button.innerHTML;
		button.textContent = "Repairing...";
		try {
			const result = await ensureFairLendMicPortal({});
			toast.success(
				`MIC portal ready at mic.localhost:3000 with lender mapping ${result.micLenderAuthId}.`
			);
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Unable to repair the FairLend MIC portal configuration."
				)
			);
		} finally {
			button.dataset.repairing = "false";
			button.disabled = false;
			button.removeAttribute("aria-busy");
			button.innerHTML = previousContent;
		}
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<ShieldCheck className="size-5" />
						</div>
						<div>
							<CardTitle>FairLend MIC portal</CardTitle>
							<CardDescription>
								Repair or create the universal MIC portal host and canonical
								FairLend MIC lender mapping.
							</CardDescription>
						</div>
					</div>
					<Badge variant="outline">mic.localhost:3000</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<div className="rounded-xl border border-border/70 bg-muted/20 p-4">
					<p className="text-muted-foreground text-sm">
						This ensures the mic portal is active, published, pointed at
						mic.fairlend.ca and mic.localhost:3000, and mapped to the canonical
						FairLend MIC pooled lender account.
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<p className="text-muted-foreground text-xs">
						Use this after local seed resets or when the MIC host is blocked as
						misconfigured.
					</p>
					<Button
						onClick={(event) => {
							void handleRepair(event.currentTarget);
						}}
						type="button"
					>
						<ShieldCheck className="size-4" />
						Repair MIC portal
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export function MockMortgagesCard({
	status,
}: {
	readonly status: MockOriginationBatchStatusSnapshot | null;
}) {
	const [isCleaning, setIsCleaning] = useState(false);
	const [isSeeding, setIsSeeding] = useState(false);
	const seedMockMortgages = useAction(
		api.admin.settings.actions.seedMockMortgages
	);
	const cleanupMockMortgages = useAction(
		api.admin.settings.actions.cleanupMockMortgages
	);

	async function handleSeed() {
		setIsSeeding(true);
		try {
			const result = await seedMockMortgages({});
			toast.success(
				`Seeded ${result.itemCount} mock mortgages in batch ${result.batchId}.`
			);
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Something went wrong while seeding mock mortgages."
				)
			);
		} finally {
			setIsSeeding(false);
		}
	}

	async function handleCleanup() {
		setIsCleaning(true);
		try {
			const result = await cleanupMockMortgages({});
			if (result.status === "noop") {
				toast.success("No active mock mortgage batch needed cleanup.");
			} else {
				toast.success(
					`Cleaned ${result.cleanedCount} mock mortgages from batch ${result.batchId}.`
				);
			}
		} catch (error) {
			toast.error(
				getErrorMessage(
					error,
					"Something went wrong while cleaning up mock mortgages."
				)
			);
		} finally {
			setIsCleaning(false);
		}
	}

	const hasActiveBatch = status?.activeBatchExists ?? false;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
							<Sparkles className="size-5" />
						</div>
						<div>
							<CardTitle>Mock mortgages</CardTitle>
							<CardDescription>
								Seed or clean the fixed 12-mortgage QA catalog through the live
								admin origination workflow, including borrower creation, Rotessa
								schedule setup, commit, and listing publication.
							</CardDescription>
						</div>
					</div>
					<Badge variant={hasActiveBatch ? "default" : "outline"}>
						{formatMockBatchStatus(status?.status ?? null)}
					</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				<dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Batch ID
						</dt>
						<dd className="break-all font-mono text-xs">
							{status?.batchId ?? "—"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Published
						</dt>
						<dd>
							{status
								? `${status.publishedCount} / ${status.itemCount}`
								: "0 / 0"}
						</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Ready for QA
						</dt>
						<dd>{status?.readyCount ?? 0}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Provider cleanup
						</dt>
						<dd>{status?.providerCleanupCount ?? 0}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Started
						</dt>
						<dd>{formatTimestamp(status?.startedAt ?? null)}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Completed
						</dt>
						<dd>{formatTimestamp(status?.completedAt ?? null)}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Cleaned
						</dt>
						<dd>{formatTimestamp(status?.cleanedAt ?? null)}</dd>
					</div>
					<div>
						<dt className="text-muted-foreground text-xs uppercase tracking-wide">
							Failures
						</dt>
						<dd>{status?.failedCount ?? 0}</dd>
					</div>
				</dl>
				<div className="rounded-xl border border-border/70 bg-muted/20 p-4">
					<p className="text-muted-foreground text-sm">
						{status?.lastError
							? `Last error: ${status.lastError}`
							: "The seeded catalog is fail-closed. If a batch exists, cleanup must finish before reseeding."}
					</p>
				</div>
				<div className="flex flex-col gap-3 sm:flex-row">
					<Button
						disabled={hasActiveBatch || isSeeding || isCleaning}
						onClick={() => {
							void handleSeed();
						}}
						type="button"
					>
						{isSeeding ? (
							<>
								<LoaderCircle className="size-4 animate-spin" />
								Seeding…
							</>
						) : (
							"Seed mock mortgages"
						)}
					</Button>
					<Button
						disabled={!hasActiveBatch || isSeeding || isCleaning}
						onClick={() => {
							void handleCleanup();
						}}
						type="button"
						variant="outline"
					>
						{isCleaning ? (
							<>
								<LoaderCircle className="size-4 animate-spin" />
								Cleaning…
							</>
						) : (
							"Clean up mock mortgages"
						)}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

export function AdminSettingsPage() {
	const snapshot = useQuery(api.admin.settings.queries.getOrgSettings);
	const mockMortgageBatchStatus = useQuery(
		api.admin.settings.queries.getMockOriginationBatchStatus
	);

	if (snapshot === undefined || mockMortgageBatchStatus === undefined) {
		return (
			<AdminPageSkeleton descriptionWidth="w-80" titleWidth="w-40">
				<AdminTableSkeleton columnCount={4} rowCount={5} />
			</AdminPageSkeleton>
		);
	}

	if (snapshot === null) {
		return (
			<Empty className="rounded-2xl border border-border/70 border-dashed p-8">
				<EmptyHeader>
					<EmptyTitle>No organization context</EmptyTitle>
					<EmptyDescription>
						This session is not associated with a WorkOS organization. Switch to
						an organization to manage its settings.
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		);
	}

	return (
		<div className="space-y-6">
			<header className="space-y-1">
				<h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
				<p className="text-muted-foreground text-sm">
					Manage the active organization, members, broker portal pricing, CRM
					bootstrap state, MIC portal configuration, and mock mortgage QA data.
				</p>
			</header>
			<OrganizationCard organization={snapshot.organization} />
			<MembersCard members={snapshot.members} />
			<BrokerPortalPricingCard
				brokerPortalPricing={snapshot.brokerPortalPricing}
			/>
			<BootstrapCard bootstrapStatus={snapshot.bootstrapStatus} />
			<FairLendMicPortalCard />
			<MockMortgagesCard status={mockMortgageBatchStatus} />
		</div>
	);
}
