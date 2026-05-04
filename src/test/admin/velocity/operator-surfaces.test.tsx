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
import type {
	VelocityBoardRow,
	VelocityWorkspaceDetail,
} from "#/components/admin/velocity/types";

vi.mock("react", async () => {
	const { createRequire } =
		await vi.importActual<typeof import("node:module")>("node:module");
	const require = createRequire(import.meta.url);
	const reactCjs = require("react") as typeof import("react");
	return {
		...reactCjs,
		default: reactCjs,
	};
});

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

vi.mock("@tanstack/react-router", () => {
	return {
		Link: (props: {
			children: ReactNode;
			className?: string;
			params?: Record<string, string>;
			search?: unknown;
			to: string;
		}) => {
			const href = Object.entries(props.params ?? {}).reduce(
				(current, [key, value]) => current.replace(`$${key}`, value),
				props.to
			);

			return (
				<a className={props.className} href={href}>
					{props.children}
				</a>
			);
		},
	};
});

afterEach(() => {
	cleanup();
	vi.clearAllMocks();
});

function buildBoardRow(
	overrides: Partial<VelocityBoardRow> = {}
): VelocityBoardRow {
	return {
		currentVelocityStage: {
			code: 6,
			label: "Funded",
		},
		exception: {
			hasOpenException: true,
			kind: "unsupported_mapping_exception",
			summary: "Unsupported payment frequency requires remediation.",
		},
		fairlendActionState: "activation_failed_remediation",
		lenderReferenceNumber: "LENDER-REF-1001",
		linkApplicationId: "LINK-1001",
		loanCode: "LC-1001",
		primaryBorrowerName: "Borrower One",
		propertyAddress: "Unit 1201, 123 King, Toronto, ON, M5V 1A1",
		readiness: {
			blockerCount: 1,
			blockers: [
				{
					code: "unsupported_payment_frequency",
					fieldPath: "mortgageRequest.paymentFrequency",
					message: "Semi Monthly is unsupported in v1.",
					severity: "blocking",
					source: "velocity",
				},
			],
			canActivate: false,
			canFinalReview: false,
			warnings: [],
		},
		requestedPrincipal: 250_000,
		updatedAt: 1_775_000_000_000,
		workspaceId: "workspace_123" as Id<"velocityPackageWorkspaces">,
		...overrides,
	};
}

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
		documents: [
			{
				documentAsset: {
					assetId: "asset_pad" as Id<"documentAssets">,
					fileHash: "hash-pad",
					mimeType: "application/pdf",
					name: "PAD Authorization",
					originalFilename: "pad-authorization.pdf",
					uploadedAt: 1_775_000_000_000,
					uploadedByUserId: "user_admin" as Id<"users">,
				},
				documentAssetId: "asset_pad" as Id<"documentAssets">,
				linkedAt: 1_775_000_000_000,
				linkedByUserId: "user_admin" as Id<"users">,
				linkId: "link_pad" as Id<"velocityPackageDocumentLinks">,
				role: "pad_evidence",
				supersededAt: null,
			},
		],
		exceptions: [
			{
				exceptionId: "exception_1" as Id<"velocityPackageExceptions">,
				kind: "activation_exception",
				message: "Rotessa schedule creation failed.",
				openedAt: 1_775_000_000_000,
				resolvedAt: null,
				resolvedByUserId: null,
				severity: "blocking",
				status: "open",
				title: "Activation failed",
			},
		],
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
				staffNotes: "Ready after provider remediation.",
			},
			finalReview: null,
			state: "activation_failed_remediation",
		},
		readiness: {
			blockers: [
				{
					code: "activation_in_progress",
					message: "Activation attempt requires remediation.",
					severity: "blocking",
					source: "system",
				},
			],
			canActivate: false,
			canFinalReview: true,
			warnings: [
				{
					code: "provider_retry_available",
					message: "Retry activation after provider remediation.",
				},
			],
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
			conditions: [{ isApproved: false, isSent: true, name: "PAD evidence" }],
			identity: {
				linkApplicationId: "LINK-1001",
				loanCode: "LC-1001",
				lenderReferenceNumber: "LENDER-REF-1001",
			},
			lenderConditions: ["Confirm PAD authorization"],
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
			notes: [{ dateCreated: "2026-04-23T15:00:00.000Z", text: "Funded" }],
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

describe("Velocity operator surfaces", () => {
	it("renders board rows from backend payloads and filters by package search text", async () => {
		const { VelocityPackagesIndexPage } = await import(
			"#/components/admin/velocity/VelocityPackagesIndexPage"
		);
		const React = await import("react");
		vi.mocked(useQuery).mockReturnValue([
			buildBoardRow(),
			buildBoardRow({
				exception: {
					hasOpenException: false,
					kind: null,
					summary: null,
				},
				fairlendActionState: "ready_for_review",
				linkApplicationId: "LINK-2002",
				loanCode: "LC-2002",
				primaryBorrowerName: "Borrower Two",
				propertyAddress: "55 Queen, Ottawa, ON, K1P 1A4",
				readiness: {
					blockerCount: 0,
					blockers: [],
					canActivate: false,
					canFinalReview: true,
					warnings: [],
				},
				workspaceId: "workspace_456" as Id<"velocityPackageWorkspaces">,
			}),
		]);

		render(React.createElement(VelocityPackagesIndexPage));

		expect(screen.getByText("Velocity packages")).toBeTruthy();
		expect(screen.getAllByText("Funded")).toHaveLength(2);
		expect(screen.getByText("Activation Failed Remediation")).toBeTruthy();
		expect(
			screen.getByText("Unsupported payment frequency requires remediation.")
		).toBeTruthy();
		expect(screen.getByText("Review ready")).toBeTruthy();

		fireEvent.change(screen.getByLabelText("Search packages"), {
			target: { value: "LC-2002" },
		});

		expect(screen.queryByText("Borrower One")).toBeNull();
		expect(screen.getByText("Borrower Two")).toBeTruthy();
	});

	it("renders workspace readiness, locked Velocity facts, document links, and Sync now", async () => {
		const { VelocityWorkspacePage } = await import(
			"#/components/admin/velocity/VelocityWorkspacePage"
		);
		const React = await import("react");
		const syncNow = vi.fn().mockResolvedValue({ result: "succeeded" });
		const mutate = vi.fn().mockResolvedValue({
			readiness: { blockers: [], canActivate: false, canFinalReview: true },
			state: "ready_for_review",
			workspaceId: "workspace_123",
		});
		vi.mocked(useQuery).mockReturnValue(buildWorkspace());
		vi.mocked(useAction).mockReturnValue(syncNow);
		vi.mocked(useMutation).mockReturnValue(mutate);

		render(
			React.createElement(VelocityWorkspacePage, {
				workspaceId: "workspace_123",
			})
		);

		expect(screen.getAllByText("LC-1001")).toHaveLength(2);
		expect(screen.getByText("Velocity-owned facts")).toBeTruthy();
		expect(screen.getByText("Readiness and remediation")).toBeTruthy();
		expect(screen.getByText("Activation attempt requires remediation.")).toBeTruthy();
		expect(screen.getByText("Rotessa schedule creation failed.")).toBeTruthy();
		expect(screen.getByText("Package documents")).toBeTruthy();
		expect(screen.getByText("PAD Authorization")).toBeTruthy();
		expect(screen.getByLabelText("PDF")).toBeTruthy();
		expect(screen.getAllByText("hash-current")).toHaveLength(2);

		fireEvent.click(screen.getByRole("button", { name: /^Sync now$/i }));

		await waitFor(() =>
			expect(syncNow).toHaveBeenCalledWith({ workspaceId: "workspace_123" })
		);
	});
});
