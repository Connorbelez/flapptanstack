"use client";

import { type ReactNode, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { useAdminRelationNavigation } from "#/hooks/useAdminRelationNavigation";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type {
	EntityViewAdapterContract,
	NormalizedFieldDefinition,
} from "../../../../convex/crm/types";
import { AdminKanbanBoard } from "./AdminKanbanBoard";
import {
	getAdminRecordSupportingText,
	getAdminRecordTitle,
	renderAdminFieldValue,
} from "./admin-view-rendering";
import type { AdminKanbanGroup, AdminViewColumn } from "./admin-view-types";
import { isRelationCellDisplayValue, RelationCell } from "./RelationCell";

type ObjectDef = Pick<Doc<"objectDefs">, "nativeTable" | "singularLabel">;

interface AdminEntityKanbanViewProps {
	readonly adapterContract: Pick<
		EntityViewAdapterContract,
		"entityType" | "titleFieldName"
	>;
	readonly columns: readonly AdminViewColumn[];
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly groups: readonly AdminKanbanGroup[];
	readonly objectDef: ObjectDef;
	readonly onSelectRecord?: (recordId: string) => void;
}

export function AdminEntityKanbanView({
	adapterContract,
	columns,
	fields,
	groups,
	objectDef,
	onSelectRecord,
}: AdminEntityKanbanViewProps) {
	const navigateRelation = useAdminRelationNavigation({
		presentation: "sheet",
	});
	const [expandedRelationCellKey, setExpandedRelationCellKey] = useState<
		string | null
	>(null);
	const previewColumns = columns
		.filter((column) => column.isVisible)
		.sort((left, right) => left.displayOrder - right.displayOrder)
		.slice(0, 3);
	const fieldsByName = new Map(
		fields.map((field) => [field.name, field] as const)
	);

	return (
		<AdminKanbanBoard
			columns={groups.map((group) => ({
				badge: group.color ? (
					<Badge variant="outline">{group.color}</Badge>
				) : null,
				count: group.count,
				id: group.groupId,
				items: group.rows,
				label: group.label,
			}))}
			getItemId={(row) => row.record._id}
			onSelectItem={
				onSelectRecord ? (row) => onSelectRecord(row.record._id) : undefined
			}
			renderItem={(row) => (
				<>
					<div className="flex w-full items-start justify-between gap-3">
						<div className="space-y-1">
							<p className="font-medium text-sm">
								{getAdminRecordTitle({
									adapterContract,
									fields,
									record: row.record,
								})}
							</p>
							<p className="text-muted-foreground text-xs">
								{getAdminRecordSupportingText({
									adapterContract,
									objectDef,
									record: row.record,
								})}
							</p>
						</div>
						<Badge
							variant={row.record._kind === "native" ? "secondary" : "outline"}
						>
							{row.record._kind === "native" ? "Native" : "EAV"}
						</Badge>
					</div>

					<div className="grid w-full gap-2">
						{previewColumns.map((column) => {
							const field = fieldsByName.get(column.name);
							const cell = row.cells.find(
								(candidate) => candidate.fieldName === column.name
							);
							let cellContent: ReactNode;

							if (field && cell) {
								const cellKey = `${row.record._id}:${column.name}`;
								const relationDisplayValue = isRelationCellDisplayValue(
									cell.displayValue
								)
									? cell.displayValue
									: null;

								cellContent = relationDisplayValue ? (
									<RelationCell
										className="justify-end"
										expanded={expandedRelationCellKey === cellKey}
										onExpandedChange={(nextExpanded) => {
											setExpandedRelationCellKey(nextExpanded ? cellKey : null);
										}}
										onNavigate={navigateRelation}
										value={relationDisplayValue}
									/>
								) : (
									<div className="truncate">
										{renderAdminFieldValue(
											field,
											cell.displayValue?.kind === "scalar"
												? cell.displayValue.value
												: cell.value,
											row.record
										)}
									</div>
								);
							} else {
								cellContent = <span className="text-muted-foreground">—</span>;
							}

							return (
								<div
									className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-2"
									key={`${row.record._id}-${column.fieldDefId}`}
								>
									<span className="text-muted-foreground text-xs">
										{column.label}
									</span>
									<div className="max-w-[60%] text-right text-sm">
										{cellContent}
									</div>
								</div>
							);
						})}
					</div>
				</>
			)}
			variant="crm"
		/>
	);
}
