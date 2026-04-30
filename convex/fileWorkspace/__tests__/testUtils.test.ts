import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";
import { canFileWorkspace, capabilitiesForPrincipal } from "../access";
import { seedFileWorkspaceFixture } from "../testUtils";

describe("File Workspace test utilities", () => {
	it("seeds representative users, boxes, participants, links, and principals", async () => {
		const t = createTestConvex();

		const result = await t.run(async (ctx) => {
			const fixture = await seedFileWorkspaceFixture(ctx);
			const activeParticipants = await ctx.db
				.query("fileBoxParticipants")
				.withIndex("by_box_status_role", (query) =>
					query
						.eq("boxId", fixture.boxes.activePrivate.boxId)
						.eq("status", "active")
				)
				.collect();
			const publicLink = fixture.boxes.publicLink.linkId
				? await ctx.db.get(fixture.boxes.publicLink.linkId)
				: null;
			const magicLink = fixture.boxes.magicLink.linkId
				? await ctx.db.get(fixture.boxes.magicLink.linkId)
				: null;

			return {
				activeParticipantCount: activeParticipants.length,
				editorCanUpload: canFileWorkspace(
					capabilitiesForPrincipal(fixture.principals.editor),
					"upload_file"
				),
				managerCanManageLinks: canFileWorkspace(
					capabilitiesForPrincipal(fixture.principals.manager),
					"manage_links"
				),
				magicLinkKind: magicLink?.linkKind,
				nonParticipantAuthId: fixture.nonParticipant.authId,
				publicLinkKind: publicLink?.linkKind,
				viewerCanManageLinks: canFileWorkspace(
					capabilitiesForPrincipal(fixture.principals.viewer),
					"manage_links"
				),
			};
		});

		expect(result.activeParticipantCount).toBe(3);
		expect(result.editorCanUpload).toBe(true);
		expect(result.managerCanManageLinks).toBe(true);
		expect(result.viewerCanManageLinks).toBe(false);
		expect(result.publicLinkKind).toBe("public_link");
		expect(result.magicLinkKind).toBe("magic_link");
		expect(result.nonParticipantAuthId).toBe(
			"user_file_workspace_non_participant"
		);
	});
});
