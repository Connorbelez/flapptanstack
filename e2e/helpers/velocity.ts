import { expect, type Page } from "@playwright/test";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionArgs } from "convex/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type {
	VelocityMockDealPatchRequest,
	VelocityMockScenarioName,
	VelocityMockScenarioRequest,
	VelocityMockScenarioResponse,
} from "../../convex/velocity/mock";
import type { VelocityWorkspaceDetail } from "../../src/components/admin/velocity/types";
import {
	createOriginationE2eClient,
	readE2eAccessToken,
	uniqueOriginationValue,
} from "./origination";

const UI_TIMEOUT = 30_000;

type VelocityFairLendPatch = FunctionArgs<
	typeof api.velocity.workspaces.updateVelocityPackageFairLendFields
>["patch"];
function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required env var: ${name}`);
	}
	return value;
}

async function fetchConvexDevJson<T>(
	path: string,
	init?: RequestInit
): Promise<T> {
	const baseUrl = (
		process.env.VITE_CONVEX_SITE_URL ?? requireEnv("VITE_CONVEX_URL")
	).replace(/\/+$/, "");
	const response = await fetch(`${baseUrl}${path}`, {
		...init,
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
	});
	const body = await response.text();
	if (!response.ok) {
		throw new Error(
			`Convex dev endpoint ${path} failed with ${response.status}: ${body}`
		);
	}
	return (body ? JSON.parse(body) : null) as T;
}

function scenarioPatchToFairLendPatch(
	scenario: VelocityMockScenarioResponse
): VelocityFairLendPatch {
	const patch: VelocityFairLendPatch = {};
	const enrichment = scenario.fairlendEnrichmentPatch;
	if (enrichment?.activationRemediation) {
		patch.activationRemediation = enrichment.activationRemediation;
	}
	if (enrichment?.bankInput) {
		patch.bankInput = enrichment.bankInput;
	}
	return patch;
}

function currentReviewSnapshot(workspace: VelocityWorkspaceDetail) {
	return (
		workspace.snapshots.find(
			(snapshot) =>
				snapshot.normalizedCoreHash ===
					workspace.velocityOwned.normalizedCoreHash &&
				snapshot.snapshotType !== "final_review"
		) ??
		workspace.snapshots.find(
			(snapshot) =>
				snapshot.normalizedCoreHash ===
				workspace.velocityOwned.normalizedCoreHash
		) ??
		null
	);
}

async function createPdfBytes(label: string) {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	page.drawText(label, {
		color: rgb(0, 0, 0),
		font,
		size: 20,
		x: 72,
		y: 700,
	});
	return new Uint8Array(await pdf.save());
}

export async function bootstrapVelocityE2e(page: Page) {
	const accessToken = await readE2eAccessToken(page);
	return {
		accessToken,
		client: createVelocityE2eClient(accessToken),
	};
}

export function createVelocityE2eClient(accessToken: string) {
	const convex = new ConvexHttpClient(requireEnv("VITE_CONVEX_URL"));
	convex.setAuth(accessToken);
	const origination = createOriginationE2eClient(accessToken);

	return {
		async activate(workspaceId: string) {
			const workspace = await this.getWorkspace(workspaceId);
			const finalReview = workspace.fairlendOwned.finalReview;
			if (!finalReview) {
				throw new Error("Velocity workspace is missing final review");
			}
			return convex.action(api.velocity.activation.activateVelocityPackage, {
				reviewedSnapshotHash: finalReview.reviewedSnapshotHash,
				reviewedSnapshotId: finalReview.reviewedSnapshotId,
				workspaceId: workspaceId as Id<"velocityPackageWorkspaces">,
			});
		},
		async applyScenarioFairLendPatch(scenario: VelocityMockScenarioResponse) {
			const workspace = await this.getWorkspaceByLoanCode(scenario.loanCode);
			const patch = scenarioPatchToFairLendPatch(scenario);
			if (Object.keys(patch).length === 0) {
				return workspace;
			}
			await convex.mutation(
				api.velocity.workspaces.updateVelocityPackageFairLendFields,
				{
					patch,
					workspaceId: workspace.workspaceId as Id<"velocityPackageWorkspaces">,
				}
			);
			return this.getWorkspace(workspace.workspaceId);
		},
		async confirmFinalReview(workspaceId: string) {
			const workspace = await this.getWorkspace(workspaceId);
			const snapshot = currentReviewSnapshot(workspace);
			if (!snapshot) {
				throw new Error("Velocity workspace is missing a review snapshot");
			}
			return convex.mutation(
				api.velocity.review.confirmVelocityPackageFinalReview,
				{
					normalizedCoreHash: workspace.velocityOwned.normalizedCoreHash,
					snapshotId: snapshot.snapshotId as Id<"velocityPackageSnapshots">,
					workspaceId: workspaceId as Id<"velocityPackageWorkspaces">,
				}
			);
		},
		createScenario(args: {
			scenarioName: VelocityMockScenarioName;
			seed?: number;
		}) {
			const request: VelocityMockScenarioRequest = {
				scenarioName: args.scenarioName,
				seed: args.seed,
			};
			return fetchConvexDevJson<VelocityMockScenarioResponse>(
				"/api/dev/velocity/scenarios",
				{
					body: JSON.stringify(request),
					method: "POST",
				}
			);
		},
		deliverWebhook(loanCode: string) {
			return fetchConvexDevJson<{ ok: true }>("/api/dev/velocity/webhook", {
				body: JSON.stringify({ loanCode }),
				method: "POST",
			});
		},
		async getWorkspace(workspaceId: string) {
			const workspace = await convex.query(
				api.velocity.workspaces.getVelocityPackageWorkspace,
				{
					workspaceId: workspaceId as Id<"velocityPackageWorkspaces">,
				}
			);
			if (!workspace) {
				throw new Error(`Velocity workspace ${workspaceId} was not found`);
			}
			return workspace;
		},
		async getWorkspaceByLoanCode(loanCode: string) {
			const rows = await convex.query(
				api.velocity.workspaces.listVelocityPackageWorkspaces,
				{}
			);
			const row = rows.find((candidate) => candidate.loanCode === loanCode);
			if (!row) {
				throw new Error(`Velocity workspace for ${loanCode} was not found`);
			}
			return this.getWorkspace(row.workspaceId);
		},
		async linkPadEvidence(workspaceId: string) {
			const name = uniqueOriginationValue("velocity-pad");
			const assetId = await origination.uploadDocumentAsset({
				contents: await createPdfBytes(name),
				name,
			});
			await convex.mutation(api.velocity.documents.linkVelocityPackageDocument, {
				documentAssetId: assetId,
				role: "pad_evidence",
				workspaceId: workspaceId as Id<"velocityPackageWorkspaces">,
			});
			return this.getWorkspace(workspaceId);
		},
		recordFailedActivationAttempt(args: {
			failureCode?: string;
			failureMessage?: string;
			workspaceId: string;
		}) {
			return convex.mutation(api.test.velocityE2e.recordFailedActivationAttempt, {
				failureCode: args.failureCode,
				failureMessage: args.failureMessage,
				workspaceId: args.workspaceId as Id<"velocityPackageWorkspaces">,
			});
		},
		patchMockDeal(loanCode: string, patch: VelocityMockDealPatchRequest) {
			return fetchConvexDevJson<VelocityMockScenarioResponse>(
				`/api/dev/mock-velocity/deals?loanCode=${encodeURIComponent(loanCode)}`,
				{
					body: JSON.stringify(patch),
					method: "PATCH",
				}
			);
		},
		syncNow(workspaceId: string) {
			return convex.action(api.velocity.sync.syncVelocityPackageNow, {
				workspaceId: workspaceId as Id<"velocityPackageWorkspaces">,
			});
		},
	};
}

export async function openVelocityWorkspaceFromBoard(
	page: Page,
	args: { loanCode: string }
) {
	await page.goto("/admin/velocity");
	await expect(
		page.getByRole("heading", { exact: true, name: "Velocity packages" })
	).toBeVisible({ timeout: UI_TIMEOUT });
	await page.getByLabel("Search packages").fill(args.loanCode);
	await expect(page.getByText(`Loan ${args.loanCode}`)).toBeVisible({
		timeout: UI_TIMEOUT,
	});
	await page.getByRole("link", { name: "Open" }).first().click();
	await expect(page.getByRole("heading", { name: args.loanCode })).toBeVisible({
		timeout: UI_TIMEOUT,
	});
}

export async function uploadPadEvidenceThroughUi(page: Page) {
	const name = uniqueOriginationValue("velocity-pad-ui");
	await page.getByLabel("PDF").setInputFiles({
		buffer: Buffer.from(await createPdfBytes(name)),
		mimeType: "application/pdf",
		name: `${name}.pdf`,
	});
	await page.getByRole("button", { name: "Upload" }).click();
	await expect(page.getByText("PAD evidence linked")).toBeVisible({
		timeout: UI_TIMEOUT,
	});
}

export { UI_TIMEOUT };
