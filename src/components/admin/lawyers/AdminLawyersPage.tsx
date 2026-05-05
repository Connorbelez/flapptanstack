import { useMutation, useQuery } from "convex/react";
import {
	AlertTriangle,
	ChevronLeft,
	ChevronRight,
	Search,
	UserCheck,
	UserPlus,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminLawyersDetailSheet } from "./AdminLawyersDetailSheet";
import {
	type AdminLawyerInvitationStatusFilter,
	type AdminLawyerPlatformStatusFilter,
	type AdminLawyerProfileKind,
	type AdminLawyerProfileRepairPreviewResult,
	type AdminLawyerRosterFilters,
	type AdminLawyerRosterResult,
	type AdminLawyerRosterRow,
	type AdminLawyerRosterSort,
	type AdminLawyerSummaryKey,
	type AdminLawyerVerificationStatusFilter,
	formatAdminEnum,
	formatLawyerProfileKind,
	formatLawyerUrgencyLabel,
	getLawyerRosterFilterFromSummaryCard,
} from "./admin-lawyers-model";
import { InvitePlatformLawyerDialog } from "./InvitePlatformLawyerDialog";

const DEFAULT_FILTERS: AdminLawyerRosterFilters = {
	capacitySla: "all",
	invitationStatus: "all",
	platformStatus: "all",
	profileKind: "all",
	urgency: "all",
	verificationStatus: "all",
};

const SUMMARY_CARDS: readonly {
	readonly key: AdminLawyerSummaryKey;
	readonly label: string;
}[] = [
	{ key: "needsAction", label: "Needs action" },
	{ key: "identityRepairs", label: "Identity repairs" },
	{ key: "slaBreached", label: "SLA breached" },
	{ key: "invitationsExpiring", label: "Invitations expiring" },
	{ key: "verificationReview", label: "Verification review" },
	{ key: "atCapacity", label: "At capacity" },
	{ key: "restrictionRecheckDue", label: "Recheck due" },
];

export function AdminLawyersPage() {
	const [filters, setFilters] =
		useState<AdminLawyerRosterFilters>(DEFAULT_FILTERS);
	const [search, setSearch] = useState("");
	const [pageCursor, setPageCursor] = useState<number | null>(null);
	const [cursorStack, setCursorStack] = useState<(number | null)[]>([null]);
	const [currentPage, setCurrentPage] = useState(1);
	const [sort, setSort] = useState<AdminLawyerRosterSort>("urgency");
	const [inviteOpen, setInviteOpen] = useState(false);
	const [repairKey, setRepairKey] = useState<string | null>(null);
	const [selectedRepairKey, setSelectedRepairKey] = useState<string | null>(
		null
	);
	const [selectedProfileId, setSelectedProfileId] =
		useState<Id<"lawyerProfiles"> | null>(null);
	const rosterArgs = useMemo(
		() => ({
			filters,
			pagination: { cursor: pageCursor, pageSize: 25 },
			search,
			sort,
		}),
		[filters, pageCursor, search, sort]
	);
	const roster = useQuery(
		api.legalRepresentation.adminLawyers.listLawyerRosterPage,
		rosterArgs
	) as AdminLawyerRosterResult | undefined;
	const repairPreview = useQuery(
		api.legalRepresentation.adminLawyers.getLawyerProfileRepairPreview,
		repairKey ? { repairKey } : "skip"
	) as AdminLawyerProfileRepairPreviewResult | undefined;
	const selectedRepairPreview = useQuery(
		api.legalRepresentation.adminLawyers.getLawyerProfileRepairPreview,
		selectedRepairKey ? { repairKey: selectedRepairKey } : "skip"
	) as AdminLawyerProfileRepairPreviewResult | undefined;
	const repairProfileIdentity = useMutation(
		api.legalRepresentation.adminLawyers.repairLawyerProfileIdentity
	);

	function resetPagination() {
		setCurrentPage(1);
		setPageCursor(null);
		setCursorStack([null]);
	}

	function updateFilter<K extends keyof AdminLawyerRosterFilters>(
		key: K,
		value: AdminLawyerRosterFilters[K]
	) {
		resetPagination();
		setFilters((current) => ({ ...current, [key]: value }));
	}

	return (
		<div className="flex min-h-0 flex-col gap-4 p-6">
			<header className="flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl text-foreground">
						Lawyer Operations
					</h1>
					<p className="mt-1 max-w-3xl text-muted-foreground text-sm">
						Roster-first legal operations for platform and guest lawyers.
					</p>
				</div>
				<button
					className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm shadow-sm hover:bg-primary/90"
					onClick={() => setInviteOpen(true)}
					type="button"
				>
					<UserPlus aria-hidden="true" className="size-4" />
					Invite platform lawyer
				</button>
			</header>

			<div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
				{SUMMARY_CARDS.map((card) => (
					<SummaryButton
						count={roster?.summary[card.key] ?? 0}
						key={card.key}
						label={card.label}
						onClick={() => {
							resetPagination();
							setFilters({
								...DEFAULT_FILTERS,
								...getLawyerRosterFilterFromSummaryCard(card.key),
							});
						}}
					/>
				))}
			</div>

			<div className="flex flex-wrap items-center gap-2 rounded-md border bg-background p-2">
				<label className="relative min-w-64 flex-1 text-sm">
					<Search
						aria-hidden="true"
						className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<span className="sr-only">Search lawyers</span>
					<input
						aria-label="Search lawyers"
						className="h-9 w-full rounded-md border bg-background pr-3 pl-9 text-sm outline-none focus:ring-2 focus:ring-ring"
						onChange={(event) => {
							resetPagination();
							setSearch(event.target.value);
						}}
						placeholder="Search lawyers"
						value={search}
					/>
				</label>
				<FilterSelect
					label="Profile kind"
					onChange={(value) =>
						updateFilter("profileKind", value as AdminLawyerProfileKind)
					}
					options={[
						["all", "All profiles"],
						["platform", "Platform"],
						["guest", "Guest"],
						["both", "Hybrid"],
					]}
					value={filters.profileKind}
				/>
				<FilterSelect
					label="Platform status"
					onChange={(value) =>
						updateFilter(
							"platformStatus",
							value as AdminLawyerPlatformStatusFilter
						)
					}
					options={[
						["all", "All platform states"],
						["active", "Active"],
						["invited", "Invited"],
						["requires_review", "Requires review"],
						["suspended", "Suspended"],
						["offboarded", "Offboarded"],
						["not_platform", "Not platform"],
					]}
					value={filters.platformStatus ?? "all"}
				/>
				<FilterSelect
					label="Urgency"
					onChange={(value) => updateFilter("urgency", value as never)}
					options={[
						["all", "All urgency"],
						["sla_breached", "SLA breached"],
						["representation_override_needed", "Override needed"],
						["verification_requires_review", "Verification review"],
						["invitation_expiring", "Invitation expiring"],
						["restriction_recheck_due", "Recheck due"],
						["at_capacity", "At capacity"],
						["pending_onboarding", "Pending onboarding"],
						["normal", "Normal"],
					]}
					value={filters.urgency}
				/>
				<FilterSelect
					label="Verification"
					onChange={(value) =>
						updateFilter(
							"verificationStatus",
							value as AdminLawyerVerificationStatusFilter
						)
					}
					options={[
						["all", "All verification"],
						["eligible", "Eligible"],
						["requires_review", "Requires review"],
						["ineligible", "Ineligible"],
						["failed", "Failed"],
						["not_verified", "Not verified"],
					]}
					value={filters.verificationStatus ?? "all"}
				/>
				<FilterSelect
					label="Invitation"
					onChange={(value) =>
						updateFilter(
							"invitationStatus",
							value as AdminLawyerInvitationStatusFilter
						)
					}
					options={[
						["all", "All invitations"],
						["pending", "Pending"],
						["accepted", "Accepted"],
						["verified", "Verified"],
						["expired", "Expired"],
						["revoked", "Revoked"],
						["sent", "Sent"],
						["canceled", "Canceled"],
						["failed", "Failed"],
						["none", "None"],
					]}
					value={filters.invitationStatus ?? "all"}
				/>
				<FilterSelect
					label="Sort"
					onChange={(value) => {
						resetPagination();
						setSort(value as AdminLawyerRosterSort);
					}}
					options={[
						["urgency", "Urgency"],
						["latest_activity", "Latest activity"],
						["name", "Name"],
					]}
					value={sort}
				/>
			</div>

			<section
				className="max-h-[560px] min-h-[320px] overflow-auto rounded-md border bg-background"
				data-testid="admin-lawyers-roster-region"
			>
				<table className="w-full min-w-[1280px] text-sm">
					<thead className="sticky top-0 bg-muted/70 text-left text-muted-foreground text-xs uppercase tracking-normal backdrop-blur">
						<tr>
							<th className="p-3 font-medium">Lawyer</th>
							<th className="p-3 font-medium">License</th>
							<th className="p-3 font-medium">Kind</th>
							<th className="p-3 font-medium">Platform</th>
							<th className="p-3 font-medium">Verification</th>
							<th className="p-3 font-medium">Invitation</th>
							<th className="p-3 font-medium">Urgency</th>
							<th className="p-3 font-medium">Next action</th>
							<th className="p-3 font-medium">Active deals</th>
							<th className="p-3 font-medium">Deal invites</th>
							<th className="p-3 font-medium">Past deals</th>
							<th className="p-3 font-medium">Panel capacity</th>
							<th className="p-3 font-medium">Latest activity</th>
						</tr>
					</thead>
					<tbody>
						{roster?.rows.map((row) => (
							<LawyerRosterTableRow
								key={row.rowKey}
								onOpen={() => {
									if (row.profileId) {
										setSelectedProfileId(row.profileId);
										return;
									}
									if (row.identityRepair) {
										setSelectedRepairKey(row.identityRepair.repairKey);
									}
								}}
								onRepair={(repairKey) => {
									setRepairKey(repairKey);
								}}
								row={row}
							/>
						))}
						{roster && roster.rows.length === 0 ? (
							<tr>
								<td
									className="p-6 text-center text-muted-foreground"
									colSpan={11}
								>
									No lawyers match the current filters.
								</td>
							</tr>
						) : null}
					</tbody>
				</table>
			</section>

			<div className="flex items-center justify-between text-muted-foreground text-sm">
				<span>Page {currentPage}</span>
				<div className="flex items-center gap-3">
					<span>{roster?.totalCount ?? 0} lawyers</span>
					<div className="flex items-center gap-1">
						<button
							aria-label="Previous page"
							className="inline-flex size-8 items-center justify-center rounded-md border disabled:opacity-40"
							disabled={currentPage === 1}
							onClick={() => {
								const previousStack = cursorStack.slice(0, -1);
								const previousCursor = previousStack.at(-1) ?? null;
								setCursorStack(previousStack.length ? previousStack : [null]);
								setPageCursor(previousCursor);
								setCurrentPage((page) => Math.max(1, page - 1));
							}}
							type="button"
						>
							<ChevronLeft aria-hidden="true" className="size-4" />
						</button>
						<button
							aria-label="Next page"
							className="inline-flex size-8 items-center justify-center rounded-md border disabled:opacity-40"
							disabled={!roster?.nextCursor}
							onClick={() => {
								if (roster?.nextCursor) {
									setCurrentPage((page) => page + 1);
									setCursorStack((stack) => [...stack, roster.nextCursor]);
									setPageCursor(roster.nextCursor);
								}
							}}
							type="button"
						>
							<ChevronRight aria-hidden="true" className="size-4" />
						</button>
					</div>
				</div>
			</div>

			<AdminLawyersDetailSheet
				onOpenChange={(open) => {
					if (!open) {
						setSelectedProfileId(null);
					}
				}}
				profileId={selectedProfileId}
			/>
			<MissingLawyerIdentityDetailSheet
				onOpenChange={(open) => {
					if (!open) {
						setSelectedRepairKey(null);
					}
				}}
				onRepair={(nextRepairKey) => {
					setSelectedRepairKey(null);
					setRepairKey(nextRepairKey);
				}}
				open={Boolean(selectedRepairKey)}
				preview={selectedRepairPreview}
			/>
			<LawyerIdentityRepairDialog
				onOpenChange={(open) => {
					if (!open) {
						setRepairKey(null);
					}
				}}
				onRepair={(overrides) => {
					if (!repairKey) {
						return;
					}
					void repairProfileIdentity({
						overrides,
						repairKey,
					});
					setRepairKey(null);
				}}
				open={Boolean(repairKey)}
				preview={repairPreview}
			/>
			<InvitePlatformLawyerDialog
				onOpenChange={setInviteOpen}
				open={inviteOpen}
			/>
		</div>
	);
}

function FilterSelect(props: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly options: readonly (readonly [string, string])[];
	readonly value: string;
}) {
	return (
		<label className="text-muted-foreground text-xs">
			<span className="sr-only">{props.label}</span>
			<select
				aria-label={props.label}
				className="h-9 rounded-md border bg-background px-3 text-foreground text-sm"
				onChange={(event) => props.onChange(event.target.value)}
				value={props.value}
			>
				{props.options.map(([value, label]) => (
					<option key={value} value={value}>
						{label}
					</option>
				))}
			</select>
		</label>
	);
}

function MissingLawyerIdentityDetailSheet(props: {
	readonly onOpenChange: (open: boolean) => void;
	readonly onRepair: (repairKey: string) => void;
	readonly open: boolean;
	readonly preview: AdminLawyerProfileRepairPreviewResult | undefined;
}) {
	if (!props.open) {
		return null;
	}

	const preview = props.preview;
	const suggested = preview?.suggestedProfile;

	return (
		<div aria-label="Missing lawyer identity" aria-modal="true" role="dialog">
			<div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l bg-background shadow-xl">
				<header className="flex items-start justify-between gap-3 border-b p-5">
					<div>
						<h2 className="font-semibold text-xl">
							{suggested?.displayName ?? "Missing lawyer identity"}
						</h2>
						<p className="text-muted-foreground text-sm">
							{suggested?.email ?? "Missing email"}
						</p>
					</div>
					<button
						aria-label="Close missing lawyer identity"
						className="inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
						onClick={() => props.onOpenChange(false)}
						type="button"
					>
						<X aria-hidden="true" className="size-4" />
					</button>
				</header>
				<div className="flex-1 space-y-5 overflow-auto p-5">
					{preview ? (
						<>
							<section>
								<h3 className="font-medium">Repair preview</h3>
								<div className="mt-2 grid grid-cols-2 gap-2 text-sm">
									<RepairSnapshot
										label="Name"
										value={suggested?.displayName ?? "Missing"}
									/>
									<RepairSnapshot
										label="Email"
										value={suggested?.email ?? "Missing"}
									/>
									<RepairSnapshot
										label="Firm"
										value={suggested?.firmName ?? "None"}
									/>
									<RepairSnapshot
										label="License"
										value={suggested?.barNumber ?? "Missing"}
									/>
									<RepairSnapshot
										label="Jurisdiction"
										value={suggested?.jurisdiction ?? "Missing"}
									/>
									<RepairSnapshot
										label="LSO profile"
										value={suggested?.lsoLawyerId ?? "Not linked"}
									/>
								</div>
							</section>
							{preview.warnings.length > 0 ? (
								<div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-amber-950 text-sm dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100">
									{preview.warnings.join(" ")}
								</div>
							) : null}
							<section>
								<h3 className="font-medium">Linked evidence</h3>
								<div className="mt-2 divide-y rounded-md border">
									{preview.evidenceRecords.map((record) => (
										<div className="p-3 text-sm" key={record.recordId}>
											<div className="flex flex-wrap items-center justify-between gap-2">
												<span className="font-medium">{record.label}</span>
												<span className="text-muted-foreground text-xs">
													{record.table} / {record.recordId}
												</span>
											</div>
											<p className="mt-1 text-muted-foreground text-xs">
												{record.summary}
											</p>
										</div>
									))}
								</div>
							</section>
							<Button
								onClick={() => props.onRepair(preview.candidate.repairKey)}
								type="button"
							>
								Repair identity
							</Button>
						</>
					) : (
						<p className="text-muted-foreground text-sm">
							Loading lawyer identity evidence...
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

function RepairSnapshot(props: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="rounded-md border p-2">
			<span className="block text-muted-foreground text-xs">{props.label}</span>
			<span className="break-words">{props.value}</span>
		</div>
	);
}

function LawyerIdentityRepairDialog(props: {
	readonly onOpenChange: (open: boolean) => void;
	readonly onRepair: (overrides: {
		readonly barNumber?: string;
		readonly displayName?: string;
		readonly email?: string;
		readonly firmName?: string;
		readonly jurisdiction?: string;
		readonly lsoLawyerId?: Id<"lsoLawyers">;
	}) => void;
	readonly open: boolean;
	readonly preview: AdminLawyerProfileRepairPreviewResult | undefined;
}) {
	const suggested = props.preview?.suggestedProfile;
	const [displayName, setDisplayName] = useState("");
	const [email, setEmail] = useState("");
	const [firmName, setFirmName] = useState("");
	const [barNumber, setBarNumber] = useState("");
	const [jurisdiction, setJurisdiction] = useState("");
	const [lsoLawyerId, setLsoLawyerId] = useState("");
	const suggestedDisplayName = suggested?.displayName ?? "";
	const suggestedEmail = suggested?.email ?? "";
	const suggestedFirmName = suggested?.firmName ?? "";
	const suggestedBarNumber = suggested?.barNumber ?? "";
	const suggestedJurisdiction = suggested?.jurisdiction ?? "";
	const suggestedLsoLawyerId = suggested?.lsoLawyerId ?? "";
	const hasSuggestedProfile = Boolean(suggested);

	useEffect(() => {
		if (!hasSuggestedProfile) {
			return;
		}
		setDisplayName(suggestedDisplayName);
		setEmail(suggestedEmail);
		setFirmName(suggestedFirmName);
		setBarNumber(suggestedBarNumber);
		setJurisdiction(suggestedJurisdiction);
		setLsoLawyerId(suggestedLsoLawyerId);
	}, [
		suggestedBarNumber,
		suggestedDisplayName,
		suggestedEmail,
		suggestedFirmName,
		hasSuggestedProfile,
		suggestedJurisdiction,
		suggestedLsoLawyerId,
	]);

	if (!props.open) {
		return null;
	}

	return (
		<div aria-label="Repair lawyer identity" aria-modal="true" role="dialog">
			<button
				aria-label="Close repair lawyer identity"
				className="fixed inset-0 z-40 bg-background/80"
				onClick={() => props.onOpenChange(false)}
				type="button"
			/>
			<div className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-md border bg-background p-6 shadow-xl">
				<div>
					<h2 className="font-semibold text-lg">Repair lawyer identity</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						Review the evidence and the profile that will be created or linked
						before applying the repair.
					</p>
				</div>
				{props.preview ? (
					<div className="mt-5 grid gap-5">
						{props.preview.warnings.length > 0 ? (
							<div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-amber-950 text-sm dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100">
								{props.preview.warnings.join(" ")}
							</div>
						) : null}
						<div className="grid gap-3 sm:grid-cols-2">
							<RepairInput
								label="Display name"
								onChange={setDisplayName}
								value={displayName}
							/>
							<RepairInput label="Email" onChange={setEmail} value={email} />
							<RepairInput
								label="Firm"
								onChange={setFirmName}
								value={firmName}
							/>
							<RepairInput
								label="Bar number"
								onChange={setBarNumber}
								value={barNumber}
							/>
							<RepairInput
								label="Jurisdiction"
								onChange={setJurisdiction}
								value={jurisdiction}
							/>
							<RepairInput
								label="LSO lawyer ID"
								onChange={setLsoLawyerId}
								value={lsoLawyerId}
							/>
						</div>
						<section>
							<h3 className="font-medium text-sm">Evidence</h3>
							<div className="mt-2 divide-y rounded-md border">
								{props.preview.evidenceRecords.map((record) => (
									<div className="p-3 text-sm" key={record.recordId}>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className="font-medium">{record.label}</span>
											<span className="text-muted-foreground text-xs">
												{record.table} / {record.recordId}
											</span>
										</div>
										<p className="mt-1 text-muted-foreground text-xs">
											{record.summary}
										</p>
									</div>
								))}
							</div>
						</section>
					</div>
				) : (
					<p className="text-muted-foreground text-sm">
						Loading repair preview...
					</p>
				)}
				<div className="mt-5 flex justify-end gap-2">
					<Button
						onClick={() => props.onOpenChange(false)}
						type="button"
						variant="outline"
					>
						Close
					</Button>
					<Button
						disabled={!props.preview}
						onClick={() => {
							const lsoOverride = lsoLawyerId.trim();
							props.onRepair({
								barNumber: barNumber.trim() || undefined,
								displayName: displayName.trim() || undefined,
								email: email.trim() || undefined,
								firmName: firmName.trim() || undefined,
								jurisdiction: jurisdiction.trim() || undefined,
								...(lsoOverride
									? { lsoLawyerId: lsoOverride as Id<"lsoLawyers"> }
									: {}),
							});
						}}
						type="button"
					>
						Apply repair
					</Button>
				</div>
			</div>
		</div>
	);
}

function RepairInput(props: {
	readonly label: string;
	readonly onChange: (value: string) => void;
	readonly value: string;
}) {
	const id = `repair-${props.label.toLowerCase().replaceAll(" ", "-")}`;
	return (
		<div className="grid gap-2">
			<Label htmlFor={id}>{props.label}</Label>
			<Input
				id={id}
				onChange={(event) => props.onChange(event.target.value)}
				onInput={(event) => props.onChange(event.currentTarget.value)}
				value={props.value}
			/>
		</div>
	);
}

function SummaryButton(props: {
	readonly count: number;
	readonly label: string;
	readonly onClick: () => void;
}) {
	return (
		<button
			className="rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
			onClick={props.onClick}
			type="button"
		>
			<span className="block text-muted-foreground">{props.label}</span>
			<strong className="text-foreground text-lg">{props.count}</strong>
		</button>
	);
}

function LawyerRosterTableRow(props: {
	readonly onOpen: () => void;
	readonly onRepair: (repairKey: string) => void;
	readonly row: AdminLawyerRosterRow;
}) {
	const license =
		props.row.barNumber || props.row.jurisdiction
			? `${props.row.barNumber ?? "No bar"} / ${props.row.jurisdiction ?? "No jurisdiction"}`
			: "Missing";
	return (
		<tr
			className="cursor-pointer border-t hover:bg-muted/40"
			onClick={props.onOpen}
		>
			<td className="p-3">
				<button
					aria-label={`Open ${props.row.displayName}`}
					className="text-left hover:text-primary"
					onClick={(event) => {
						event.stopPropagation();
						props.onOpen();
					}}
					type="button"
				>
					<span className="font-medium">{props.row.displayName}</span>
					<span className="block text-muted-foreground text-xs">
						{props.row.email}
					</span>
					{props.row.identityStatus === "missing_profile" ? (
						<span className="mt-1 inline-flex items-center gap-1 rounded-md border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-amber-900 text-xs dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
							<AlertTriangle aria-hidden="true" className="size-3" />
							Missing lawyer identity
						</span>
					) : null}
					{props.row.firmName ? (
						<span className="block text-muted-foreground text-xs">
							{props.row.firmName}
						</span>
					) : null}
				</button>
			</td>
			<td className="p-3">{license}</td>
			<td className="p-3">{formatLawyerProfileKind(props.row.profileKind)}</td>
			<td className="p-3">
				<span>{formatAdminEnum(props.row.platformStatus)}</span>
				{props.row.platformOnboardingSession ? (
					<span className="block text-muted-foreground text-xs">
						Onboarding{" "}
						{formatAdminEnum(props.row.platformOnboardingSession.status)}
					</span>
				) : null}
			</td>
			<td className="p-3">{formatAdminEnum(props.row.verificationStatus)}</td>
			<td className="p-3">{formatAdminEnum(props.row.invitationStatus)}</td>
			<td className="p-3">{formatLawyerUrgencyLabel(props.row.urgency)}</td>
			<td className="p-3">
				{props.row.identityRepair ? (
					<div className="flex flex-col items-start gap-1">
						<span>{props.row.nextAction}</span>
						<button
							className="inline-flex items-center gap-1 rounded-md bg-amber-900 px-2 py-1 font-medium text-amber-50 text-xs hover:bg-amber-800 dark:bg-amber-200 dark:text-amber-950"
							onClick={(event) => {
								event.stopPropagation();
								props.onRepair(props.row.identityRepair?.repairKey ?? "");
							}}
							type="button"
						>
							<UserCheck aria-hidden="true" className="size-3" />
							Repair identity
						</button>
						<span className="text-muted-foreground text-xs">
							{props.row.identityRepair.totalEvidenceRecords} linked records
						</span>
					</div>
				) : (
					props.row.nextAction
				)}
			</td>
			<td className="p-3">{props.row.activeDealCount}</td>
			<td className="p-3">{props.row.pendingDealInviteCount}</td>
			<td className="p-3">{props.row.pastDealCount}</td>
			<td className="p-3">{panelCapacityLabel(props.row)}</td>
			<td className="p-3">
				{new Date(props.row.latestActivityAt).toLocaleDateString()}
			</td>
		</tr>
	);
}

function panelCapacityLabel(row: AdminLawyerRosterRow) {
	if (row.profileKind === "guest" || row.platformStatus === "not_platform") {
		return "N/A";
	}
	return row.capacityLimit === null
		? "No panel assignment"
		: `${row.activeDealCount}/${row.capacityLimit}`;
}
