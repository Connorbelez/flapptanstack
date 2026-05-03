/**
 * @vitest-environment jsdom
 */

import type { Id } from "../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../convex/crm/types";
import { SectionedRecordDetails } from "#/components/admin/shell/detail-sections";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function buildField(name: string, label: string): NormalizedFieldDefinition {
	return {
		aggregation: {
			enabled: false,
			reason: "Test fixture",
			supportedFunctions: [],
		},
		description: undefined,
		displayOrder: 0,
		editability: { mode: "editable" },
		fieldDefId: `field_${name}`,
		fieldSource: "persisted",
		fieldType: "text",
		isActive: true,
		isRequired: false,
		isUnique: false,
		isVisibleByDefault: true,
		label,
		layoutEligibility: {
			calendar: { enabled: false, reason: "Test fixture" },
			groupBy: { enabled: false, reason: "Test fixture" },
			kanban: { enabled: false, reason: "Test fixture" },
			table: { enabled: true },
		},
		name,
		nativeColumnPath: undefined,
		nativeReadOnly: false,
		normalizedFieldKind: "primitive",
		objectDefId: "object_test" as Id<"objectDefs">,
		options: undefined,
		relation: undefined,
		rendererHint: "text",
	};
}

describe("SectionedRecordDetails", () => {
	it("renders section descriptions as help content instead of visible paragraphs", async () => {
		const record: UnifiedRecord = {
			_id: "record_test",
			_kind: "record",
			createdAt: 0,
			fields: {
				status: "Active",
			},
			nativeTable: null,
			objectDefId: "object_test" as Id<"objectDefs">,
			updatedAt: 0,
		};

		const { container } = render(
			<SectionedRecordDetails
				fields={[buildField("status", "Status")]}
				record={record}
				sections={[
					{
						description: "Lifecycle explanation.",
						fieldNames: ["status"],
						title: "Lifecycle",
					},
				]}
			/>
		);

		const helpTrigger = screen.getByRole("button", {
			name: "Lifecycle details",
		});
		expect(container.innerHTML).not.toContain(
			'<p class="text-muted-foreground text-sm">Lifecycle explanation.</p>'
		);

		await userEvent.hover(helpTrigger);

		expect(await screen.findAllByText("Lifecycle explanation.")).not.toHaveLength(
			0
		);
	});
});
