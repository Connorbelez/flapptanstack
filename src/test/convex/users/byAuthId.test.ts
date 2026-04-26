import { describe, expect, it } from "vitest";
import {
	deleteOrphanUsersByAuthId,
	upsertUserByAuthId,
} from "../../../../convex/users/byAuthId";
import { createTestConvex } from "../../auth/helpers";

describe("users/byAuthId", () => {
	it("keeps the referenced canonical user and reports duplicate users as surviving", async () => {
		const t = createTestConvex();

		const result = await t.run(async (ctx) => {
			const now = Date.now();
			const canonicalUserId = await ctx.db.insert("users", {
				authId: "workos_duplicate_user",
				email: "old@test.fairlend.ca",
				firstName: "Old",
				lastName: "Name",
			});
			const duplicateUserId = await ctx.db.insert("users", {
				authId: "workos_duplicate_user",
				email: "duplicate@test.fairlend.ca",
				firstName: "Duplicate",
				lastName: "User",
			});
			await ctx.db.insert("borrowers", {
				createdAt: now,
				lastTransitionAt: now,
				status: "active",
				userId: canonicalUserId,
			});

			const upsertedUser = await upsertUserByAuthId(ctx, {
				authId: "workos_duplicate_user",
				email: "updated@test.fairlend.ca",
				firstName: "Updated",
				lastName: "Borrower",
				phoneNumber: "4165550001",
			});
			const remainingUsers = await ctx.db
				.query("users")
				.withIndex("authId", (query) =>
					query.eq("authId", "workos_duplicate_user")
				)
				.collect();

			return {
				canonicalUserId,
				duplicateUserId,
				remainingUsers,
				upsertedUser,
			};
		});

		expect(result.upsertedUser.wasCreated).toBe(false);
		expect(result.upsertedUser.canonicalUser._id).toBe(result.canonicalUserId);
		expect(result.upsertedUser.deletedDuplicateUserIds).toEqual([]);
		expect(result.upsertedUser.survivingDuplicateUserIds).toEqual([
			result.duplicateUserId,
		]);
		expect(result.remainingUsers).toHaveLength(2);
		expect(result.remainingUsers[0]).toMatchObject({
			authId: "workos_duplicate_user",
			email: "updated@test.fairlend.ca",
			firstName: "Updated",
			lastName: "Borrower",
			phoneNumber: "4165550001",
		});
	});

	it("reports all duplicate users as blocked during cleanup without deleting", async () => {
		const t = createTestConvex();

		const result = await t.run(async (ctx) => {
			const now = Date.now();
			const referencedUserId = await ctx.db.insert("users", {
				authId: "cleanup_duplicate_user",
				email: "referenced@test.fairlend.ca",
				firstName: "Referenced",
				lastName: "User",
			});
			const orphanUserId = await ctx.db.insert("users", {
				authId: "cleanup_duplicate_user",
				email: "orphan@test.fairlend.ca",
				firstName: "Orphan",
				lastName: "User",
			});
			await ctx.db.insert("borrowers", {
				createdAt: now,
				lastTransitionAt: now,
				status: "active",
				userId: referencedUserId,
			});

			const cleanup = await deleteOrphanUsersByAuthId(ctx, {
				authId: "cleanup_duplicate_user",
			});
			const remainingUsers = await ctx.db
				.query("users")
				.withIndex("authId", (query) =>
					query.eq("authId", "cleanup_duplicate_user")
				)
				.collect();

			return {
				cleanup,
				orphanUserId,
				referencedUserId,
				remainingUsers,
			};
		});

		expect(result.cleanup.deletedUserIds).toEqual([]);
		expect(result.cleanup.blockedUserIds).toEqual([
			result.referencedUserId,
			result.orphanUserId,
		]);
		expect(result.remainingUsers.map((user) => user._id)).toEqual([
			result.referencedUserId,
			result.orphanUserId,
		]);
	});
});
