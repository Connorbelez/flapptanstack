import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../../../_generated/dataModel";
import { createDocumentPackage } from "../dealClosingEffects";

interface CreateDocumentPackageAction {
	_handler: (
		ctx: unknown,
		args: {
			effectName: string;
			entityId: Id<"deals">;
			entityType: "deal";
			eventType: string;
			journalEntryId: string;
			source: { channel: string; actorId: string; actorType: string };
			payload?: { reason?: string };
		}
	) => Promise<void>;
}

const createDocumentPackageAction =
	createDocumentPackage as unknown as CreateDocumentPackageAction;

const dealId = "deal_checkout_handoff" as Id<"deals">;

function buildArgs() {
	return {
		effectName: "createDocumentPackage",
		entityId: dealId,
		entityType: "deal" as const,
		eventType: "DEAL_LOCKED",
		journalEntryId: "journal_document_package",
		source: {
			actorId: "test-admin",
			actorType: "admin",
			channel: "admin_dashboard",
		},
	};
}

function buildCheckoutDeal() {
	return {
		_id: dealId,
		checkoutSessionId: "checkout_session_test" as Id<"checkoutSessions">,
	} satisfies Partial<Doc<"deals">>;
}

function buildPackage(status: Doc<"dealDocumentPackages">["status"]) {
	return {
		_id: `package_${status}` as Id<"dealDocumentPackages">,
		status,
	} satisfies Partial<Doc<"dealDocumentPackages">>;
}

describe("createDocumentPackage effect", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("retries package generation for checkout handoff deals with failed package state", async () => {
		const runActionCalls: unknown[] = [];
		let runQueryCallCount = 0;
		const ctx = {
			runAction: async (_action: unknown, args: unknown) => {
				runActionCalls.push(args);
				return null;
			},
			runQuery: async () => {
				runQueryCallCount += 1;
				if (runQueryCallCount === 1) {
					return buildCheckoutDeal();
				}
				if (runQueryCallCount === 2) {
					return buildPackage("failed");
				}
				return null;
			},
		};

		await createDocumentPackageAction._handler(ctx, buildArgs());

		expect(runActionCalls).toEqual([{ dealId, retry: true }]);
	});

	it("logs deal lookup failures before falling back to package generation", async () => {
		const lookupError = new Error("deal query unavailable");
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {
			// Suppress expected test log output.
		});
		const runActionCalls: unknown[] = [];
		const ctx = {
			runAction: async (_action: unknown, args: unknown) => {
				runActionCalls.push(args);
				return null;
			},
			runQuery: async () => {
				throw lookupError;
			},
		};

		await createDocumentPackageAction._handler(ctx, buildArgs());

		expect(errorSpy).toHaveBeenCalledWith(
			`[createDocumentPackage] Failed to look up deal ${dealId} before package generation:`,
			lookupError
		);
		expect(runActionCalls).toEqual([{ dealId, retry: false }]);
	});
});
