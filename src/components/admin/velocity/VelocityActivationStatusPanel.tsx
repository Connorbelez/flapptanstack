"use client";

import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import type { VelocityWorkspaceDetail } from "./types";

type ActivationAttempt = VelocityWorkspaceDetail["activationAttempt"];

const IN_FLIGHT_STATUSES = new Set([
	"queued",
	"validating",
	"creating_rotessa_customer",
	"creating_rotessa_schedule",
	"creating_canonical_mortgage",
]);

function formatDateTime(value: number | null | undefined) {
	if (value == null) {
		return "Not available";
	}
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

function statusTone(attempt: ActivationAttempt) {
	if (!attempt) {
		return "border-border bg-muted text-muted-foreground";
	}
	if (attempt.status === "succeeded") {
		return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
	}
	if (attempt.status === "failed") {
		return "border-destructive/40 bg-destructive/10 text-destructive";
	}
	return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";
}

export function isVelocityActivationInFlight(attempt: ActivationAttempt) {
	return attempt ? IN_FLIGHT_STATUSES.has(attempt.status) : false;
}

export function VelocityActivationStatusPanel({
	attempt,
	canRetry,
	isRetrying,
	onRetry,
}: {
	readonly attempt: ActivationAttempt;
	readonly canRetry: boolean;
	readonly isRetrying: boolean;
	readonly onRetry: () => void;
}) {
	const isFailed = attempt?.status === "failed";
	const isSucceeded = attempt?.status === "succeeded";
	const isInFlight = isVelocityActivationInFlight(attempt);

	return (
		<Card className="border-border/70">
			<CardHeader className="gap-3 md:flex-row md:items-start md:justify-between">
				<div>
					<CardTitle>Activation status</CardTitle>
					<p className="mt-1 text-muted-foreground text-sm">
						Latest backend activation attempt and remediation context.
					</p>
				</div>
				<Badge className={cn("border", statusTone(attempt))} variant="outline">
					{attempt ? formatState(attempt.status) : "No attempt"}
				</Badge>
			</CardHeader>
			<CardContent className="space-y-4">
				{attempt ? (
					<>
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
							<ActivationField
								label="Attempt ID"
								value={attempt.activationAttemptId}
							/>
							<ActivationField
								label="Started"
								value={formatDateTime(attempt.startedAt)}
							/>
							<ActivationField
								label="Completed"
								value={formatDateTime(attempt.completedAt)}
							/>
							<ActivationField
								label="Failed"
								value={formatDateTime(attempt.failedAt)}
							/>
							<ActivationField
								label="Reviewed snapshot"
								value={attempt.reviewedSnapshotId}
							/>
							<ActivationField
								label="Reviewed hash"
								value={attempt.reviewedSnapshotHash}
							/>
							<ActivationField
								label="Rotessa customer"
								value={attempt.rotessaCustomerRef}
							/>
							<ActivationField
								label="Rotessa schedule"
								value={attempt.rotessaScheduleRef}
							/>
						</div>

						{isFailed ? (
							<div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-destructive">
								<div className="flex items-start gap-2">
									<AlertTriangle className="mt-0.5 size-4 shrink-0" />
									<div>
										<p className="font-medium text-sm">
											{attempt.failureCode
												? formatState(attempt.failureCode)
												: "Activation failed"}
										</p>
										<p className="mt-1 text-sm">
											{attempt.failureMessage ??
												"The backend did not provide a failure message."}
										</p>
									</div>
								</div>
								<Button
									className="mt-4"
									disabled={!canRetry || isRetrying}
									onClick={onRetry}
									variant="outline"
								>
									<RefreshCw
										className={cn("mr-2 size-4", isRetrying && "animate-spin")}
									/>
									{isRetrying ? "Retrying..." : "Retry activation"}
								</Button>
							</div>
						) : null}

						{isInFlight ? (
							<div className="rounded-md border border-blue-300 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
								<div className="flex items-center gap-2">
									<RefreshCw className="size-4 animate-spin" />
									<p className="font-medium text-sm">
										Activation is running in the backend.
									</p>
								</div>
							</div>
						) : null}

						{isSucceeded ? (
							<div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
								<div className="flex items-start gap-2">
									<CheckCircle2 className="mt-0.5 size-4 shrink-0" />
									<div>
										<p className="font-medium text-sm">
											Velocity package activated.
										</p>
										<p className="mt-1 text-sm">
											Mortgage {attempt.mortgageId ?? "not linked"} and listing{" "}
											{attempt.listingId ?? "not linked"}.
										</p>
									</div>
								</div>
							</div>
						) : null}
					</>
				) : (
					<p className="text-muted-foreground text-sm">
						No activation attempt has been started for this package.
					</p>
				)}
			</CardContent>
		</Card>
	);
}

function ActivationField({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string | number | null | undefined;
}) {
	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 break-all font-medium text-sm">
				{value == null || value === "" ? "Not available" : String(value)}
			</p>
		</div>
	);
}
