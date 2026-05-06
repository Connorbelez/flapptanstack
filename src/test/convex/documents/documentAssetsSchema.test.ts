import { describe, expect, it } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

describe("documentAssets schema compatibility", () => {
	it("accepts payment proof JPEG assets from existing dev data", async () => {
		const t = createTestConvex();
		await ensureSeededIdentity(t, FAIRLEND_ADMIN);

		const assetId = await t.run(async (ctx) => {
			const adminUser = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
				.unique();
			if (!adminUser) {
				throw new Error("Admin user not found");
			}

			const fileRef = await (
				ctx.storage as unknown as {
					store: (blob: Blob) => Promise<Id<"_storage">>;
				}
			).store(new Blob(["payment proof"], { type: "image/jpeg" }));

			return ctx.db.insert("documentAssets", {
				fileHash: "payment-proof-jpeg-schema-test",
				fileRef,
				fileSize: 13,
				mimeType: "image/jpeg",
				name: "Payment proof",
				originalFilename: "payment-proof.jpg",
				source: "payment_proof_upload",
				uploadedAt: Date.now(),
				uploadedByUserId: adminUser._id,
			});
		});

		const asset = await t.run((ctx) => ctx.db.get(assetId));
		expect(asset?.mimeType).toBe("image/jpeg");
		expect(asset?.source).toBe("payment_proof_upload");
	});
});
