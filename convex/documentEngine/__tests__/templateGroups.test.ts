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

describe("document template group versions", () => {
	it("publishes an immutable group version with pinned template versions", async () => {
		const t = convexTest(schema, convexModules);
		const asAdmin = t.withIdentity(adminIdentity);

		const groupId = await seedPublishedTemplateGroup(t);
		const version = await asAdmin.mutation(
			api.documentEngine.templateGroups.publish,
			{
				groupId,
				publishedBy: "test-admin",
			}
		);

		expect(version).toBe(1);

		const versions = await asAdmin.query(
			api.documentEngine.templateGroups.listVersions,
			{ groupId }
		);

		expect(versions).toHaveLength(1);
		expect(versions[0]).toMatchObject({
			publishedBy: "test-admin",
			version: 1,
		});
		expect(versions[0]?.snapshot.templateRefs[0]?.pinnedVersion).toBe(1);
	});
});

async function seedPublishedTemplateGroup(t: ReturnType<typeof convexTest>) {
	return t.run(async (ctx) => {
		const storageId = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob(["group base pdf"]));
		const basePdfId = await ctx.db.insert("documentBasePdfs", {
			fileHash: "group-base-hash",
			fileRef: storageId,
			fileSize: 128,
			name: "group-base.pdf",
			pageCount: 1,
			pageDimensions: [{ height: 792, page: 1, width: 612 }],
			uploadedAt: 1,
		});
		const templateId = await ctx.db.insert("documentTemplates", {
			basePdfHash: "group-base-hash",
			basePdfId,
			createdAt: 1,
			draft: {
				fields: [
					{
						id: "field_1",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						type: "interpolable",
						variableKey: "mortgage_principal",
					},
				],
				pdfmeSchema: [],
				signatories: [
					{
						order: 0,
						platformRole: "borrower",
						role: "signatory",
					},
				],
			},
			hasDraftChanges: false,
			name: "Funding Agreement",
			updatedAt: 1,
		});
		await ctx.db.insert("documentTemplateVersions", {
			basePdfHash: "group-base-hash",
			basePdfId,
			publishedAt: 2,
			publishedBy: "seed",
			snapshot: {
				fields: [
					{
						id: "field_1",
						position: { height: 20, page: 1, width: 120, x: 20, y: 20 },
						type: "interpolable",
						variableKey: "mortgage_principal",
					},
				],
				pdfmeSchema: [],
				signatories: [
					{
						order: 0,
						platformRole: "borrower",
						role: "signatory",
					},
				],
			},
			templateId,
			version: 1,
		});
		return ctx.db.insert("documentTemplateGroups", {
			createdAt: 3,
			description: "Borrower envelope",
			name: "Borrower Envelope",
			signatories: [
				{
					order: 0,
					platformRole: "borrower",
					role: "signatory",
				},
			],
			templateRefs: [
				{
					order: 0,
					templateId,
				},
			],
			updatedAt: 3,
		});
	});
}
