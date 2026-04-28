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
import { api } from "../../../convex/_generated/api";

interface PackageVariableMatrixProps {
	requiredVariableKeys: readonly string[];
}

export function PackageVariableMatrix({
	requiredVariableKeys,
}: PackageVariableMatrixProps) {
	const variables = useQuery(api.documentEngine.systemVariables.list);
	const variablesByKey = new Map(
		(variables ?? []).map((variable) => [variable.key, variable])
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Package Variables</CardTitle>
				<CardDescription>
					System variables expected across every document in this package.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{requiredVariableKeys.length === 0 ? (
					<p className="text-muted-foreground text-sm">
						No interpolated variables are required by the current package items.
					</p>
				) : (
					<div className="divide-y rounded-md border">
						{requiredVariableKeys.map((key) => {
							const variable = variablesByKey.get(key);
							return (
								<div
									className="grid gap-2 p-3 md:grid-cols-[1fr_140px_160px] md:items-center"
									key={key}
								>
									<div>
										<code className="font-mono text-sm">{key}</code>
										<p className="text-muted-foreground text-xs">
											{variable?.description ?? "Variable metadata unavailable"}
										</p>
									</div>
									<Badge className="w-fit" variant="secondary">
										{variable?.type ?? "unknown"}
									</Badge>
									<Badge className="w-fit" variant="outline">
										{variable?.availability ?? "custom"}
									</Badge>
								</div>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
