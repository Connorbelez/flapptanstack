"use client";

import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ExternalLink } from "lucide-react";
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
import { api } from "../../../convex/_generated/api";

export function PublishedDealDocumentsPage() {
	const rows = useQuery(api.documents.dealPackages.listPublishedDealDocuments);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Published Deal Documents</CardTitle>
				<CardDescription>
					Generated and static documents materialized for locked deals.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Document</TableHead>
							<TableHead>Package</TableHead>
							<TableHead>Deal</TableHead>
							<TableHead>Mortgage</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Signing</TableHead>
							<TableHead>Document</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows?.map((row) => (
							<TableRow key={row.instanceId}>
								<TableCell className="font-medium">{row.displayName}</TableCell>
								<TableCell>
									<Badge variant="secondary">
										{row.packageStatus ?? "unknown"}
									</Badge>
								</TableCell>
								<TableCell>
									<code className="text-xs">{String(row.dealId)}</code>
								</TableCell>
								<TableCell>
									<code className="text-xs">{String(row.mortgageId)}</code>
								</TableCell>
								<TableCell>{row.status}</TableCell>
								<TableCell>{row.signingStatus ?? "not applicable"}</TableCell>
								<TableCell>
									{row.documentUrl ? (
										<a
											className="inline-flex items-center gap-1 text-primary text-sm"
											href={row.documentUrl}
											rel="noreferrer"
											target="_blank"
										>
											Open
											<ExternalLink className="size-3" />
										</a>
									) : (
										<span className="text-muted-foreground text-sm">None</span>
									)}
								</TableCell>
								<TableCell className="text-right">
									<Link
										params={{ recordid: row.dealId }}
										search={{
											detailOpen: false,
											entityType: undefined,
											recordId: undefined,
										}}
										to="/admin/deals/$recordid"
									>
										<Button size="sm" variant="outline">
											Open deal
										</Button>
									</Link>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
