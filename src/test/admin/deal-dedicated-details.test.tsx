/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	within,
} from "@testing-library/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { Window } from "happy-dom";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../convex/crm/types";
import { DealsDedicatedDetails } from "#/components/admin/shell/dedicated-detail-panels";

interface MockHook {
	mockReturnValue(value: unknown): MockHook;
	mockReturnValueOnce(value: unknown): MockHook;
}

let testWindow: Window | null = null;

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("#/hooks/use-app-auth", () => ({
	useAppAuth: vi.fn(() => ({
		loading: false,
		orgId: "org_staff",
		permissions: ["document:review", "deal:manage", "mortgage:originate", "payment:manage"],
		role: "admin",
		roles: ["admin"],
		signOut: vi.fn(),
		user: { id: "user_123" },
	})),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("#/components/admin/deals/DealPortalLinks", () => ({
	DealPortalLinks: ({ dealId }: { dealId: string }) => (
		<div>
			<button type="button">Open portal</button>
			<a href={`/broker/deals/${dealId}`} role="menuitem">
				Broker portal
			</a>
			<a href={`/lender/deals/${dealId}`} role="menuitem">
				Lender portal
			</a>
			<a href={`/borrower/deals/${dealId}`} role="menuitem">
				Borrower portal
			</a>
			<a href={`/lawyer/deals/${dealId}`} role="menuitem">
				Lawyer portal
			</a>
		</div>
	),
}));

vi.mock("@tanstack/react-router", () => ({
	Link: (props: {
		children: ReactNode;
		className?: string;
		params?: Record<string, string>;
		search?: Record<string, unknown>;
		to: string;
	}) => (
		<a
			className={props.className}
			href={props.to
				.replace("$entitytype", props.params?.entitytype ?? "$entitytype")
				.replace("$recordid", props.params?.recordid ?? "$recordid")
				.replace("$templateId", props.params?.templateId ?? "$templateId")}
		>
			{props.children}
		</a>
	),
}));

function buildFieldDef(args: {
	displayOrder: number;
	label: string;
	name: string;
}): NormalizedFieldDefinition {
	return {
		aggregation: {
			enabled: false,
			reason: "Test fixture",
			supportedFunctions: [],
		},
		computed: undefined,
		defaultValue: undefined,
		description: undefined,
		displayOrder: args.displayOrder,
		editability: { mode: "editable" },
		fieldDefId: `field_${args.name}` as Id<"fieldDefs">,
		fieldSource: "persisted",
		fieldType: "text",
		isActive: true,
		isRequired: false,
		isUnique: false,
		isVisibleByDefault: true,
		label: args.label,
		layoutEligibility: {
			calendar: { enabled: false, reason: "Test fixture" },
			groupBy: { enabled: false, reason: "Test fixture" },
			kanban: { enabled: false, reason: "Test fixture" },
			table: { enabled: true },
		},
		name: args.name,
		nativeColumnPath: undefined,
		nativeReadOnly: false,
		normalizedFieldKind: "primitive",
		objectDefId: "object_deal" as Id<"objectDefs">,
		options: undefined,
		relation: undefined,
		rendererHint: "text",
	};
}

function getSectionByHeading(
	view: ReturnType<typeof render>,
	name: string
) {
	const heading = view.getByRole("heading", { name });
	const section = heading.closest("section");
	expect(section).not.toBeNull();
	return section as HTMLElement;
}

beforeEach(() => {
	testWindow = new Window({
		url: "http://localhost/admin/deals/deal_1",
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: testWindow,
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: testWindow.document,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: testWindow.navigator,
	});
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: testWindow.HTMLElement,
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: testWindow.Element,
	});
	Object.defineProperty(globalThis, "Node", {
		configurable: true,
		value: testWindow.Node,
	});
	Object.defineProperty(globalThis, "MutationObserver", {
		configurable: true,
		value: testWindow.MutationObserver,
	});
	Object.defineProperty(globalThis, "PointerEvent", {
		configurable: true,
		value: testWindow.PointerEvent,
	});
	Object.defineProperty(testWindow, "SyntaxError", {
		configurable: true,
		value: SyntaxError,
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	void testWindow?.happyDOM.abort();
	testWindow = null;
});

describe("deal dedicated details", () => {
	it("renders package state and allows retrying package generation", () => {
		const retryPackageGeneration = vi.fn().mockResolvedValue({
			dealId: "deal_1",
			packageId: "package_1",
			status: "ready",
		});
		const syncSignableDocumentEnvelope = vi.fn().mockResolvedValue(null);
		(useQuery as unknown as MockHook).mockReturnValue({
			documentInstances: [
				{
					class: "private_templated_non_signable",
					displayName: "Counsel memo",
					instanceId: "instance_1",
					kind: "generated",
					lastError: null,
					packageLabel: "Closing package",
					status: "available",
					url: "https://example.com/counsel-memo.pdf",
				},
				{
					archivedAt: new Date("2026-05-16T16:30:00.000Z").getTime(),
					archivedSigning: {
						completionCertificateUrl:
							"https://example.com/admin-borrower-certificate.pdf",
						finalPdfUrl: "https://example.com/admin-borrower-final.pdf",
						signingCompletedAt: new Date(
							"2026-05-16T15:45:00.000Z"
						).getTime(),
					},
					class: "private_templated_signable",
					displayName: "Archived borrower packet",
					instanceId: "instance_3",
					kind: "generated",
					lastError: null,
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "envelope_2",
						generatedDocumentSigningStatus: "completed",
						lastError: null,
						lastProviderSyncAt: new Date("2026-05-16T15:46:00.000Z").getTime(),
						providerCode: "documenso",
						providerEnvelopeId: "doc_env_2",
						recipients: [],
						status: "completed",
					},
					status: "archived",
					url: "https://example.com/admin-borrower-final.pdf",
				},
				{
					archivedAt: new Date("2026-05-16T16:45:00.000Z").getTime(),
					archivedSigning: null,
					class: "private_templated_signable",
					displayName: "Archived draft retry packet",
					instanceId: "instance_4",
					kind: "generated",
					lastError: null,
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "envelope_3",
						generatedDocumentSigningStatus: "draft",
						lastError: null,
						lastProviderSyncAt: null,
						providerCode: "documenso",
						providerEnvelopeId: null,
						recipients: [],
						status: "draft",
					},
					status: "archived",
					url: null,
				},
				{
					archivedAt: new Date("2026-05-16T16:50:00.000Z").getTime(),
					archivedSigning: null,
					class: "private_templated_signable",
					displayName: "Waived borrower disclosure",
					instanceId: "instance_6",
					kind: "generated",
					lastError: null,
					mortgageId: "mortgage_1",
					packageLabel: "Closing package",
					remediation: {
						actions: [],
						eligibility: "already_remediated",
						primaryAction: null,
						summary: "This document row has already been remediated.",
					},
					remediationAction: "waived_for_deal",
					remediationReason: "Disclosure not required for this closing.",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: null,
						generatedDocumentSigningStatus: "draft",
						lastError: null,
						lastProviderSyncAt: null,
						providerCode: "documenso",
						providerEnvelopeId: null,
						recipients: [],
						status: "draft",
					},
					sourceBlueprintId: "source_blueprint_waived",
					status: "archived",
					supersededByInstanceId: null,
					templateId: "template_waived",
					url: null,
				},
				{
					archivedAt: null,
					archivedSigning: {
						completionCertificateUrl:
							"https://example.com/signed-active-certificate.pdf",
						finalPdfUrl: "https://example.com/signed-active-final.pdf",
						signingCompletedAt: new Date(
							"2026-05-16T17:45:00.000Z"
						).getTime(),
					},
					class: "private_templated_signable",
					displayName: "Signed active packet",
					instanceId: "instance_5",
					kind: "generated",
					lastError: null,
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "envelope_4",
						generatedDocumentSigningStatus: "completed",
						lastError: null,
						lastProviderSyncAt: new Date("2026-05-16T17:46:00.000Z").getTime(),
						providerCode: "documenso",
						providerEnvelopeId: "doc_env_4",
						recipients: [
							{
								email: "signed@test.fairlend.ca",
								isCurrentViewer: false,
								name: "Sally Signed",
								platformRole: "borrower_primary",
								providerRecipientId: "rcpt_2",
								providerRole: "SIGNER",
								signingOrder: 0,
								status: "signed",
								userId: "user_3",
							},
						],
						status: "completed",
					},
					status: "signed",
					url: "https://example.com/signed-active-final.pdf",
				},
				{
					class: "private_templated_signable",
					displayName: "Failed signer packet",
					instanceId: "instance_7",
					kind: "generated",
					lastError:
						"Documenso validation failed: signer recipients must have at least one signature field",
					mortgageId: "mortgage_1",
					packageLabel: "Closing package",
					remediation: {
						actions: [
							{
								action: "open_authoring",
								copy: "Open the template authoring surface and fix the signature field or provider setup.",
							},
							{
								action: "retry_instance",
								copy: "Retry this failed row after correcting the deal-scoped configuration.",
							},
							{
								action: "refresh_snapshot",
								copy: "Replace this failed row from the latest active source blueprint snapshot.",
							},
							{
								action: "waive_for_deal",
								copy: "Archive this failed row as intentionally waived for this deal.",
							},
							{
								action: "archive_source_blueprint",
								copy: "Archive the source blueprint so future deal packages do not generate it.",
							},
						],
						eligibility: "remediable_failed_instance",
						primaryAction: "open_authoring",
						summary:
							"Documenso requires at least one signer signature field. Fix the template authoring before retrying.",
					},
					remediationAction: null,
					remediationReason: null,
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "envelope_5",
						generatedDocumentSigningStatus: "provider_error",
						lastError:
							"Documenso validation failed: signer recipients must have at least one signature field",
						lastProviderSyncAt: null,
						providerCode: "documenso",
						providerEnvelopeId: null,
						recipients: [],
						status: "provider_error",
					},
					sourceBlueprintId: "source_blueprint_1",
					status: "provider_error",
					supersededByInstanceId: null,
					templateId: "template_1",
					url: null,
				},
				{
					class: "private_templated_signable",
					displayName: "Borrower signature packet",
					instanceId: "instance_2",
					kind: "generated",
					lastError: null,
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "envelope_1",
						generatedDocumentSigningStatus: "sent",
						lastError: null,
						lastProviderSyncAt: new Date("2026-05-15T14:00:00.000Z").getTime(),
						providerCode: "documenso",
						providerEnvelopeId: "doc_env_1",
						recipients: [
							{
								email: "borrower@test.fairlend.ca",
								isCurrentViewer: false,
								name: "Ada Borrower",
								platformRole: "borrower_primary",
								providerRecipientId: "rcpt_1",
								providerRole: "SIGNER",
								signingOrder: 0,
								status: "pending",
								userId: "user_2",
							},
						],
						status: "sent",
					},
					status: "signature_sent",
					url: null,
				},
			],
			documentPackage: {
				archivedAt: new Date("2026-05-16T16:30:00.000Z").getTime(),
				lastError: "Missing variables: listing_title",
				packageId: "package_1",
				readyAt: null,
				retryCount: 1,
				status: "partial_failure",
			},
			mortgage: { mortgageId: "mortgage_1" },
			parties: {
				lawyer: {
					authId: "lawyer_auth_1",
					email: "lawyer@test.fairlend.ca",
					lawyerType: "platform_lawyer",
					name: "Lex Lawyer",
					userId: "user_lawyer_1",
				},
				lender: {
					email: "lender@test.fairlend.ca",
					lenderId: "lender_1",
					name: "Lena Lender",
					userId: "user_lender_1",
				},
				seller: {
					borrowerId: "borrower_1",
					email: "seller@test.fairlend.ca",
					name: "Sam Seller",
					userId: "user_seller_1",
				},
			},
			property: {
				propertyId: "property_1",
				streetAddress: "123 King St W",
			},
			recentAuditEvents: [
				{
					eventId: "audit_1",
					eventType: "DEAL_LOCKED",
					newState: "lawyerOnboarding.pending",
					outcome: "success",
					previousState: "initiated",
					timestamp: Date.now(),
				},
			],
		});
		(useAction as unknown as MockHook)
			.mockReturnValueOnce(retryPackageGeneration)
			.mockReturnValueOnce(syncSignableDocumentEnvelope)
			.mockReturnValue(vi.fn().mockResolvedValue(null));
		(useMutation as unknown as MockHook).mockReturnValue(
			vi.fn().mockResolvedValue(null)
		);

		const fields = [
			buildFieldDef({ displayOrder: 0, label: "Status", name: "status" }),
			buildFieldDef({
				displayOrder: 1,
				label: "Closing Date",
				name: "closingDate",
			}),
			buildFieldDef({
				displayOrder: 2,
				label: "Fractional Share",
				name: "fractionalShare",
			}),
			buildFieldDef({
				displayOrder: 3,
				label: "Locking Fee",
				name: "lockingFeeAmount",
			}),
		];
		const objectDefs = [
			{
				_id: "object_lenders",
				name: "lender",
				nativeTable: "lenders",
				pluralLabel: "Lenders",
				singularLabel: "Lender",
			},
			{
				_id: "object_borrowers",
				name: "borrower",
				nativeTable: "borrowers",
				pluralLabel: "Borrowers",
				singularLabel: "Borrower",
			},
			{
				_id: "object_users",
				name: "user",
				nativeTable: "users",
				pluralLabel: "Users",
				singularLabel: "User",
			},
		] as unknown as Doc<"objectDefs">[];
		const navigateRelation = vi.fn();
		const record = {
			_id: "deal_1",
			creationType: "real",
			fields: {
				closingDate: new Date("2026-05-15T12:00:00.000Z").toISOString(),
				fractionalShare: 2500,
				lockingFeeAmount: 7500,
				status: "initiated",
			},
			sourceId: null,
		} as unknown as UnifiedRecord;

		const view = render(
			<DealsDedicatedDetails
				fields={fields}
				objectDefs={objectDefs}
				onNavigateRelation={navigateRelation}
				record={record}
			/>
		);

		expect(view.getByText("Deal Package")).toBeTruthy();
		expect(view.getByText("Generated Read-only Documents")).toBeTruthy();
		expect(view.getByText("Signable Documents")).toBeTruthy();
		expect(view.getByText("Archived Signable Documents")).toBeTruthy();
		expect(view.getByText("Signed archive ready")).toBeTruthy();
		expect(view.getByText("Counsel memo")).toBeTruthy();
		const signableSection = getSectionByHeading(view, "Signable Documents");
		const archivedSection = getSectionByHeading(
			view,
			"Archived Signable Documents"
		);
		const archivedDisclosure = archivedSection.querySelector("details");
		expect(archivedDisclosure).not.toBeNull();
		expect((archivedDisclosure as HTMLDetailsElement).open).toBe(false);
		fireEvent.click(
			within(archivedSection).getByText("Show archived signable documents")
		);
		expect((archivedDisclosure as HTMLDetailsElement).open).toBe(true);
		expect(within(signableSection).getByText("Borrower signature packet")).toBeTruthy();
		expect(within(signableSection).getByText("Signed active packet")).toBeTruthy();
		expect(within(signableSection).getByText("Failed signer packet")).toBeTruthy();
		expect(
			within(signableSection).getByText(
				"Documenso requires at least one signer signature field. Fix the template authoring before retrying."
			)
		).toBeTruthy();
		expect(
			within(signableSection).getByRole("link", { name: /Open template/ }).getAttribute("href")
		).toBe("/admin/document-engine/designer/template_1");
		expect(within(signableSection).queryByText("Archived draft retry packet")).toBeNull();
		expect(within(signableSection).queryByText("Waived borrower disclosure")).toBeNull();
		expect(within(archivedSection).getByText("Archived borrower packet")).toBeTruthy();
		expect(within(archivedSection).getByText("Archived draft retry packet")).toBeTruthy();
		expect(within(archivedSection).getByText("Waived borrower disclosure")).toBeTruthy();
		expect(
			within(archivedSection).getByText("Intentionally waived for this deal")
		).toBeTruthy();
		expect(within(archivedSection).queryByText("Signed active packet")).toBeNull();
		expect(within(archivedSection).queryByText("Failed signer packet")).toBeNull();
		expect(view.getByText("Ada Borrower")).toBeTruthy();
		expect(view.getByText("Waiting on: Ada Borrower (SIGNER)")).toBeTruthy();
		expect(within(signableSection).getByText("Envelope is completed.")).toBeTruthy();
		expect(
			within(archivedSection).getAllByText("Envelope is still in draft.").length
		).toBeGreaterThan(0);
		expect(view.getAllByRole("button", { name: "Refresh status" }).length).toBeGreaterThan(0);
		expect(view.getAllByRole("link", { name: "Open final PDF" }).length).toBeGreaterThan(0);
		expect(
			view.getAllByRole("link", { name: "Open completion certificate" })[0]
		).toBeTruthy();
		expect(view.getByText("Missing variables: listing_title")).toBeTruthy();
		expect(
			view.getByRole("link", { name: "mortgage_1" }).getAttribute("href")
		).toBe("/admin/mortgages/mortgage_1");
		expect(
			view.getByRole("link", { name: "123 King St W" }).getAttribute("href")
		).toBe("/admin/properties/property_1");
		fireEvent.click(
			view.getByRole("button", { name: "Open lender detail sheet" })
		);
		fireEvent.click(
			view.getByRole("button", { name: "Open seller detail sheet" })
		);
		fireEvent.click(
			view.getByRole("button", { name: "Open lawyer detail sheet" })
		);
		expect(navigateRelation).toHaveBeenNthCalledWith(1, {
			objectDefId: "object_lenders",
			recordId: "lender_1",
			recordKind: "native",
		});
		expect(navigateRelation).toHaveBeenNthCalledWith(2, {
			objectDefId: "object_borrowers",
			recordId: "borrower_1",
			recordKind: "native",
		});
		expect(navigateRelation).toHaveBeenNthCalledWith(3, {
			objectDefId: "object_users",
			recordId: "user_lawyer_1",
			recordKind: "native",
		});

		fireEvent.click(
			view.getByRole("button", { name: "Retry all failed documents" })
		);
		expect(retryPackageGeneration).toHaveBeenCalledWith({ dealId: "deal_1" });

		fireEvent.pointerDown(view.getByRole("button", { name: "Open portal" }));
		expect(
			view.getByRole("menuitem", { name: "Broker portal" }).getAttribute("href")
		).toBe("/broker/deals/deal_1");
		expect(
			view.getByRole("menuitem", { name: "Lender portal" }).getAttribute("href")
		).toBe("/lender/deals/deal_1");
		expect(
			view
				.getByRole("menuitem", { name: "Borrower portal" })
				.getAttribute("href")
		).toBe("/borrower/deals/deal_1");
		expect(
			view.getByRole("menuitem", { name: "Lawyer portal" }).getAttribute("href")
		).toBe("/lawyer/deals/deal_1");
	});
});
