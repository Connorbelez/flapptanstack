"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { AdminDescriptionHelp } from "#/components/admin/AdminDescriptionHelp";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "#/components/ui/collapsible";
import type { AdminRelationNavigationTarget } from "#/lib/admin-relation-navigation";
import { cn } from "#/lib/utils";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../../convex/crm/types";
import { FieldRenderer } from "./FieldRenderer";

export interface DetailSectionDefinition {
	readonly defaultCollapsed?: boolean;
	readonly description?: string;
	readonly fieldNames: readonly string[];
	readonly title: string;
}
interface DetailSectionWithFields extends DetailSectionDefinition {
	readonly fields: readonly NormalizedFieldDefinition[];
}

interface SectionedRecordDetailsProps {
	readonly emptyState?: ReactNode;
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly highlightFieldNames?: readonly string[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
	readonly sections: readonly DetailSectionDefinition[];
}

function hasRenderableFieldValue(value: unknown): boolean {
	return value !== undefined && value !== null && value !== "";
}

function resolveRenderableFields(args: {
	fieldLookup: ReadonlyMap<string, NormalizedFieldDefinition>;
	fieldNames: readonly string[];
	record: UnifiedRecord;
}): NormalizedFieldDefinition[] {
	return args.fieldNames.flatMap((fieldName) => {
		const field = args.fieldLookup.get(fieldName);
		if (!field) {
			return [];
		}

		return hasRenderableFieldValue(args.record.fields[field.name])
			? [field]
			: [];
	});
}

function getDetailSectionKey(section: DetailSectionDefinition): string {
	return [
		section.title,
		section.description ?? "",
		section.fieldNames.join("|"),
	].join("::");
}

function DetailFieldGrid({
	className,
	fields,
	objectDefs,
	onNavigateRelation,
	record,
}: {
	readonly className?: string;
	readonly fields: readonly NormalizedFieldDefinition[];
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record: UnifiedRecord;
}) {
	return (
		<div className={cn("grid gap-x-6 md:grid-cols-2", className)}>
			{fields.map((field) => (
				<FieldRenderer
					field={field}
					key={field.name}
					objectDefs={objectDefs}
					onNavigateRelation={onNavigateRelation}
					record={record}
					value={record.fields[field.name]}
				/>
			))}
		</div>
	);
}

export function SectionedRecordDetails({
	emptyState = null,
	fields,
	highlightFieldNames,
	objectDefs,
	onNavigateRelation,
	record,
	sections,
}: SectionedRecordDetailsProps) {
	const fieldLookup = new Map(
		fields.map((field) => [field.name, field] as const)
	);
	const highlightedFields = highlightFieldNames
		? resolveRenderableFields({
				fieldLookup,
				fieldNames: highlightFieldNames,
				record,
			})
		: [];
	const consumedNames = new Set(highlightedFields.map((field) => field.name));
	const renderedSections = sections.flatMap<DetailSectionWithFields>(
		(section) => {
			const sectionFields = resolveRenderableFields({
				fieldLookup,
				fieldNames: section.fieldNames,
				record,
			}).filter((field) => !consumedNames.has(field.name));

			for (const field of sectionFields) {
				consumedNames.add(field.name);
			}

			return sectionFields.length > 0
				? [
						{
							...section,
							fields: sectionFields,
						},
					]
				: [];
		}
	);
	const remainingFields = fields.filter(
		(field) =>
			!consumedNames.has(field.name) &&
			hasRenderableFieldValue(record.fields[field.name])
	);

	if (
		highlightedFields.length === 0 &&
		renderedSections.length === 0 &&
		remainingFields.length === 0
	) {
		return emptyState;
	}

	return (
		<div className="space-y-6">
			{highlightedFields.length > 0 ? (
				<div className="grid gap-x-6 md:grid-cols-3">
					{highlightedFields.map((field) => (
						<FieldRenderer
							className="h-full"
							field={field}
							key={field.name}
							objectDefs={objectDefs}
							onNavigateRelation={onNavigateRelation}
							record={record}
							value={record.fields[field.name]}
						/>
					))}
				</div>
			) : null}
			{renderedSections.map((section) => {
				const sectionContent = (
					<DetailFieldGrid
						fields={section.fields}
						objectDefs={objectDefs}
						onNavigateRelation={onNavigateRelation}
						record={record}
					/>
				);
				if (section.defaultCollapsed !== undefined) {
					return (
						<Collapsible
							className="border-border/70 border-t pt-5"
							defaultOpen={!section.defaultCollapsed}
							key={getDetailSectionKey(section)}
						>
							<CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 text-left">
								<h3 className="font-medium text-sm tracking-[0.02em]">
									{section.title}
								</h3>
								{section.description ? (
									<AdminDescriptionHelp
										content={section.description}
										label={`${section.title} details`}
									/>
								) : null}
								<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
							</CollapsibleTrigger>
							<CollapsibleContent className="pt-4">
								{sectionContent}
							</CollapsibleContent>
						</Collapsible>
					);
				}
				return (
					<section
						className="space-y-4 border-border/70 border-t pt-5"
						key={getDetailSectionKey(section)}
					>
						<div className="flex items-center gap-1.5">
							<h3 className="font-medium text-sm tracking-[0.02em]">
								{section.title}
							</h3>
							{section.description ? (
								<AdminDescriptionHelp
									content={section.description}
									label={`${section.title} details`}
								/>
							) : null}
						</div>
						{sectionContent}
					</section>
				);
			})}

			{remainingFields.length > 0 ? (
				<Collapsible className="space-y-3" defaultOpen={false}>
					<CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 text-left">
						<h3 className="font-medium text-sm tracking-[0.02em]">
							Additional Details
						</h3>
						<AdminDescriptionHelp
							content="Remaining populated fields on this record."
							label="Additional Details details"
						/>
						<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
					</CollapsibleTrigger>
					<CollapsibleContent>
						<DetailFieldGrid
							fields={remainingFields}
							objectDefs={objectDefs}
							onNavigateRelation={onNavigateRelation}
							record={record}
						/>
					</CollapsibleContent>
				</Collapsible>
			) : null}
		</div>
	);
}
