"use client";

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { AdminPageSkeleton } from "#/components/admin/shell/AdminRouteStates";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { api } from "../../../../convex/_generated/api";

export function AdminMicInvestorRequestsPage() {
	const requests = useQuery(api.micInvestorAccess.queries.listRequests, {
		status: "pending_review",
	});
	const approve = useMutation(api.micInvestorAccess.mutations.approveRequest);
	const reject = useMutation(api.micInvestorAccess.mutations.rejectRequest);

	if (!requests) {
		return <AdminPageSkeleton />;
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-start justify-between gap-3">
					<div>
						<CardTitle>MIC investor access requests</CardTitle>
						<CardDescription>
							Review public requests for MIC materials and portal access.
						</CardDescription>
					</div>
					<Badge variant="outline">
						{requests.length} {requests.length === 1 ? "request" : "requests"}
					</Badge>
				</div>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Email</TableHead>
							<TableHead>Portal</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Provisioning</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{requests.map(({ portal, request }) => (
							<TableRow key={String(request._id)}>
								<TableCell>{request.email}</TableCell>
								<TableCell>{portal?.slug ?? "unknown"}</TableCell>
								<TableCell>{request.status}</TableCell>
								<TableCell>{request.provisioningState}</TableCell>
								<TableCell className="text-right">
									<div className="flex justify-end gap-2">
										<Button
											onClick={async () => {
												await approve({ requestId: request._id });
												toast.success("MIC access approved.");
											}}
											size="sm"
										>
											Approve
										</Button>
										<Button
											onClick={async () => {
												await reject({
													rejectionReason: "Rejected by admin",
													requestId: request._id,
												});
												toast.success("MIC access rejected.");
											}}
											size="sm"
											variant="outline"
										>
											Reject
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
