import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";

const boxesApi = anyApi.fileWorkspace.boxes;
const participantsApi = anyApi.fileWorkspace.participants;

const MANAGER_IDENTITY = createMockViewer({
	email: "manager@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_participant_manager",
});

const VIEWER_IDENTITY = createMockViewer({
	email: "viewer@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_participant_viewer",
});

async function createManagedBox(t: ReturnType<typeof createTestConvex>) {
	return await t.withIdentity(MANAGER_IDENTITY).mutation(boxesApi.createBox, {
		name: "Participant Box",
	});
}

describe("File Workspace participants", () => {
	it("upserts auth participants, changes roles, lists grants, and emits events", async () => {
		const t = createTestConvex();
		const created = await createManagedBox(t);

		const inserted = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: {
					authId: "user_participant_viewer",
					email: "viewer@test.fairlend.ca",
					role: "viewer",
				},
			});
		const updated = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: {
					authId: "user_participant_viewer",
					email: "viewer@test.fairlend.ca",
					role: "editor",
				},
			});

		const participants = await t
			.withIdentity(MANAGER_IDENTITY)
			.query(participantsApi.listParticipants, { boxId: created.boxId });
		const eventTypes = await t.run(async (ctx) => {
			const activity = await ctx.db
				.query("fileActivityEvents")
				.withIndex("by_box_created_at", (query) =>
					query.eq("boxId", created.boxId)
				)
				.collect();
			const security = await ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_created_at", (query) =>
					query.eq("boxId", created.boxId)
				)
				.collect();
			return {
				activity: activity.map((event) => event.eventType),
				security: security.map((event) => event.eventType),
			};
		});

		expect(inserted.status).toBe("created");
		expect(updated).toEqual({
			participantId: inserted.participantId,
			status: "updated",
		});
		expect(
			participants.find(
				(participant) => participant.participantId === inserted.participantId
			)?.role
		).toBe("editor");
		expect(eventTypes.activity).toEqual(
			expect.arrayContaining([
				"participant_invited",
				"participant_role_changed",
			])
		);
		expect(eventTypes.security).toEqual(
			expect.arrayContaining([
				"participant_invited",
				"participant_role_changed",
			])
		);
	});

	it("normalizes duplicate email grants instead of creating ambiguous active rows", async () => {
		const t = createTestConvex();
		const created = await createManagedBox(t);

		const first = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: { email: " DUPLICATE@Example.COM ", role: "viewer" },
			});
		const second = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: { email: "duplicate@example.com", role: "manager" },
			});
		const activeRows = await t.run(async (ctx) =>
			ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", created.boxId)
						.eq("participantKey", "email:duplicate@example.com")
						.eq("status", "active")
				)
				.collect()
		);

		expect(second.participantId).toBe(first.participantId);
		expect(activeRows).toHaveLength(1);
		expect(activeRows[0]?.role).toBe("manager");
		expect(activeRows[0]?.email).toBe("duplicate@example.com");
	});

	it("removes participants by revoking grants and blocks last-manager removal", async () => {
		const t = createTestConvex();
		const created = await createManagedBox(t);
		const viewer = await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.upsertParticipant, {
				boxId: created.boxId,
				grant: {
					authId: "user_participant_viewer",
					email: "viewer@test.fairlend.ca",
					role: "viewer",
				},
			});

		await expect(
			t.withIdentity(VIEWER_IDENTITY).query(participantsApi.listParticipants, {
				boxId: created.boxId,
			})
		).rejects.toThrow("Box not found or access denied.");

		await t
			.withIdentity(MANAGER_IDENTITY)
			.mutation(participantsApi.removeParticipant, {
				boxId: created.boxId,
				participantId: viewer.participantId,
			});
		const managerParticipant = await t.run(async (ctx) =>
			ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", created.boxId)
						.eq("participantKey", "auth:user_participant_manager")
						.eq("status", "active")
				)
				.unique()
		);

		if (!managerParticipant) {
			throw new Error("Expected manager participant to exist");
		}
		await expect(
			t
				.withIdentity(MANAGER_IDENTITY)
				.mutation(participantsApi.removeParticipant, {
					boxId: created.boxId,
					participantId: managerParticipant._id,
				})
		).rejects.toThrow("At least one manager must remain on the box.");

		const revoked = await t.run(async (ctx) =>
			ctx.db.get(viewer.participantId)
		);
		expect(revoked?.status).toBe("revoked");
		expect(revoked?.revokedAt).toBeTypeOf("number");
	});
});
