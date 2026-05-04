"use client";

import { AdminDescriptionHelp } from "#/components/admin/AdminDescriptionHelp";
import { Badge } from "#/components/ui/badge";
import { resolveAdminComputedFieldNavigationTarget } from "#/lib/admin-computed-field-navigation";
import type { AdminRelationNavigationTarget } from "#/lib/admin-relation-navigation";
import {
	annualNominalPercentPointsForDisplay,
	isNativeCentCurrencyField,
} from "#/lib/adminNativeFieldFormat";
import { cn } from "#/lib/utils";
import type { Doc } from "../../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../../convex/crm/types";
import {
	CurrencyCell,
	DateCell,
	MultiSelectCell,
	PercentCell,
	SelectCell,
	TextCell,
} from "./cell-renderers";
import { isRelationCellDisplayValue, RelationCell } from "./RelationCell";

type FieldType = Doc<"fieldDefs">["fieldType"];

export interface FieldRendererProps {
	readonly className?: string;
	readonly field?: NormalizedFieldDefinition;
	readonly fieldType?: FieldType;
	readonly label?: string;
	readonly objectDefs?: readonly Doc<"objectDefs">[];
	readonly onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	readonly record?: Pick<UnifiedRecord, "_kind" | "nativeTable" | "fields">;
	readonly value: unknown;
}

export function FieldRenderer({
	className,
	field,
	fieldType,
	label,
	objectDefs,
	onNavigateRelation,
	record,
	value,
}: FieldRendererProps) {
	const resolvedFieldType = field?.fieldType ?? fieldType;
	const resolvedLabel = field?.label ?? label ?? "Field";
	const metadataBadge = resolveMetadataBadge(field);
	const helpContent = resolveFieldHelpContent(field);

	return (
		<div
			className={cn(
				"min-w-0 space-y-2 border-border/60 border-t py-3",
				className
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 items-center gap-1.5">
					<p className="min-w-0 break-words font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						{resolvedLabel}
					</p>
					{helpContent ? (
						<AdminDescriptionHelp
							content={helpContent}
							label={`${resolvedLabel} details`}
						/>
					) : null}
				</div>
				{metadataBadge ? (
					<Badge className="shrink-0" variant={metadataBadge.variant}>
						{metadataBadge.label}
					</Badge>
				) : null}
			</div>
			<div className="min-h-6">
				{renderFieldValue({
					field,
					fieldType: resolvedFieldType,
					objectDefs,
					onNavigateRelation,
					record,
					value,
				})}
			</div>
		</div>
	);
}

function resolveFieldHelpContent(field: NormalizedFieldDefinition | undefined) {
	if (!field) {
		return null;
	}

	const reasons = [
		field.description,
		field.editability.mode !== "editable"
			? field.editability.reason
			: undefined,
	].filter(
		(reason, index, allReasons): reason is string =>
			typeof reason === "string" &&
			reason.trim().length > 0 &&
			allReasons.indexOf(reason) === index
	);

	if (reasons.length === 0) {
		return null;
	}

	return (
		<div className="space-y-1">
			{reasons.map((reason) => (
				<p key={reason}>{reason}</p>
			))}
		</div>
	);
}

function resolveMetadataBadge(field: NormalizedFieldDefinition | undefined):
	| {
			label: string;
			variant: "outline" | "secondary";
	  }
	| undefined {
	if (!field) {
		return undefined;
	}

	switch (field.editability.mode) {
		case "computed":
			return { label: "Computed", variant: "secondary" };
		case "read_only":
			return { label: "Read only", variant: "outline" };
		default:
			return undefined;
	}
}

function toSelectOptions(
	options: NormalizedFieldDefinition["options"]
): Array<{ color?: string; label: string; value: string }> {
	return (options ?? []).map((option) => ({
		color: option.color,
		label: option.label,
		value: option.value,
	}));
}

function getArrayItemKey(item: unknown, seenKeys: Map<string, number>): string {
	const baseKey =
		typeof item === "string" ? item : (JSON.stringify(item) ?? String(item));
	const nextCount = (seenKeys.get(baseKey) ?? 0) + 1;
	seenKeys.set(baseKey, nextCount);
	return `${baseKey}-${nextCount}`;
}

function renderFieldValue(args: {
	field: NormalizedFieldDefinition | undefined;
	fieldType: FieldType | undefined;
	objectDefs: readonly Doc<"objectDefs">[] | undefined;
	onNavigateRelation?: (target: AdminRelationNavigationTarget) => void;
	record?: Pick<UnifiedRecord, "_kind" | "nativeTable" | "fields">;
	value: unknown;
}) {
	if (isRelationCellDisplayValue(args.value)) {
		return (
			<RelationCell
				allowToggle={false}
				expanded
				onNavigate={args.onNavigateRelation}
				value={args.value}
				variant="detail"
			/>
		);
	}

	if (args.value === null || args.value === undefined || args.value === "") {
		return <p className="text-muted-foreground text-sm">No value</p>;
	}

	if (
		args.onNavigateRelation &&
		args.record &&
		typeof args.value === "string" &&
		args.value.length > 0 &&
		args.field?.name
	) {
		const navTarget = resolveAdminComputedFieldNavigationTarget({
			fieldName: args.field.name,
			objectDefs: args.objectDefs,
			record: args.record,
		});
		if (navTarget) {
			return (
				<button
					className="inline-block max-w-full truncate text-left font-medium text-primary text-sm underline-offset-4 hover:underline"
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						args.onNavigateRelation?.(navTarget);
					}}
					type="button"
				>
					{args.value}
				</button>
			);
		}
	}

	switch (args.field?.rendererHint ?? args.fieldType) {
		case "currency":
			return typeof args.value === "number" ? (
				<CurrencyCell
					currency="CAD"
					isCents={
						args.record?._kind === "native" &&
						Boolean(args.field?.name) &&
						isNativeCentCurrencyField(
							args.record.nativeTable,
							args.field?.name ?? ""
						)
					}
					locale="en-CA"
					value={args.value}
				/>
			) : (
				<TextCell value={String(args.value)} />
			);
		case "percentage":
			return typeof args.value === "number" ? (
				<PercentCell
					decimals={2}
					value={
						args.record?._kind === "native" &&
						(args.record.nativeTable === "mortgages" ||
							args.record.nativeTable === "listings") &&
						args.field?.name
							? annualNominalPercentPointsForDisplay({
									fieldName: args.field.name,
									value: args.value,
								})
							: args.value
					}
				/>
			) : (
				<TextCell value={String(args.value)} />
			);
		case "date":
			return (
				<DateCell format="absolute" value={args.value as string | number} />
			);
		case "datetime":
			return <DateCell format="both" value={args.value as string | number} />;
		case "select":
			return (
				<SelectCell
					options={toSelectOptions(args.field?.options)}
					value={
						typeof args.value === "string" ? args.value : String(args.value)
					}
				/>
			);
		case "multi_select":
			return (
				<MultiSelectCell
					options={toSelectOptions(args.field?.options)}
					values={
						Array.isArray(args.value) ? args.value.filter(isString) : undefined
					}
				/>
			);
		case "boolean":
			return (
				<Badge variant={args.value === true ? "default" : "secondary"}>
					{args.value === true ? "Yes" : "No"}
				</Badge>
			);
		default:
			return renderGenericValue(args.value, args.fieldType);
	}
}

function renderGenericValue(value: unknown, fieldType?: FieldType) {
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return <p className="text-muted-foreground text-sm">No values</p>;
		}

		const seenKeys = new Map<string, number>();
		return (
			<div className="flex flex-wrap gap-2">
				{value.map((item) => (
					<Badge key={getArrayItemKey(item, seenKeys)} variant="secondary">
						{formatScalarValue(item)}
					</Badge>
				))}
			</div>
		);
	}

	if (typeof value === "boolean") {
		return (
			<Badge variant={value ? "default" : "secondary"}>
				{value ? "Yes" : "No"}
			</Badge>
		);
	}

	if (typeof value === "object") {
		return (
			<pre className="overflow-x-auto rounded-md bg-muted/50 p-3 text-xs">
				{JSON.stringify(value, null, 2)}
			</pre>
		);
	}

	if (typeof value === "string") {
		if (fieldType === "email") {
			return <TextCell href={`mailto:${value}`} value={value} />;
		}
		if (fieldType === "phone") {
			return <TextCell href={`tel:${value}`} value={value} />;
		}
		if (fieldType === "url") {
			return <TextCell href={sanitizeExternalUrl(value)} value={value} />;
		}
		return <TextCell value={value} />;
	}

	return <p className="text-sm">{formatScalarValue(value)}</p>;
}

function formatScalarValue(value: unknown): string {
	if (value === null || value === undefined) {
		return "No value";
	}

	if (typeof value === "number") {
		return Number.isInteger(value)
			? new Intl.NumberFormat("en-US").format(value)
			: new Intl.NumberFormat("en-US", {
					maximumFractionDigits: 2,
				}).format(value);
	}

	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}

	return String(value);
}

function isString(value: unknown): value is string {
	return typeof value === "string";
}

function sanitizeExternalUrl(value: string): string | undefined {
	try {
		const parsedUrl = new URL(value);
		if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
			return parsedUrl.toString();
		}
	} catch {
		return undefined;
	}

	return undefined;
}
