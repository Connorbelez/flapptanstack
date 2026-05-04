"use client";

import { useQuery } from "convex/react";
import { Badge } from "#/components/ui/badge";
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

export function PublishedTemplatesPage() {
	const versions = useQuery(api.documentEngine.templateVersions.listAll);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Published Templates</CardTitle>
				<CardDescription>
					Immutable template versions remain available after newer publishes.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Template</TableHead>
							<TableHead>Version</TableHead>
							<TableHead>Fields</TableHead>
							<TableHead>Signatories</TableHead>
							<TableHead>Published By</TableHead>
							<TableHead>Published At</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{versions?.map((version) => (
							<TableRow key={version._id}>
								<TableCell className="font-medium">
									{version.templateName}
								</TableCell>
								<TableCell>
									<Badge variant="secondary">v{version.version}</Badge>
								</TableCell>
								<TableCell>{version.snapshot.fields.length}</TableCell>
								<TableCell>{version.snapshot.signatories.length}</TableCell>
								<TableCell>{version.publishedBy ?? "System"}</TableCell>
								<TableCell>
									{new Date(version.publishedAt).toLocaleString()}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
