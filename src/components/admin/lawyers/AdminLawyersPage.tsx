import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, Search, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { AdminLawyersDetailSheet } from "./AdminLawyersDetailSheet";
import {
	type AdminLawyerInvitationStatusFilter,
	type AdminLawyerPlatformStatusFilter,
	type AdminLawyerProfileKind,
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
				<table className="w-full min-w-[1120px] text-sm">
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
							<th className="p-3 font-medium">Deals</th>
							<th className="p-3 font-medium">Capacity</th>
							<th className="p-3 font-medium">Latest activity</th>
						</tr>
					</thead>
					<tbody>
						{roster?.rows.map((row) => (
							<LawyerRosterTableRow
								key={row.profileId}
								onOpen={() => setSelectedProfileId(row.profileId)}
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
	readonly row: AdminLawyerRosterRow;
}) {
	const license =
		props.row.barNumber || props.row.jurisdiction
			? `${props.row.barNumber ?? "No bar"} / ${props.row.jurisdiction ?? "No jurisdiction"}`
			: "Missing";
	return (
		<tr className="border-t hover:bg-muted/40">
			<td className="p-3">
				<button
					aria-label={`Open ${props.row.displayName}`}
					className="text-left hover:text-primary"
					onClick={props.onOpen}
					type="button"
				>
					<span className="font-medium">{props.row.displayName}</span>
					<span className="block text-muted-foreground text-xs">
						{props.row.email}
					</span>
					{props.row.firmName ? (
						<span className="block text-muted-foreground text-xs">
							{props.row.firmName}
						</span>
					) : null}
				</button>
			</td>
			<td className="p-3">{license}</td>
			<td className="p-3">{formatLawyerProfileKind(props.row.profileKind)}</td>
			<td className="p-3">{formatAdminEnum(props.row.platformStatus)}</td>
			<td className="p-3">{formatAdminEnum(props.row.verificationStatus)}</td>
			<td className="p-3">{formatAdminEnum(props.row.invitationStatus)}</td>
			<td className="p-3">{formatLawyerUrgencyLabel(props.row.urgency)}</td>
			<td className="p-3">{props.row.nextAction}</td>
			<td className="p-3">{props.row.activeDealCount}</td>
			<td className="p-3">
				{props.row.capacityLimit === null
					? "Unassigned"
					: `${props.row.activeDealCount}/${props.row.capacityLimit}`}
			</td>
			<td className="p-3">
				{new Date(props.row.latestActivityAt).toLocaleDateString()}
			</td>
		</tr>
	);
}
