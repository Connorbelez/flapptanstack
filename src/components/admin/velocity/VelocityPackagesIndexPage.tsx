"use client";

import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { useAdminBreadcrumbLabel } from "#/components/admin/shell/AdminPageMetadataContext";
import {
	AdminPageSkeleton,
	AdminTableSkeleton,
} from "#/components/admin/shell/AdminRouteStates";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { cn } from "#/lib/utils";
import { api } from "../../../../convex/_generated/api";
import type { VelocityBoardRow } from "./types";

function formatCurrency(value: number | null) {
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

function rowSearchText(row: VelocityBoardRow) {
	return [
		row.primaryBorrowerName,
		row.propertyAddress,
		row.loanCode,
		row.linkApplicationId,
		row.lenderReferenceNumber,
		row.currentVelocityStage.label,
		row.fairlendActionState,
		row.exception.summary,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

function readinessTone(row: VelocityBoardRow) {
	if (row.exception.hasOpenException) {
		return "border-destructive/40 bg-destructive/10 text-destructive";
	}
	if (row.readiness.blockerCount > 0) {
		return "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200";
	}
	if (row.readiness.canActivate) {
		return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
	}
	return "border-border bg-muted text-muted-foreground";
}

function readinessLabel(row: VelocityBoardRow) {
	if (row.readiness.canActivate) {
		return "Activation ready";
	}
	if (row.readiness.canFinalReview) {
		return "Review ready";
	}
	return `${row.readiness.blockerCount} blocker${
		row.readiness.blockerCount === 1 ? "" : "s"
	}`;
}

function ExceptionLane({ row }: { row: VelocityBoardRow }) {
	if (!row.exception.hasOpenException && row.readiness.blockerCount === 0) {
		return (
			<span className="text-muted-foreground text-sm">No active blockers</span>
		);
	}

	return (
		<div className="flex max-w-sm items-start gap-2">
			<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
			<div className="space-y-1">
				<p className="font-medium text-sm">
					{row.exception.summary ??
						`${row.readiness.blockerCount} readiness blocker${
							row.readiness.blockerCount === 1 ? "" : "s"
						}`}
				</p>
				{row.exception.kind ? (
					<p className="text-muted-foreground text-xs">
						{formatState(row.exception.kind)}
					</p>
				) : null}
			</div>
		</div>
	);
}

export function VelocityPackagesIndexPage() {
	const rows = useQuery(
		api.velocity.workspaces.listVelocityPackageWorkspaces,
		{}
	);
	const [search, setSearch] = useState("");
	const deferredSearch = useDeferredValue(search);

	useAdminBreadcrumbLabel("Velocity Packages");

	const filteredRows = useMemo(() => {
		if (!rows) {
			return [];
		}
		const query = deferredSearch.trim().toLowerCase();
		if (!query) {
			return rows;
		}
		return rows.filter((row) => rowSearchText(row).includes(query));
	}, [deferredSearch, rows]);

	const exceptionCount = rows?.filter(
		(row) => row.exception.hasOpenException
	).length;
	const blockerCount = rows?.reduce(
		(total, row) => total + row.readiness.blockerCount,
		0
	);

	if (rows === undefined) {
		return (
			<AdminPageSkeleton>
				<AdminTableSkeleton columnCount={7} rowCount={6} />
			</AdminPageSkeleton>
		);
	}

	return (
		<div className="space-y-6">
			<section className="flex flex-col gap-4 rounded-md border border-border/70 bg-card px-6 py-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
				<div className="space-y-2">
					<h1 className="font-semibold text-3xl tracking-tight">
						Velocity packages
					</h1>
					<p className="max-w-3xl text-muted-foreground text-sm">
						Monitor synced Velocity files, remediate FairLend-owned inputs, link
						package documents, and sync upstream state.
					</p>
				</div>
				<div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
					<div className="rounded-md border border-border/70 px-3 py-2">
						<p className="text-muted-foreground">Packages</p>
						<p className="font-semibold text-xl">{rows.length}</p>
					</div>
					<div className="rounded-md border border-border/70 px-3 py-2">
						<p className="text-muted-foreground">Exceptions</p>
						<p className="font-semibold text-xl">{exceptionCount ?? 0}</p>
					</div>
					<div className="rounded-md border border-border/70 px-3 py-2">
						<p className="text-muted-foreground">Blockers</p>
						<p className="font-semibold text-xl">{blockerCount ?? 0}</p>
					</div>
				</div>
			</section>

			<Card className="border-border/70">
				<CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
					<CardTitle>Package board</CardTitle>
					<div className="w-full max-w-sm space-y-2">
						<label className="font-medium text-sm" htmlFor="velocity-search">
							Search packages
						</label>
						<div className="relative">
							<Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="pl-9"
								id="velocity-search"
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Loan code, borrower, address, reference"
								value={search}
							/>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{filteredRows.length > 0 ? (
						<div className="overflow-hidden rounded-md border border-border/70">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Package</TableHead>
										<TableHead>Velocity stage</TableHead>
										<TableHead>FairLend action</TableHead>
										<TableHead>Readiness</TableHead>
										<TableHead>Remediation lane</TableHead>
										<TableHead>Updated</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{filteredRows.map((row) => (
										<TableRow key={row.workspaceId}>
											<TableCell>
												<div className="space-y-1">
													<p className="font-medium">
														{row.primaryBorrowerName}
													</p>
													<p className="text-muted-foreground text-xs">
														{row.propertyAddress ?? "No property address"}
													</p>
													<p className="text-muted-foreground text-xs">
														Loan {row.loanCode}
													</p>
												</div>
											</TableCell>
											<TableCell>
												<div className="space-y-1">
													<Badge variant="outline">
														{row.currentVelocityStage.label ?? "Unknown"}
													</Badge>
													<p className="text-muted-foreground text-xs">
														Code {row.currentVelocityStage.code ?? "n/a"}
													</p>
												</div>
											</TableCell>
											<TableCell>
												{formatState(row.fairlendActionState)}
											</TableCell>
											<TableCell>
												<Badge
													className={cn("border", readinessTone(row))}
													variant="outline"
												>
													{readinessLabel(row)}
												</Badge>
												<p className="mt-1 text-muted-foreground text-xs">
													{formatCurrency(row.requestedPrincipal)}
												</p>
											</TableCell>
											<TableCell>
												<ExceptionLane row={row} />
											</TableCell>
											<TableCell>{formatDateTime(row.updatedAt)}</TableCell>
											<TableCell className="text-right">
												<Button asChild size="sm" variant="outline">
													<Link
														params={{
															entitytype: "velocity",
															recordid: row.workspaceId,
														}}
														search={EMPTY_ADMIN_DETAIL_SEARCH}
														to="/admin/$entitytype/$recordid"
													>
														<ExternalLink className="mr-2 size-4" />
														Open
													</Link>
												</Button>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<div className="rounded-md border border-border/70 border-dashed px-6 py-12 text-center">
							<p className="font-medium text-lg">
								{search.trim()
									? "No Velocity packages match that search."
									: "No Velocity packages have synced yet."}
							</p>
							<p className="mt-2 text-muted-foreground text-sm">
								{search.trim()
									? "Try another borrower, address, loan code, or reference."
									: "Packages appear here after webhook or manual sync ingestion creates a workspace."}
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
