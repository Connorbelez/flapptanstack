import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const adminIdentity = {
	org_id: "org_01KKF56VABM4NYFFSR039RTJBM",
	permissions: ["admin:access", "document:review"],
	role: "admin",
	roles: ["admin"],
	subject: "admin-auth",
};

describe("document package definitions", () => {
	it("publishes a package version that pins group versions and standalone templates", async () => {
		const t = convexTest(schema, convexModules);
		const asAdmin = t.withIdentity(adminIdentity);
		const { groupVersionId, signableTemplateId, staticAssetId } =
			await seedPackageInputs(t);

		const packageId = await asAdmin.mutation(
			api.documentEngine.packages.create,
			{
				description: "Default package for lock-time closing documents",
				name: "Standard Closing Package",
			}
		);

		await asAdmin.mutation(api.documentEngine.packages.updateDraft, {
			items: [
				{ groupVersionId, kind: "group", order: 0 },
				{
					kind: "standalone_template",
					order: 1,
					templateId: signableTemplateId,
				},
				{ assetId: staticAssetId, kind: "static_asset", order: 2 },
			],
			packageId,
		});

		const version = await asAdmin.mutation(
			api.documentEngine.packages.publish,
			{
				packageId,
				publishedBy: "test-admin",
			}
		);

		expect(version.version).toBe(1);
		expect(version.snapshot.items).toHaveLength(3);
		expect(version.snapshot.envelopeBoundaries).toEqual([
			{ itemIndex: 0, kind: "group" },
			{ itemIndex: 1, kind: "standalone_signable" },
		]);
	});
});

async function seedPackageInputs(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const storageId = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["package pdf"]));
		const basePdfId = await ctx.db.insert("documentBasePdfs", {
			fileHash: "package-base-hash",
			fileRef: storageId,
			fileSize: 128,
			name: "package-base.pdf",
			pageCount: 1,
			pageDimensions: [{ height: 792, page: 1, width: 612 }],
			uploadedAt: 1,
		});
		const groupTemplateId = await ctx.db.insert("documentTemplates", {
			basePdfHash: "package-base-hash",
			basePdfId,
			createdAt: 1,
			draft: {
				fields: [
					{
						id: "group_field",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						type: "interpolable",
						variableKey: "mortgage_principal",
					},
				],
				pdfmeSchema: [],
				signatories: [
					{ order: 0, platformRole: "borrower", role: "signatory" },
				],
			},
			hasDraftChanges: false,
			name: "Group Funding Agreement",
			updatedAt: 1,
		});
		await ctx.db.insert("documentTemplateVersions", {
			basePdfHash: "package-base-hash",
			basePdfId,
			publishedAt: 2,
			publishedBy: "seed",
			snapshot: {
				fields: [
					{
						id: "group_field",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						type: "interpolable",
						variableKey: "mortgage_principal",
					},
				],
				pdfmeSchema: [],
				signatories: [
					{ order: 0, platformRole: "borrower", role: "signatory" },
				],
			},
			templateId: groupTemplateId,
			version: 1,
		});
		const groupId = await ctx.db.insert("documentTemplateGroups", {
			createdAt: 2,
			name: "Borrower Envelope",
			signatories: [{ order: 0, platformRole: "borrower", role: "signatory" }],
			templateRefs: [
				{ order: 0, pinnedVersion: 1, templateId: groupTemplateId },
			],
			updatedAt: 2,
		});
		const groupVersionId = await ctx.db.insert("documentGroupVersions", {
			groupId,
			publishedAt: 3,
			publishedBy: "seed",
			snapshot: {
				name: "Borrower Envelope",
				requiredPlatformRoles: ["borrower"],
				requiredVariableKeys: ["mortgage_principal"],
				signatories: [
					{ order: 0, platformRole: "borrower", role: "signatory" },
				],
				templateRefs: [
					{ order: 0, pinnedVersion: 1, templateId: groupTemplateId },
				],
			},
			version: 1,
		});
		const adminUserId = await ctx.db.insert("users", {
			authId: "admin-auth",
			email: "admin@example.com",
			firstName: "Admin",
			lastName: "User",
		});
		const signableTemplateId = await ctx.db.insert("documentTemplates", {
			basePdfHash: "package-base-hash",
			basePdfId,
			createdAt: 4,
			currentPublishedVersion: 1,
			draft: {
				fields: [
					{
						id: "signature_field",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						signableType: "SIGNATURE",
						signatoryPlatformRole: "lender",
						type: "signable",
					},
				],
				pdfmeSchema: [],
				signatories: [{ order: 0, platformRole: "lender", role: "signatory" }],
			},
			hasDraftChanges: false,
			name: "Funding Agreement",
			updatedAt: 4,
		});
		await ctx.db.insert("documentTemplateVersions", {
			basePdfHash: "package-base-hash",
			basePdfId,
			publishedAt: 5,
			publishedBy: "seed",
			snapshot: {
				fields: [
					{
						id: "signature_field",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						signableType: "SIGNATURE",
						signatoryPlatformRole: "lender",
						type: "signable",
					},
				],
				pdfmeSchema: [],
				signatories: [{ order: 0, platformRole: "lender", role: "signatory" }],
			},
			templateId: signableTemplateId,
			version: 1,
		});
		const staticAssetId = await ctx.db.insert("documentAssets", {
			fileHash: "risk-disclosure-hash",
			fileRef: storageId,
			fileSize: 64,
			mimeType: "application/pdf",
			name: "Risk Disclosure",
			originalFilename: "risk-disclosure.pdf",
			source: "admin_upload",
			uploadedAt: 6,
			uploadedByUserId: adminUserId,
		});

		return { groupVersionId, signableTemplateId, staticAssetId };
	});
}
