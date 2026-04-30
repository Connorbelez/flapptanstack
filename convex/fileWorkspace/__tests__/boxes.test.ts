import { anyApi } from "convex/server";
import { describe, expect, it } from "vitest";
import {
	createMockViewer,
	createTestConvex,
} from "../../../src/test/auth/helpers";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";

const boxesApi = anyApi.fileWorkspace.boxes;

const BROKER_IDENTITY = createMockViewer({
	email: "box-broker@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_box_broker",
});

const SECOND_BROKER_IDENTITY = createMockViewer({
	email: "other-broker@test.fairlend.ca",
	orgId: "org_file_workspace_broker",
	orgName: "Broker Org",
	permissions: ["broker:access"],
	roles: ["broker"],
	subject: "user_other_broker",
});

const ADMIN_IDENTITY = createMockViewer({
	email: "file-admin@test.fairlend.ca",
	orgId: FAIRLEND_STAFF_ORG_ID,
	orgName: "FairLendStaff",
	permissions: ["admin:access"],
	roles: ["admin"],
	subject: "user_file_admin",
});

const MEMBER_IDENTITY = createMockViewer({
	email: "member@test.fairlend.ca",
	orgId: "org_file_workspace_member",
	orgName: "Member Org",
	permissions: [],
	roles: ["member"],
	subject: "user_member",
});

describe("File Workspace boxes", () => {
	it("creates a box with root folder, creator manager grant, activity, and security event", async () => {
		const t = createTestConvex();

		const created = await t
			.withIdentity(BROKER_IDENTITY)
			.mutation(boxesApi.createBox, {
				description: "Closing documents",
				name: " Closing Workspace ",
			});

		const rows = await t.run(async (ctx) => {
			const box = await ctx.db.get(created.boxId);
			const root = await ctx.db.get(created.rootNodeId);
			const participant = await ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", created.boxId)
						.eq("participantKey", "auth:user_box_broker")
						.eq("status", "active")
				)
				.unique();
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
			return { activity, box, participant, root, security };
		});

		expect(rows.box?.name).toBe("Closing Workspace");
		expect(rows.box?.status).toBe("active");
		expect(rows.root?.isRoot).toBe(true);
		expect(rows.root?.nodeType).toBe("folder");
		expect(rows.participant?.role).toBe("manager");
		expect(rows.activity.map((event) => event.eventType)).toContain(
			"box_created"
		);
		expect(rows.security.map((event) => event.eventType)).toContain(
			"box_created"
		);
	});

	it("allows FairLend admin creation without persisting unrelated admin oversight participants", async () => {
		const t = createTestConvex();

		const brokerCreated = await t
			.withIdentity(BROKER_IDENTITY)
			.mutation(boxesApi.createBox, { name: "Broker Box" });
		const adminCreated = await t
			.withIdentity(ADMIN_IDENTITY)
			.mutation(boxesApi.createBox, { name: "Admin Box" });

		const adminList = await t
			.withIdentity(ADMIN_IDENTITY)
			.query(boxesApi.listBoxes, {});
		const adminParticipantRows = await t.run(async (ctx) =>
			ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_participant_status", (query) =>
					query
						.eq("boxId", brokerCreated.boxId)
						.eq("participantKey", "auth:user_file_admin")
						.eq("status", "active")
				)
				.collect()
		);

		expect(adminList.map((box) => box.boxId)).toEqual(
			expect.arrayContaining([brokerCreated.boxId, adminCreated.boxId])
		);
		expect(adminParticipantRows).toHaveLength(0);
	});

	it("lists only participant boxes for non-admin users", async () => {
		const t = createTestConvex();

		const brokerCreated = await t
			.withIdentity(BROKER_IDENTITY)
			.mutation(boxesApi.createBox, { name: "Broker Box" });
		await t
			.withIdentity(SECOND_BROKER_IDENTITY)
			.mutation(boxesApi.createBox, { name: "Other Broker Box" });

		const brokerList = await t
			.withIdentity(BROKER_IDENTITY)
			.query(boxesApi.listBoxes, {});

		expect(brokerList.map((box) => box.boxId)).toEqual([brokerCreated.boxId]);
		expect(brokerList[0]?.role).toBe("manager");
	});

	it("blocks users without broker or admin access from creating boxes", async () => {
		const t = createTestConvex();

		await expect(
			t.withIdentity(MEMBER_IDENTITY).mutation(boxesApi.createBox, {
				name: "Member Box",
			})
		).rejects.toThrow("broker:access");
	});

	it("allows managers to update and archive boxes while denying unrelated users", async () => {
		const t = createTestConvex();

		const created = await t
			.withIdentity(BROKER_IDENTITY)
			.mutation(boxesApi.createBox, { name: "Original Box" });

		await expect(
			t.withIdentity(SECOND_BROKER_IDENTITY).mutation(boxesApi.updateBox, {
				boxId: created.boxId,
				patch: { name: "Unauthorized" },
			})
		).rejects.toThrow("Box not found or access denied.");

		await t.withIdentity(BROKER_IDENTITY).mutation(boxesApi.updateBox, {
			boxId: created.boxId,
			patch: { name: "Renamed Box", visibility: "public_link" },
		});
		await t
			.withIdentity(BROKER_IDENTITY)
			.mutation(boxesApi.archiveBox, { boxId: created.boxId });

		const box = await t.run(async (ctx) => ctx.db.get(created.boxId));
		const security = await t.run(async (ctx) =>
			ctx.db
				.query("fileSecurityEvents")
				.withIndex("by_box_created_at", (query) =>
					query.eq("boxId", created.boxId)
				)
				.collect()
		);

		expect(box?.name).toBe("Renamed Box");
		expect(box?.status).toBe("archived");
		expect(box?.visibility).toBe("disabled");
		expect(security.map((event) => event.eventType)).toEqual(
			expect.arrayContaining(["box_updated", "box_archived"])
		);
	});
});
