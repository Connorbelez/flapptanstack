/**
 * @vitest-environment jsdom
 */

import type { Id } from "../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	RelationCellDisplayValue,
} from "../../../convex/crm/types";
import { FieldRenderer } from "#/components/admin/shell/FieldRenderer";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
	globalThis.ResizeObserver =
		globalThis.ResizeObserver ??
		class ResizeObserver {
			disconnect() {}
			observe() {}
			unobserve() {}
		};
});

function buildField(
	overrides: Partial<NormalizedFieldDefinition> = {}
): NormalizedFieldDefinition {
	return {
		aggregation: {
			enabled: false,
			reason: "Test fixture",
			supportedFunctions: [],
		},
		description: undefined,
		displayOrder: 0,
		editability: { mode: "editable" },
		fieldDefId: "field_test" as Id<"fieldDefs">,
		fieldSource: "persisted",
		fieldType: "text",
		isActive: true,
		isRequired: false,
		isUnique: false,
		isVisibleByDefault: true,
		label: "Field",
		layoutEligibility: {
			calendar: { enabled: false, reason: "Test fixture" },
			groupBy: { enabled: false, reason: "Test fixture" },
			kanban: { enabled: false, reason: "Test fixture" },
			table: { enabled: true },
		},
		name: "field",
		nativeColumnPath: undefined,
		nativeReadOnly: false,
		normalizedFieldKind: "primitive",
		objectDefId: "object_test" as Id<"objectDefs">,
		options: undefined,
		relation: undefined,
		rendererHint: "text",
		...overrides,
	};
}

describe("FieldRenderer", () => {
	it("treats currency fields as base units even when nativeReadOnly is true", () => {
		const markup = renderToStaticMarkup(
			<FieldRenderer
				field={buildField({
					fieldType: "currency",
					label: "Amount",
					nativeReadOnly: true,
					rendererHint: "currency",
				})}
				value={1250}
			/>
		);

		expect(markup).toContain("1,250.00");
		expect(markup).not.toContain("12.50");
	});

	it("renders only http and https links as clickable urls", () => {
		const safeMarkup = renderToStaticMarkup(
			<FieldRenderer fieldType="url" label="Website" value="https://fairlend.ca" />
		);
		const unsafeMarkup = renderToStaticMarkup(
			<FieldRenderer
				fieldType="url"
				label="Website"
				value="javascript:alert('xss')"
			/>
		);

		expect(safeMarkup).toContain('href="https://fairlend.ca/"');
		expect(unsafeMarkup).not.toContain("href=");
		expect(unsafeMarkup).toContain("javascript:alert(&#x27;xss&#x27;)");
	});

	it("renders relation payloads as relation chips instead of raw json", () => {
		const relationValue: RelationCellDisplayValue = {
			cardinality: "many_to_many",
			items: [
				{
					label: "12 Oak Street",
					objectDefId: "object_property" as Id<"objectDefs">,
					recordId: "property_1",
					recordKind: "record",
				},
			],
			kind: "relation",
		};

		const markup = renderToStaticMarkup(
			<FieldRenderer
				field={buildField({
					fieldType: "text",
					label: "Property",
					name: "property",
					relation: {
						cardinality: "many_to_many",
						targetObjectDefId: "object_property" as Id<"objectDefs">,
					},
					rendererHint: "relation",
				})}
				value={relationValue}
			/>
		);

		expect(markup).toContain("12 Oak Street");
		expect(markup).not.toContain("&quot;kind&quot;");
		expect(markup).not.toContain("&quot;items&quot;");
	});

	it("moves field descriptions and read-only reasons into tooltip help", async () => {
		const { container } = render(
			<FieldRenderer
				field={buildField({
					description: "Explains the field.",
					editability: {
						mode: "read_only",
						reason: "Read-only source.",
					},
					label: "Status",
				})}
				value="Active"
			/>
		);

		const helpTrigger = screen.getByRole("button", { name: "Status details" });
		expect(container.innerHTML).not.toContain(
			'<p class="text-muted-foreground text-xs">Explains the field.</p>'
		);
		expect(container.innerHTML).not.toContain(
			'<p class="text-muted-foreground text-xs">Read-only source.</p>'
		);

		await userEvent.hover(helpTrigger);

		expect(await screen.findAllByText("Explains the field.")).not.toHaveLength(0);
		expect(await screen.findAllByText("Read-only source.")).not.toHaveLength(0);
	});
});
