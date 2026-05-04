/**
 * @vitest-environment jsdom
 */

import { cleanup, render, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, mock } from "bun:test";
import { JSDOM } from "jsdom";
import type { Id } from "../../../convex/_generated/dataModel";
import type { BrokerReassignmentPreview } from "../../../convex/admin/lenders/reassignmentTypes";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
	url: "http://localhost",
});

Object.assign(globalThis, {
	document: dom.window.document,
	CustomEvent: dom.window.CustomEvent,
	Event: dom.window.Event,
	FocusEvent: dom.window.FocusEvent,
	getComputedStyle: dom.window.getComputedStyle,
	HTMLElement: dom.window.HTMLElement,
	HTMLInputElement: dom.window.HTMLInputElement,
	MutationObserver: dom.window.MutationObserver,
	Node: dom.window.Node,
	NodeFilter: dom.window.NodeFilter,
	navigator: dom.window.navigator,
	window: dom.window,
});

dom.window.HTMLElement.prototype.attachEvent = () => undefined;
dom.window.HTMLElement.prototype.detachEvent = () => undefined;

const useActionMock = mock(() => undefined);
const useMutationMock = mock(() => undefined);
let queryImplementation: (_reference: unknown, args: unknown) => unknown = () =>
	undefined;
const useQueryMock = mock((reference: unknown, args: unknown) =>
	queryImplementation(reference, args)
);
const toastErrorMock = mock(() => undefined);
const toastSuccessMock = mock(() => undefined);

mock.module("convex/react", () => ({
	useAction: useActionMock,
	useMutation: useMutationMock,
	useQuery: useQueryMock,
}));

mock.module("sonner", () => ({
	toast: {
		error: toastErrorMock,
		success: toastSuccessMock,
	},
}));

const { BrokerReassignmentDialog } = await import(
	"#/components/admin/lenders/BrokerReassignmentDialog"
);

const brokerTarget = {
	brokerId: "broker_target" as Id<"brokers">,
	displayName: "FairLend MIC",
	orgId: "org_fairlend_brokerage",
	portal: {
		host: "app.localhost:3000",
		portalId: "portal_app" as Id<"portals">,
		portalType: "fairlend" as const,
		willEnsure: false,
	},
	status: "active",
};

function isSearchArgs(args: unknown): args is { search?: string } {
	return (
		args !== "skip" &&
		typeof args === "object" &&
		args !== null &&
		"search" in args &&
		!("targetBrokerId" in args)
	);
}

function isPreviewArgs(
	args: unknown
): args is {
	expectedCurrentBrokerId?: Id<"brokers">;
	expectedCurrentOrgId?: string;
	lenderId: Id<"lenders">;
	targetBrokerId: Id<"brokers">;
} {
	return (
		typeof args === "object" &&
		args !== null &&
		"lenderId" in args &&
		"targetBrokerId" in args
	);
}

const basePreview: BrokerReassignmentPreview = {
	blockingReasons: [],
	current: {
		brokerId: "broker_current" as Id<"brokers">,
		displayName: "Meridian Capital",
		orgId: "org_meridian",
		portal: {
			host: "meridian.localhost:3000",
			portalId: "portal_current" as Id<"portals">,
			portalType: "broker",
			willEnsure: false,
		},
		status: "active",
	},
	portalHostWillChange: true,
	target: brokerTarget,
	workosOperations: {
		addTargetMembership: true,
		deactivateCurrentMembership: true,
		roleSlug: "lender",
	},
};

function mockDialogQueries(preview: BrokerReassignmentPreview = basePreview) {
	queryImplementation = (_reference, args) => {
		if (args === "skip") {
			return undefined;
		}
		if (isPreviewArgs(args)) {
			return preview;
		}
		if (isSearchArgs(args)) {
			return [brokerTarget];
		}
		throw new Error(`Unexpected useQuery args: ${JSON.stringify(args)}`);
	};
}

function mockDialogQueriesWithSearchResults(
	preview: BrokerReassignmentPreview = basePreview
) {
	queryImplementation = (_reference, args) => {
		if (args === "skip") {
			return undefined;
		}
		if (isPreviewArgs(args)) {
			return preview;
		}
		if (isSearchArgs(args)) {
			return args.search === "none" ? [] : [brokerTarget];
		}
		throw new Error(`Unexpected useQuery args: ${JSON.stringify(args)}`);
	};
}

function expectSearchQuery(search: string) {
	expect(useQueryMock.mock.calls).toContainEqual([
		expect.anything(),
		{ search },
	]);
}

function expectPreviewQuery(targetBrokerId: Id<"brokers">) {
	expect(useQueryMock.mock.calls).toContainEqual([
		expect.anything(),
		{
			expectedCurrentBrokerId: "broker_current",
			expectedCurrentOrgId: "org_meridian",
			lenderId: "lender_1",
			targetBrokerId,
		},
	]);
}

function expectPreviewSkipped() {
	expect(useQueryMock.mock.calls).toContainEqual([expect.anything(), "skip"]);
}

function expectNoPreviewQuery(targetBrokerId: Id<"brokers">) {
	expect(useQueryMock.mock.calls).not.toContainEqual([
		expect.anything(),
		{
			expectedCurrentBrokerId: "broker_current",
			expectedCurrentOrgId: "org_meridian",
			lenderId: "lender_1",
			targetBrokerId,
		},
	]);
}

function resetQueryCalls() {
	useQueryMock.mockClear();
}

function expectConfirmDisabled(view: ReturnType<typeof render>) {
	expect(
		(view.getByRole("button", {
			name: "Confirm reassignment",
		}) as HTMLButtonElement).disabled
	).toBe(true);
}

function expectSearchAccessible(view: ReturnType<typeof render>) {
	expect(view.getByLabelText("Search active brokers")).not.toBeNull();
}

function renderDialog(
	props: Partial<React.ComponentProps<typeof BrokerReassignmentDialog>> = {}
) {
	return render(
		<BrokerReassignmentDialog
			currentBrokerId={"broker_current" as Id<"brokers">}
			currentOrgId="org_meridian"
			lenderId={"lender_1" as Id<"lenders">}
			onOpenChange={() => undefined}
			open
			{...props}
		/>
	);
}

afterEach(() => {
	cleanup();
	queryImplementation = () => undefined;
	useActionMock.mockClear();
	useMutationMock.mockClear();
	useQueryMock.mockClear();
	toastErrorMock.mockClear();
	toastSuccessMock.mockClear();
});

describe("BrokerReassignmentDialog", () => {
	it("shows portal host change and unchanged-record confirmation copy", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		mockDialogQueries();
		useActionMock.mockReturnValue(mock(() => undefined));

		const view = renderDialog();

		expectSearchAccessible(view);
		expectSearchQuery("");
		await user.type(view.getByPlaceholderText("Search active brokers"), "Fair");
		expectSearchQuery("Fair");
		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		expectPreviewQuery("broker_target" as Id<"brokers">);

		expect(await view.findByText("meridian.localhost:3000")).not.toBeNull();
		expect(view.getByText("app.localhost:3000")).not.toBeNull();
		expect(view.getByText("Meridian Capital")).not.toBeNull();
		expect(view.getByText("org_meridian")).not.toBeNull();
		expect(view.getAllByText("FairLend MIC").length).toBeGreaterThanOrEqual(1);
		expect(view.getByText("org_fairlend_brokerage")).not.toBeNull();
		expect(view.getByText("Portal host changes")).not.toBeNull();
		expect(
			view.getByText("Add lender role in target WorkOS org")
		).not.toBeNull();
		expect(
			view.getByText("Remove lender role from current WorkOS org")
		).not.toBeNull();
		expect(
			view.getByText(/WorkOS membership to the target broker organization/i)
		).not.toBeNull();
		expect(
			view.getByText(
				/Existing deals, mortgages, ledger entries, portfolio positions, and audit history stay unchanged/i
			)
		).not.toBeNull();
	});

	it("disables confirmation when preview returns a blocking reason", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		mockDialogQueries({
			...basePreview,
			blockingReasons: [
				"Target external broker does not have an active published portal.",
			],
			target: {
				...brokerTarget,
				displayName: "No Portal Broker",
				portal: null,
			},
		});
		useActionMock.mockReturnValue(mock(() => undefined));

		const view = renderDialog();

		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		expectPreviewQuery("broker_target" as Id<"brokers">);

		expect(
			await view.findByText(
				"Target external broker does not have an active published portal."
			)
		).not.toBeNull();
		expect(
			(view.getByRole("button", {
				name: "Confirm reassignment",
			}) as HTMLButtonElement).disabled
		).toBe(true);
	});

	it("submits expected ids, refreshes the parent, shows success toast, and closes the dialog", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		const reassignBroker = mock(async () => ({
			attemptId: "attempt_1",
			targetBrokerId: "broker_target",
			targetOrgId: "org_fairlend_brokerage",
			targetPortalHost: "app.localhost:3000",
			targetPortalId: "portal_app",
		}));
		const onOpenChange = mock(() => undefined);
		const onReassigned = mock(async () => undefined);
		mockDialogQueries();
		useActionMock.mockReturnValue(reassignBroker);

		const view = renderDialog({ onOpenChange, onReassigned });

		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		await view.findByText("app.localhost:3000");
		await user.click(
			view.getByRole("button", { name: "Confirm reassignment" })
		);
		expectSearchQuery("");
		expectPreviewQuery("broker_target" as Id<"brokers">);

		await waitFor(() => {
			expect(reassignBroker).toHaveBeenCalledWith({
				expectedCurrentBrokerId: "broker_current",
				expectedCurrentOrgId: "org_meridian",
				lenderId: "lender_1",
				targetBrokerId: "broker_target",
			});
		});
		await waitFor(() => {
			expect(onReassigned).toHaveBeenCalledTimes(1);
		});
		expect(toastSuccessMock).toHaveBeenCalledWith("Lender broker reassigned");
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it("shows actionable reassignment failures without closing the dialog", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		const reassignBroker = mock(async () => {
			throw new Error(
				"WorkOS transfer incomplete. Lender assignment was not changed."
			);
		});
		const onOpenChange = mock(() => undefined);
		mockDialogQueries();
		useActionMock.mockReturnValue(reassignBroker);

		const view = renderDialog({ onOpenChange });

		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		await view.findByText("app.localhost:3000");
		await user.click(
			view.getByRole("button", { name: "Confirm reassignment" })
		);

		await waitFor(() => {
			expect(toastErrorMock).toHaveBeenCalledWith(
				"WorkOS transfer incomplete. Lender assignment was not changed."
			);
		});
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	it("shows repair-needed reassignment failures from structured Convex errors", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		const reassignBroker = mock(async () => {
			throw Object.assign(new Error("Raw WorkOS failure"), {
				data: {
					attemptId: "attempt_repair",
					canonicalAssignmentChanged: false,
					code: "LENDER_BROKER_REASSIGNMENT_REPAIR_NEEDED",
					message:
						"Identity transfer incomplete. Lender assignment was not changed. Repair needed. Attempt attempt_repair.",
					repairNeeded: true,
				},
			});
		});
		const onOpenChange = mock(() => undefined);
		mockDialogQueries();
		useActionMock.mockReturnValue(reassignBroker);

		const view = renderDialog({ onOpenChange });

		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		await view.findByText("app.localhost:3000");
		await user.click(
			view.getByRole("button", { name: "Confirm reassignment" })
		);

		await waitFor(() => {
			expect(toastErrorMock).toHaveBeenCalledWith(
				"Identity transfer incomplete. Lender assignment was not changed. Repair needed. Attempt attempt_repair."
			);
		});
		expect(onOpenChange).not.toHaveBeenCalledWith(false);
	});

	it("clears selected broker when search changes so stale hidden targets cannot submit", async () => {
		const user = userEvent.setup({ document: dom.window.document });
		const reassignBroker = mock(async () => ({
			attemptId: "attempt_1",
			targetBrokerId: "broker_target",
			targetOrgId: "org_fairlend_brokerage",
			targetPortalHost: "app.localhost:3000",
			targetPortalId: "portal_app",
		}));
		mockDialogQueriesWithSearchResults();
		useActionMock.mockReturnValue(reassignBroker);

		const view = renderDialog();

		await user.click(
			await view.findByRole("button", { name: /FairLend MIC/i })
		);
		expectPreviewQuery("broker_target" as Id<"brokers">);
		await view.findByText("app.localhost:3000");

		resetQueryCalls();
		await user.type(view.getByLabelText("Search active brokers"), "none");

		expectSearchQuery("none");
		expectPreviewSkipped();
		expectNoPreviewQuery("broker_target" as Id<"brokers">);
		expect(view.getByText("No active brokers found.")).not.toBeNull();
		expect(view.queryByText("app.localhost:3000")).toBeNull();
		expectConfirmDisabled(view);

		await user.click(
			view.getByRole("button", { name: "Confirm reassignment" })
		);
		expect(reassignBroker).not.toHaveBeenCalled();
	});
});
