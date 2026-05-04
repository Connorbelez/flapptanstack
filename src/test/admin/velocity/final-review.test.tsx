/**
 * @vitest-environment jsdom
 */

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "../../../convex/_generated/dataModel";
import { VelocityFinalReviewPage } from "#/components/admin/velocity/VelocityFinalReviewPage";
import type { VelocityWorkspaceDetail } from "#/components/admin/velocity/types";

vi.mock("convex/react", () => ({
	useAction: vi.fn(),
	useMutation: vi.fn(),
	useQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

vi.mock("#/components/admin/shell/AdminPageMetadataContext", () => ({
	useAdminBreadcrumbLabel: vi.fn(),
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
					"$workspaceId",
					props.params?.workspaceId ?? "$workspaceId"
				)}
			>
				{props.children}
			</a>
		),
	};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function buildWorkspace(
	overrides: Partial<VelocityWorkspaceDetail> = {}
): VelocityWorkspaceDetail {
	const workspace = {
		activation: null,
		activationAttempt: null,
		auditSubject: {
			entityId: "workspace_123",
			entityType: "velocityPackageWorkspace",
		},
		documents: [],
		exceptions: [],
		fairlendOwned: {
			enrichment: {
				activationRemediation: {
					lienPosition: 1,
					loanType: "conventional",
				},
				bankInput: {
					accountHolderName: "Borrower One",
					accountLast4: "6789",
					country: "CA",
					currency: "CAD",
					institutionNumber: "001",
					transitNumber: "00011",
				},
				padEvidence: {
					documentAssetId: "asset_pad" as Id<"documentAssets">,
					fileHash: "hash-pad",
					mimeType: "application/pdf",
					originalFilename: "pad-authorization.pdf",
					uploadedAt: 1_775_000_000_000,
					uploadedByUserId: "user_admin" as Id<"users">,
				},
			},
			finalReview: null,
			state: "ready_for_review",
		},
		readiness: {
			blockers: [],
			canActivate: false,
			canFinalReview: true,
			warnings: [],
		},
		snapshots: [
			{
				createdAt: 1_775_000_000_000,
				createdBy: "webhook",
				normalizedCoreHash: "hash-current",
				rawDealHash: "raw-hash",
				snapshotId: "snapshot_current" as Id<"velocityPackageSnapshots">,
				snapshotType: "upstream_core",
			},
		],
		velocityOwned: {
			borrowers: [
				{
					cellPhone: "4165550100",
					email: "borrower@example.test",
					firstName: "Borrower",
					fullName: "Borrower One",
					lastName: "One",
				},
			],
			conditions: [],
			identity: {
				linkApplicationId: "LINK-1001",
				loanCode: "LC-1001",
				lenderReferenceNumber: "LENDER-REF-1001",
			},
			lenderConditions: [],
			mortgageRequest: {
				amortizationMonths: 300,
				fairlendPaymentFrequency: "monthly",
				fairlendRateType: "fixed",
				firstPaymentDate: "2026-06-01",
				interestAdjustmentDate: "2026-05-01",
				maturityDate: "2027-05-01",
				paymentAmount: 1250,
				rate: 8.25,
				requestedPrincipal: 250_000,
				termInMonths: 12,
			},
			normalizedCoreHash: "hash-current",
			notes: [],
			referral: null,
			solicitor: null,
			sourceVersion: "velocity_core_v1",
			subjectProperty: {
				city: "Toronto",
				intendedUseLabel: "Owner Occupied",
				postalCode: "M5V 1A1",
				propertyTypeRaw: "residential",
				province: "ON",
				purchasePrice: 350_000,
				streetName: "King",
				streetNumber: "123",
				unit: "1201",
			},
			upstream: {
				agent: "Velocity Agent",
				closingDate: "2026-05-01",
				dateCreated: "2026-04-23T15:00:00.000Z",
				statusCode: 6,
				statusLabel: "Funded",
			},
		},
		workspaceId: "workspace_123" as Id<"velocityPackageWorkspaces">,
	} satisfies VelocityWorkspaceDetail;

	return {
		...workspace,
		...overrides,
		fairlendOwned: {
			...workspace.fairlendOwned,
			...overrides.fairlendOwned,
			enrichment: {
				...workspace.fairlendOwned.enrichment,
				...overrides.fairlendOwned?.enrichment,
			},
		},
		readiness: {
			...workspace.readiness,
			...overrides.readiness,
		},
		velocityOwned: {
			...workspace.velocityOwned,
			...overrides.velocityOwned,
			identity: {
				...workspace.velocityOwned.identity,
				...overrides.velocityOwned?.identity,
			},
			mortgageRequest: {
				...workspace.velocityOwned.mortgageRequest,
				...overrides.velocityOwned?.mortgageRequest,
			},
			subjectProperty: {
				...workspace.velocityOwned.subjectProperty,
				...overrides.velocityOwned?.subjectProperty,
			},
			upstream: {
				...workspace.velocityOwned.upstream,
				...overrides.velocityOwned?.upstream,
			},
		},
	};
}

function reviewedWorkspace(
	overrides: Partial<VelocityWorkspaceDetail> = {}
): VelocityWorkspaceDetail {
	return buildWorkspace({
		fairlendOwned: {
			enrichment: {},
			finalReview: {
				reviewedAt: 1_775_000_000_000,
				reviewedByUserId: "user_admin" as Id<"users">,
				reviewedSnapshotHash: "hash-current",
				reviewedSnapshotId: "snapshot_reviewed" as Id<"velocityPackageSnapshots">,
			},
			state: "ready_to_activate",
		},
		readiness: {
			blockers: [],
			canActivate: true,
			canFinalReview: true,
			warnings: [],
		},
		...overrides,
	});
}

function renderFinalReview(
	workspace: VelocityWorkspaceDetail,
	overrides: {
		readonly activate?: ReturnType<typeof vi.fn>;
		readonly confirmFinalReview?: ReturnType<typeof vi.fn>;
	} = {}
) {
	const confirmFinalReview =
		overrides.confirmFinalReview ?? vi.fn().mockResolvedValue({});
	const activate =
		overrides.activate ?? vi.fn().mockResolvedValue({ status: "succeeded" });
	vi.mocked(useQuery).mockReturnValue(workspace);
	vi.mocked(useMutation).mockReturnValue(confirmFinalReview);
	vi.mocked(useAction).mockReturnValue(activate);

	render(<VelocityFinalReviewPage workspaceId="workspace_123" />);

	return { activate, confirmFinalReview };
}

describe("Velocity final review page", () => {
	it("renders the backend activation preview and confirms review with the current snapshot", async () => {
		const { confirmFinalReview } = renderFinalReview(buildWorkspace());

		expect(screen.getByText("LC-1001 / LINK-1001")).toBeTruthy();
		expect(screen.getByText("$250,000")).toBeTruthy();
		expect(screen.getByText("pad-authorization.pdf")).toBeTruthy();
		expect(screen.getByText("Borrower One ending 6789")).toBeTruthy();
		expect(screen.getByText("snapshot_current")).toBeTruthy();
		expect(screen.getAllByText("hash-current")).toHaveLength(2);

		fireEvent.click(screen.getByRole("button", { name: /Confirm review/i }));

		await waitFor(() =>
			expect(confirmFinalReview).toHaveBeenCalledWith({
				normalizedCoreHash: "hash-current",
				snapshotId: "snapshot_current",
				workspaceId: "workspace_123",
			})
		);
	});

	it("disables activation from backend blockers and stale reviewed hashes", () => {
		renderFinalReview(
			buildWorkspace({
				fairlendOwned: {
					enrichment: {},
					finalReview: {
						reviewedAt: 1_775_000_000_000,
						reviewedByUserId: "user_admin" as Id<"users">,
						reviewedSnapshotHash: "hash-old",
						reviewedSnapshotId:
							"snapshot_reviewed" as Id<"velocityPackageSnapshots">,
					},
					state: "final_review_required",
				},
				readiness: {
					blockers: [
						{
							code: "upstream_changed_after_review",
							message: "Velocity-owned core data changed after final review.",
							severity: "blocking",
							source: "velocity",
						},
					],
					canActivate: false,
					canFinalReview: true,
					warnings: [],
				},
			})
		);

		expect(screen.getByText("Review stale")).toBeTruthy();
		expect(
			screen.getByText(/Velocity-owned data changed after final review/i)
		).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /Activate package/i }).hasAttribute(
				"disabled"
			)
		).toBe(true);
	});

	it("renders failed activation remediation and retries through the backend action", async () => {
		const { activate } = renderFinalReview(
			buildWorkspace({
				activationAttempt: {
					activationAttemptId:
						"attempt_failed" as Id<"velocityActivationAttempts">,
					bankAccountId: null,
					completedAt: null,
					externalCollectionScheduleId: null,
					externalCustomerProfileId: null,
					failedAt: 1_775_000_000_000,
					failureCode: "rotessa_request_failed",
					failureMessage: "Rotessa schedule creation failed.",
					idempotencyKey: "velocity:activation:test",
					listingId: null,
					mortgageId: null,
					reviewedSnapshotHash: "hash-current",
					reviewedSnapshotId:
						"snapshot_reviewed" as Id<"velocityPackageSnapshots">,
					rotessaCustomerRef: "501",
					rotessaScheduleRef: null,
					startedAt: 1_775_000_000_000,
					status: "failed",
				},
				fairlendOwned: {
					enrichment: {},
					finalReview: {
						reviewedAt: 1_775_000_000_000,
						reviewedByUserId: "user_admin" as Id<"users">,
						reviewedSnapshotHash: "hash-current",
						reviewedSnapshotId:
							"snapshot_reviewed" as Id<"velocityPackageSnapshots">,
					},
					state: "ready_to_activate",
				},
				readiness: {
					blockers: [],
					canActivate: true,
					canFinalReview: true,
					warnings: [],
				},
			})
		);

		expect(screen.getByText("Rotessa schedule creation failed.")).toBeTruthy();
		expect(screen.getByText("501")).toBeTruthy();

		fireEvent.click(screen.getByRole("button", { name: /Retry activation/i }));

		await waitFor(() =>
			expect(activate).toHaveBeenCalledWith({
				reviewedSnapshotHash: "hash-current",
				reviewedSnapshotId: "snapshot_reviewed",
				workspaceId: "workspace_123",
			})
		);
	});

	it("only starts one activation when the activate button is clicked rapidly while pending", async () => {
		let resolveActivation: (value: { status: string }) => void = () => {};
		const activationPromise = new Promise<{ status: string }>((resolve) => {
			resolveActivation = resolve;
		});
		const activate = vi.fn(() => activationPromise);
		renderFinalReview(reviewedWorkspace(), { activate });

		const activateButton = screen.getByRole("button", {
			name: /Activate package/i,
		});
		fireEvent.click(activateButton);
		fireEvent.click(activateButton);

		expect(activate).toHaveBeenCalledTimes(1);
		await waitFor(() =>
			expect(activateButton.hasAttribute("disabled")).toBe(true)
		);

		resolveActivation({ status: "succeeded" });
		await waitFor(() =>
			expect(activateButton.hasAttribute("disabled")).toBe(false)
		);
		expect(activate).toHaveBeenCalledTimes(1);
	});

	it("disables review and activation while backend activation is in flight", () => {
		renderFinalReview(
			buildWorkspace({
				activationAttempt: {
					activationAttemptId:
						"attempt_running" as Id<"velocityActivationAttempts">,
					bankAccountId: null,
					completedAt: null,
					externalCollectionScheduleId: null,
					externalCustomerProfileId: null,
					failedAt: null,
					failureCode: null,
					failureMessage: null,
					idempotencyKey: "velocity:activation:running",
					listingId: null,
					mortgageId: null,
					reviewedSnapshotHash: "hash-current",
					reviewedSnapshotId:
						"snapshot_reviewed" as Id<"velocityPackageSnapshots">,
					rotessaCustomerRef: "501",
					rotessaScheduleRef: null,
					startedAt: 1_775_000_000_000,
					status: "creating_rotessa_schedule",
				},
				fairlendOwned: {
					enrichment: {},
					finalReview: {
						reviewedAt: 1_775_000_000_000,
						reviewedByUserId: "user_admin" as Id<"users">,
						reviewedSnapshotHash: "hash-current",
						reviewedSnapshotId:
							"snapshot_reviewed" as Id<"velocityPackageSnapshots">,
					},
					state: "activating",
				},
				readiness: {
					blockers: [
						{
							code: "activation_in_progress",
							message: "Activation is currently running.",
							severity: "blocking",
							source: "system",
						},
					],
					canActivate: true,
					canFinalReview: true,
					warnings: [],
				},
			})
		);

		expect(screen.getByText("Creating Rotessa Schedule")).toBeTruthy();
		expect(screen.getByText("Activation is running in the backend.")).toBeTruthy();
		expect(
			screen.getByRole("button", { name: /Confirm review/i }).hasAttribute(
				"disabled"
			)
		).toBe(true);
		expect(
			screen.getByRole("button", { name: /Activate package/i }).hasAttribute(
				"disabled"
			)
		).toBe(true);
	});
});
