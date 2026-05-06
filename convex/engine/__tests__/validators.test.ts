import { describe, expect, it } from "vitest";
import { createTestConvex } from "../../../src/test/auth/helpers";

describe("engine validators", () => {
	it("accepts lawyer portal audit journal channel rows", async () => {
		const t = createTestConvex();

		const auditJournalId = await t.run((ctx) =>
			ctx.db.insert("auditJournal", {
				actorId: "lawyer-user",
				actorType: "member",
				channel: "lawyer_portal",
				effectiveDate: "2026-05-05",
				entityId: "deal_123",
				entityType: "deal",
				eventCategory: "governed_transition",
				eventId: "lawyer-portal-channel-test",
				eventType: "LAWYER_PORTAL_EVENT",
				newState: "documents_approved",
				originSystem: "test",
				outcome: "transitioned",
				previousState: "documents_pending",
				sequenceNumber: 1n,
				timestamp: Date.now(),
			})
		);

		expect(auditJournalId).toBeTruthy();
	});
});
