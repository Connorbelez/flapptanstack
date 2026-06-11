/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { useMutation } from "convex/react";
import { getFunctionName } from "convex/server";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import type {
	NormalizedFieldDefinition,
	UnifiedRecord,
} from "../../../convex/crm/types";
import { MortgagesDedicatedDetailsContent } from "#/components/admin/shell/dedicated-detail-panels";

const clearMicSaleAvailabilityOverrideMock = vi.fn(async () => ({}));
const defaultMutationMock = vi.fn(async () => ({}));
const hideListingMock = vi.fn(async () => ({}));
const publishListingMock = vi.fn(async () => ({}));
const setMicSaleAvailabilityOverrideMock = vi.fn(async () => ({
	capLedgerUnits: 4000,
}));

vi.mock("convex/react", () => {
	return {
		useAction: vi.fn(),
		useMutation: vi.fn(),
		useQuery: vi.fn(),
	};
});

vi.mock("#/components/admin/mortgages/MortgagePackageApplyButton", () => ({
	MortgagePackageApplyButton: () => (
		<button type="button">Apply document package</button>
	),
}));

vi.mock("@tanstack/react-router", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
		"@tanstack/react-router"
	);

	return {
		...actual,
		Link: (props: {
			children: ReactNode;
			className?: string;
			params?: Record<string, string>;
			to: string;
		}) => (
			<a
				className={props.className}
				href={props.to.replace(
					"$recordid",
					props.params?.recordid ?? "$recordid"
				)}
			>
				{props.children}
			</a>
		),
	};
});

function buildFieldDef(args: {
	displayOrder: number;
	fieldType?: NormalizedFieldDefinition["fieldType"];
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
		fieldType: args.fieldType ?? "text",
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
		objectDefId: "object_mortgage" as Id<"objectDefs">,
		options: undefined,
		relation: undefined,
		rendererHint: "text",
	};
}

beforeEach(() => {
	vi.mocked(useMutation).mockImplementation((mutation) => {
		const functionName = getFunctionName(mutation);
		if (
			functionName ===
			"admin/mortgages/ownership:setMicSaleAvailabilityOverride"
		) {
			return setMicSaleAvailabilityOverrideMock;
		}
		if (
			functionName ===
			"admin/mortgages/ownership:clearMicSaleAvailabilityOverride"
		) {
			return clearMicSaleAvailabilityOverrideMock;
		}
		if (functionName === "admin/settings/mutations:publishListing") {
			return publishListingMock;
		}
		if (functionName === "admin/settings/mutations:hideListing") {
			return hideListingMock;
		}
		return defaultMutationMock;
	});
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

describe("mortgage dedicated details", () => {
	it("renders the phase-6 payment, valuation, and document blueprint context", async () => {
		const detailContext = {
				borrowers: [
					{
						authId: "user_ada_borrower",
						borrowerId: "borrower_1",
						email: "ada.borrower@fairlend.test",
						idvStatus: "verified",
						linkedExternalSchedules: [
							{
								activatedAt: null,
								bankAccountId: "bank_account_1",
								borrowerId: "borrower_1",
								coveredFromPlanEntryId: "plan_entry_1",
								coveredToPlanEntryId: "plan_entry_1",
								externalScheduleRef: "rotessa-987",
								isSelected: true,
								lastSyncErrorMessage: null,
								lastSyncedAt: null,
								nextPollAt: null,
								providerCode: "pad_rotessa",
								scheduleId: "schedule_1",
								status: "active",
							},
						],
						linkedPlanEntries: [
							{
								amount: 2_450,
								obligationIds: ["obligation_1"],
								planEntryId: "plan_entry_1",
								scheduledDate: new Date(
									"2026-05-27T12:00:00.000Z"
								).getTime(),
								status: "planned",
							},
						],
						name: "Ada Borrower",
						role: "primary",
						rotessaCustomerReference: {
							customerId: 987,
							customIdentifier: "borrower-rotessa-987",
							source: "bank_account_metadata",
						},
						status: "active",
					},
				],
				documents: [
					{
						archivedAt: null,
						asset: {
							assetId: "document_asset_borrower_summary",
							fileRef: "storage_doc_1",
							name: "Borrower Summary.pdf",
							url: "https://example.com/borrower-summary.pdf",
						},
						blueprintId: "blueprint_1",
						class: "public_static",
						description: "Public borrower summary staged during origination.",
						displayName: "Borrower Summary",
						packageLabel: null,
						status: "active",
						templateName: null,
						templateVersion: null,
					},
				],
				listing: {
					dataSource: "mortgage_pipeline",
					interestRate: 9.5,
					listingId: "listing_1",
					ltvRatio: 62,
					principal: 25_000_000,
					publishedAt: null,
					status: "draft",
					title: "King West bridge opportunity",
					updatedAt: new Date("2026-05-01T12:00:00.000Z").getTime(),
				},
				micSaleAvailability: {
					availableForSaleLedgerUnits: 6_000,
					capLedgerUnits: 6_000,
					capReason: "Limit staged MIC sale availability.",
					capUpdatedAt: Date.now(),
					capUpdatedBy: "admin_user",
					canonicalMicLenderAuthId: "seed_fairlend_mic_lender_fairlend_ca",
					hasMicPosition: true,
					lockedLedgerUnits: 1_000,
					micAvailableLedgerUnits: 9_000,
					micOwnedLedgerUnits: 10_000,
					soldLedgerUnits: 0,
					totalInvestors: 0,
					totalLedgerUnits: 10_000,
					treasuryAvailableLedgerUnits: 1_000,
					treasuryOwnedLedgerUnits: 1_000,
				},
				latestValuationSnapshot: {
					createdByUserId: "user_admin_1",
					relatedDocumentAssetId: "document_asset_valuation_report",
					source: "admin_origination",
					valueAsIs: 42_500_000,
					valuationDate: "2026-05-01",
				},
				paymentSetup: {
					activationLastAttemptAt: new Date(
						"2026-05-01T12:00:00.000Z"
					).getTime(),
					activationLastError: "Rotessa provider timeout",
					activationRetryCount: 2,
					activationSelectedBankAccountId: "bank_account_1",
					activationStatus: "failed",
					collectionAttemptCount: 0,
					collectionExecutionMode: "app_owned",
					collectionExecutionProviderCode: null,
					collectionPlanEntries: [
						{
							amount: 2_450,
							balancePreCheck: {},
							createdAt: Date.now(),
							createdByRule: null,
							executionMode: "app_owned",
							lineage: {},
							method: "manual",
							mortgageId: "mortgage_1",
							obligationIds: ["obligation_1"],
							planEntryId: "plan_entry_1",
							relatedAttempt: null,
							reschedule: {},
							scheduledDate: new Date("2026-05-27T12:00:00.000Z").getTime(),
							source: "default_schedule",
							status: "planned",
							workoutPlan: null,
						},
					],
					collectionPlanEntryCount: 1,
					externalSchedule: {
						activatedAt: null,
						bankAccountId: "bank_account_1",
						externalScheduleRef: "rotessa-987",
						lastSyncErrorMessage: "Rotessa provider timeout",
						lastSyncedAt: null,
						nextPollAt: null,
						providerCode: "pad_rotessa",
						scheduleId: "schedule_1",
						status: "activation_failed",
					},
					externalSchedules: [
						{
							activatedAt: null,
							bankAccountId: "bank_account_1",
							borrowerId: "borrower_1",
							coveredFromPlanEntryId: "plan_entry_1",
							coveredToPlanEntryId: "plan_entry_1",
							externalScheduleRef: "rotessa-987",
							isSelected: true,
							lastSyncErrorMessage: "Rotessa provider timeout",
							lastSyncedAt: null,
							nextPollAt: null,
							providerCode: "pad_rotessa",
							scheduleId: "schedule_1",
							status: "activation_failed",
						},
					],
					obligationCount: 1,
					obligations: [
						{
							amount: 245_000,
							amountSettled: 0,
							dueDate: new Date("2026-06-01T12:00:00.000Z").getTime(),
							obligationId: "obligation_1",
							paymentNumber: 1,
							status: "upcoming",
							type: "regular_interest",
						},
					],
					originationCaseId: "case_1",
					scheduleRuleMissing: true,
					transferRequestCount: 0,
				},
				paymentSnapshot: {
					mostRecentPaymentAmount: 245_000,
					mostRecentPaymentDate: new Date(
						"2026-05-01T12:00:00.000Z"
					).getTime(),
					mostRecentPaymentStatus: "processing",
					nextUpcomingPaymentAmount: 245_000,
					nextUpcomingPaymentDate: new Date(
						"2026-06-01T12:00:00.000Z"
					).getTime(),
					nextUpcomingPaymentStatus: "executing",
				},
				obligationStats: {},
				property: {
					city: "Toronto",
					postalCode: "M5H 1J9",
					propertyId: "property_1",
					propertyType: "residential",
					province: "ON",
					streetAddress: "123 King St W",
					unit: null,
				},
				recentAuditEvents: [
					{
						eventId: "audit_1",
						eventType: "ORIGINATION_COMMITTED",
						newState: "active",
						outcome: "success",
						previousState: "draft",
						timestamp: Date.now(),
					},
				],
				recentObligations: [],
				activeDeals: [
					{
						buyerId: "buyer_1",
						closingDate: new Date("2026-06-15T12:00:00.000Z").getTime(),
						dealId: "deal_1",
						fractionalShare: 2_500,
						lender: {
							accreditationStatus: null,
							activatedAt: null,
							brokerId: null,
							email: "lender@test.ca",
							lenderId: null,
							name: "Lena Lender",
							payoutFrequency: null,
							status: "unresolved",
						},
						status: "active",
					},
				],
			};

		const fields = [
			buildFieldDef({ displayOrder: 0, label: "Status", name: "status" }),
			buildFieldDef({
				displayOrder: 1,
				label: "Interest Rate",
				name: "interestRate",
			}),
			buildFieldDef({ displayOrder: 2, label: "Loan Type", name: "loanType" }),
			buildFieldDef({
				displayOrder: 3,
				label: "Term Months",
				name: "termMonths",
			}),
			buildFieldDef({
				displayOrder: 4,
				label: "Maturity Date",
				name: "maturityDate",
			}),
			buildFieldDef({
				displayOrder: 5,
				label: "Lien Position",
				name: "lienPosition",
			}),
			buildFieldDef({
				displayOrder: 6,
				label: "Payment Amount",
				name: "paymentAmount",
			}),
			buildFieldDef({
				displayOrder: 7,
				label: "Payment Frequency",
				name: "paymentFrequency",
			}),
			buildFieldDef({
				displayOrder: 8,
				label: "Payment Summary",
				name: "paymentSummary",
			}),
			buildFieldDef({
				displayOrder: 9,
				label: "First Payment Date",
				name: "firstPaymentDate",
			}),
			buildFieldDef({ displayOrder: 10, label: "Rate Type", name: "rateType" }),
			buildFieldDef({
				displayOrder: 11,
				label: "Listing Summary",
				name: "listingSummary",
			}),
			buildFieldDef({
				displayOrder: 12,
				label: "Property Summary",
				name: "propertySummary",
			}),
			buildFieldDef({
				displayOrder: 13,
				label: "Borrower Summary",
				name: "borrowerSummary",
			}),
			buildFieldDef({ displayOrder: 14, label: "Principal", name: "principal" }),
		];
		const record: UnifiedRecord = {
			_id: "mortgage_1",
			_kind: "native",
			createdAt: 0,
			fields: {
				borrowerSummary: "Ada Borrower",
				firstPaymentDate: "2026-06-01",
				interestRate: 9.5,
				lienPosition: 1,
				listingSummary: "King West bridge opportunity",
				loanType: "conventional",
				maturityDate: "2027-04-30",
				paymentAmount: 245_000,
				paymentFrequency: "monthly",
				principal: 25_000_000,
				propertyId: "property_fixture_1",
				propertySummary: "123 King St W, Toronto, ON",
				rateType: "fixed",
				status: "active",
				termMonths: 12,
			},
			nativeTable: "mortgages",
			objectDefId: "object_mortgage" as Id<"objectDefs">,
			updatedAt: 0,
		};

		const objectDefs = [
			{
				_id: "object_properties_fixture" as Id<"objectDefs">,
				nativeTable: "properties",
			},
		] as unknown as readonly Doc<"objectDefs">[];

		render(
			<MortgagesDedicatedDetailsContent
				canManageMortgageDocuments
				canManageListingVisibility
				canManageOwnershipOverrides
				canRetryCollectionsActivation
				canSyncExternalSchedules
				detailContext={detailContext}
				detailFields={fields}
				editingPlanEntryId={null}
				objectDefs={objectDefs}
				onArchiveBlueprint={vi.fn(async () => {})}
				onCorrectPlanEntryDate={vi.fn(async () => {})}
				onNavigateRelation={vi.fn()}
				onReplaceBlueprint={vi.fn()}
				onRetryCollectionsActivation={vi.fn(async () => {})}
				onStartPlanEntryDateEdit={vi.fn()}
				onSyncExternalSchedule={vi.fn(async () => {})}
				paymentSetup={detailContext.paymentSetup}
				planEntryDateDraft=""
				record={record}
				savingPlanEntryDateId={null}
				setEditingPlanEntryId={vi.fn()}
				setPlanEntryDateDraft={vi.fn()}
				syncingExternalScheduleId={null}
			/>
		);

		expect(screen.getByRole("heading", { name: "Mortgage" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Market" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Payments" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Documents" })).toBeTruthy();
		expect(screen.getByRole("heading", { name: "Deals" })).toBeTruthy();
		expect(screen.getByText("$250,000")).toBeTruthy();
		expect(screen.getByText("$425,000")).toBeTruthy();
		expect(screen.getByText("Rotessa linked")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "123 King St W, Toronto, ON" })
				.getAttribute("href")
		).toBe("/admin/properties/property_1");
		expect(
			screen.getByRole("link", { name: "Ada Borrower" }).getAttribute("href")
		).toBe("/admin/borrowers/borrower_1");
		expect(screen.getByText("Schedule rule fallback applied")).toBeTruthy();
		expect(
			screen.getByText("Immediate Rotessa activation failed")
		).toBeTruthy();
		expect(screen.getByRole("button", { name: "Retry activation" })).toBeTruthy();
		expect(screen.getByText("Most Recent")).toBeTruthy();
		expect(screen.getByText("Next Due")).toBeTruthy();
		const paymentsSection = screen
			.getByRole("heading", { exact: true, name: "Payments" })
			.closest("section");
		expect(paymentsSection?.textContent).toContain("Processing");
		expect(paymentsSection?.textContent).toContain("Executing");
		expect(paymentsSection?.textContent).toContain("$2,450");
		expect(paymentsSection?.textContent).toContain("App-owned");
		expect(screen.getByRole("img", { name: "Upcoming: 1" })).toBeTruthy();
		expect(
			screen.getByRole("img", { name: "Activation Failed: 1" })
		).toBeTruthy();
		expect(screen.getByRole("img", { name: "Active: 1" })).toBeTruthy();
		expect(screen.getAllByText("Borrower Summary").length).toBeGreaterThanOrEqual(
			1
		);
		expect(
			screen.getByText("Public borrower summary staged during origination.")
		).toBeTruthy();
		expect(screen.getByRole("link", { name: "Open PDF" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
		expect(screen.getByText(/425,000/)).toBeTruthy();
		expect(screen.getAllByText(/4\/30\/2026|5\/1\/2026/).length).toBeGreaterThan(
			0
		);
		expect(screen.getByText("Admin Origination")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Borrower details" }));
		await waitFor(() => {
			expect(screen.getByText(/ada\.borrower@fairlend\.test/)).toBeTruthy();
		});
		expect(screen.getByText(/user_ada_borrower/)).toBeTruthy();
		expect(screen.getByText(/ID 987 \/ borrower-rotessa-987/)).toBeTruthy();
			fireEvent.click(
				screen.getByRole("button", { name: "Payment rows and provider tools" })
			);
			expect(screen.getByText("Plan entries")).toBeTruthy();
			expect(screen.getByRole("button", { name: "Sync now" })).toBeTruthy();
			expect(screen.getByRole("button", { name: "Change date" })).toBeTruthy();
			expect(
				screen
					.getByRole("link", { name: "Open obligation" })
					.getAttribute("href")
			).toBe("/admin/obligations/obligation_1");
			expect(
				screen.getByRole("link", { name: "Open deal" }).getAttribute("href")
			).toBe("/admin/deals/deal_1");
			fireEvent.click(
				screen.getByRole("button", { name: "Marketplace controls" })
			);
			const micSaleAvailabilitySection = screen
				.getByRole("heading", {
					exact: true,
					name: "Marketplace Availability",
				})
				.closest("section");
			expect(micSaleAvailabilitySection?.textContent).toContain(
				"Treasury Saleable"
			);
			expect(micSaleAvailabilitySection?.textContent).toContain(
				"MIC-held Saleable"
			);
			expect(micSaleAvailabilitySection?.textContent).toContain(
				"Available For Sale"
			);
			expect(micSaleAvailabilitySection?.textContent).toContain("6 / 10");
			const visibilitySection = screen
				.getByRole("heading", {
					exact: true,
					name: "Marketplace Visibility",
				})
				.closest("section");
			expect(visibilitySection?.textContent).toContain("Hidden");
			fireEvent.click(screen.getByRole("button", { name: "Publish" }));
			await waitFor(() => {
				expect(publishListingMock).toHaveBeenCalledWith({
					listingId: "listing_1",
				});
			});

			fireEvent.change(
				within(micSaleAvailabilitySection as HTMLElement).getByLabelText(
					"Available for sale"
				),
				{ target: { value: "4" } }
			);
			fireEvent.change(
				within(micSaleAvailabilitySection as HTMLElement).getByLabelText(
					"Reason"
				),
				{ target: { value: "Reduce staged MIC sale cap." } }
			);
			fireEvent.click(screen.getByRole("button", { name: "Save sale cap" }));

			await waitFor(() => {
				expect(setMicSaleAvailabilityOverrideMock).toHaveBeenCalledWith({
					availableLedgerUnits: 4000,
					mortgageId: "mortgage_1",
					reason: "Reduce staged MIC sale cap.",
				});
			});

			fireEvent.change(
				within(micSaleAvailabilitySection as HTMLElement).getByLabelText(
					"Reason"
				),
				{ target: { value: "Clear staged MIC sale cap." } }
			);
			fireEvent.click(screen.getByRole("button", { name: "Clear cap" }));

			await waitFor(() => {
				expect(clearMicSaleAvailabilityOverrideMock).toHaveBeenCalledWith({
					mortgageId: "mortgage_1",
					reason: "Clear staged MIC sale cap.",
				});
			});
		});
	});
