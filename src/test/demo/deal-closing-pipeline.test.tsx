/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { Window } from "happy-dom";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DealClosingPipelineDemo,
	type DealClosingPipelineCreateSigningSessionArgs,
	type DealClosingPipelineSigningSession,
	type DealClosingPipelineState,
} from "#/components/demo/deal-closing/DealClosingPipelineDemo";

vi.mock("@documenso/embed-react", () => ({
	EmbedSignDocument: ({
		onDocumentCompleted,
		onDocumentError,
		token,
	}: {
		onDocumentCompleted?: (data: {
			documentId: number;
			recipientId: number;
			token: string;
		}) => void;
		onDocumentError?: (error: string) => void;
		token: string;
	}) => (
		<div data-testid="documenso-embed">
			<span>Documenso token: {token}</span>
			<button
				onClick={() =>
					onDocumentCompleted?.({
						documentId: 101,
						recipientId: 202,
						token,
					})
				}
				type="button"
			>
				Complete signing
			</button>
			<button
				onClick={() =>
					onDocumentError?.("Documenso iframe failed")
				}
				type="button"
			>
				Fail signing
			</button>
		</div>
	),
}));

let testWindow: Window | null = null;

beforeEach(() => {
	testWindow = new Window({
		url: "http://localhost/demo/deal-closing-pipeline",
	});
	Object.defineProperty(testWindow, "SyntaxError", {
		configurable: true,
		value: SyntaxError,
	});
	Object.defineProperty(globalThis, "window", {
		configurable: true,
		value: testWindow,
	});
	Object.defineProperty(globalThis, "document", {
		configurable: true,
		value: testWindow.document,
	});
	Object.defineProperty(globalThis, "navigator", {
		configurable: true,
		value: testWindow.navigator,
	});
	Object.defineProperty(globalThis, "HTMLElement", {
		configurable: true,
		value: testWindow.HTMLElement,
	});
	Object.defineProperty(globalThis, "Element", {
		configurable: true,
		value: testWindow.Element,
	});
	Object.defineProperty(globalThis, "Node", {
		configurable: true,
		value: testWindow.Node,
	});
	Object.defineProperty(globalThis, "MutationObserver", {
		configurable: true,
		value: testWindow.MutationObserver,
	});
});

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	void testWindow?.happyDOM.abort();
	testWindow = null;
});

const dealId = "deal_demo_123";
const signableInstanceId = "instance_signable_123";
const blockedInstanceId = "instance_blocked_456";
const readonlyInstanceId = "instance_readonly_789";

function buildPipelineState(
	options: {
		signableCanLaunch?: boolean;
		signableCurrentViewer?: boolean;
	} = {}
): DealClosingPipelineState {
	const signableCanLaunch = options.signableCanLaunch ?? true;
	const signableCurrentViewer = options.signableCurrentViewer ?? true;

	return {
		auditTrail: [
			{
				actorId: "demo-deal-closing-pipeline",
				channel: "simulation",
				eventType: "demo_package_generation_succeeded",
				id: "audit_123" as never,
				message: "Demo deal document package generation completed.",
				metadata: {
					generationStatus: "ready",
				},
				newState: "ready",
				previousState: "reset_started",
				timestamp: Date.parse("2026-04-30T15:00:00.000Z"),
			},
		],
		canReset: true,
		deal: {
			closingDate: Date.parse("2026-05-15T12:00:00.000Z"),
			fractionalShare: 2500,
			id: dealId as never,
			mortgageId: "mortgage_demo_123" as never,
			property: {
				city: "Toronto",
				id: "property_demo_123" as never,
				postalCode: "M5H 1J9",
				province: "ON",
				streetAddress: "123 King St W",
				unit: "Suite 1201",
			},
			status: "initiated",
		},
		lender: {
			authId: "user_01KJ6BJXS10933HSV7KYJ9HXMN",
			email: "connor.belez@gmail.com",
			expectedUserId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as never,
			fixedUserIdMatches: true,
			linkedUserId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as never,
			name: "Connor Belez",
			userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as never,
		},
		package: {
			mortgageId: "mortgage_demo_123" as never,
			packageDefinitionId: "rd7t376j110ynd5gnvtnskhzch85vnen" as never,
			packageVersionId: "package_version_123" as never,
		},
		packageDefinition: {
			currentPublishedVersion: 3,
			expectedTitle: "test full package april30",
			id: "rd7t376j110ynd5gnvtnskhzch85vnen" as never,
			name: "test full package april30",
		},
		portalDocumentPackage: {
			instances: [
				{
					archivedAt: null,
					archivedSigning: null,
					assetId: null,
					category: "closing",
					class: "private_templated_signable",
					createdAt: Date.parse("2026-04-30T14:00:00.000Z"),
					dealId: dealId as never,
					displayName: "Investment Agreement",
					generatedDocumentId: "generated_document_123" as never,
					instanceId: signableInstanceId as never,
					kind: "generated",
					lastError: null,
					mortgageId: "mortgage_demo_123" as never,
					packageId: "deal_package_123" as never,
					packageKey: "investment-agreement",
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: signableCanLaunch,
						envelopeId: "signature_envelope_123" as never,
						generatedDocumentSigningStatus: "sent",
						lastError: null,
						lastProviderSyncAt: Date.parse("2026-04-30T14:30:00.000Z"),
						providerCode: "documenso",
						providerEnvelopeId: "documenso_env_123",
						recipients: [
							{
								declinedAt: null,
								email: "connor.belez@gmail.com",
								isCurrentViewer: signableCurrentViewer,
								name: "Connor Belez",
								openedAt: null,
								platformRole: "lender",
								providerRecipientId: "recipient_provider_123",
								providerRole: "SIGNER",
								signedAt: null,
								signingOrder: 1,
								status: "pending",
								userId: "k57ed93m3d2w0h2n3q0h8447hd81p79k" as never,
							},
						],
						status: "sent",
					},
					signingState: {
						activeAttemptId: "attempt_123" as never,
						attemptNumber: 1,
						completedRequiredCount: 0,
						exceptionCount: 0,
						providerDocumentId: "documenso_doc_123",
						providerEnvelopeId: "documenso_env_123",
						recipientCount: 1,
						requiredCount: 1,
						status: "sent",
					},
					sourceBlueprintId: "blueprint_123" as never,
					status: "signature_sent",
					templateId: "template_123" as never,
					templateVersion: 3,
					url: null,
				},
				{
					archivedAt: null,
					archivedSigning: null,
					assetId: null,
					category: "closing",
					class: "private_templated_signable",
					createdAt: Date.parse("2026-04-30T14:05:00.000Z"),
					dealId: dealId as never,
					displayName: "Borrower Disclosure",
					generatedDocumentId: "generated_document_456" as never,
					instanceId: blockedInstanceId as never,
					kind: "generated",
					lastError: null,
					mortgageId: "mortgage_demo_123" as never,
					packageId: "deal_package_123" as never,
					packageKey: "borrower-disclosure",
					packageLabel: "Closing package",
					signing: {
						canLaunchEmbeddedSigning: false,
						envelopeId: "signature_envelope_456" as never,
						generatedDocumentSigningStatus: "sent",
						lastError: null,
						lastProviderSyncAt: null,
						providerCode: "documenso",
						providerEnvelopeId: "documenso_env_456",
						recipients: [
							{
								declinedAt: null,
								email: "borrower@example.com",
								isCurrentViewer: false,
								name: "Borrower One",
								openedAt: null,
								platformRole: "borrower_primary",
								providerRecipientId: "recipient_provider_456",
								providerRole: "SIGNER",
								signedAt: null,
								signingOrder: 1,
								status: "pending",
								userId: "borrower_user_456" as never,
							},
						],
						status: "sent",
					},
					signingState: {
						activeAttemptId: "attempt_456" as never,
						attemptNumber: 1,
						completedRequiredCount: 0,
						exceptionCount: 0,
						providerDocumentId: "documenso_doc_456",
						providerEnvelopeId: "documenso_env_456",
						recipientCount: 1,
						requiredCount: 1,
						status: "sent",
					},
					sourceBlueprintId: "blueprint_456" as never,
					status: "signature_sent",
					templateId: "template_456" as never,
					templateVersion: 2,
					url: null,
				},
				{
					archivedAt: null,
					archivedSigning: null,
					assetId: "asset_789" as never,
					category: "closing",
					class: "private_static",
					createdAt: Date.parse("2026-04-30T14:10:00.000Z"),
					dealId: dealId as never,
					displayName: "Closing Checklist",
					generatedDocumentId: null,
					instanceId: readonlyInstanceId as never,
					kind: "static_reference",
					lastError: null,
					mortgageId: "mortgage_demo_123" as never,
					packageId: "deal_package_123" as never,
					packageKey: "closing-checklist",
					packageLabel: "Closing package",
					signing: null,
					signingState: null,
					sourceBlueprintId: "blueprint_789" as never,
					status: "available",
					templateId: null,
					templateVersion: null,
					url: "https://example.com/closing-checklist.pdf",
				},
			],
			package: {
				archivedAt: null,
				createdAt: Date.parse("2026-04-30T14:00:00.000Z"),
				dealId: dealId as never,
				lastError: null,
				mortgageId: "mortgage_demo_123" as never,
				packageId: "deal_package_123" as never,
				readyAt: Date.parse("2026-04-30T14:15:00.000Z"),
				retryCount: 0,
				status: "ready",
				updatedAt: Date.parse("2026-04-30T14:15:00.000Z"),
			},
			participants: null,
		},
		setup: {
			status: "ready",
		},
	};
}

function renderDemo(
	options: {
		onCreateSigningSession?: (
			args: DealClosingPipelineCreateSigningSessionArgs
		) => Promise<void>;
		onReset?: () => Promise<void> | void;
		resetPending?: boolean;
		signingSession?: DealClosingPipelineSigningSession | null;
		state?: DealClosingPipelineState;
	} = {}
) {
	return render(
		<DealClosingPipelineDemo
			onCreateSigningSession={
				options.onCreateSigningSession ?? vi.fn(async () => undefined)
			}
			onReset={options.onReset ?? vi.fn()}
			resetPending={options.resetPending ?? false}
			signingSession={options.signingSession ?? null}
			state={options.state ?? buildPipelineState()}
		/>
	);
}

describe("DealClosingPipelineDemo", () => {
	it("renders real package state and reset action", () => {
		const view = renderDemo();

		expect(
			view.getAllByText("test full package april30").length
		).toBeGreaterThan(0);
		expect(
			view.getAllByText("rd7t376j110ynd5gnvtnskhzch85vnen").length
		).toBeGreaterThan(0);
		expect(
			view.getAllByText("connor.belez@gmail.com").length
		).toBeGreaterThan(0);
		expect(view.getAllByText(/123 King St W/).length).toBeGreaterThan(0);
		expect(view.getAllByText("Investment Agreement").length).toBeGreaterThan(0);
		expect(view.getByText("Borrower One")).toBeTruthy();
		expect(
			view.getByText("Demo deal document package generation completed.")
		).toBeTruthy();
		expect(
			(view.getByRole("button", {
				name: /reset and regenerate/i,
			}) as HTMLButtonElement).disabled
		).toBe(false);
	});

	it("calls reset and respects the pending disabled state", () => {
		const onReset = vi.fn();
		const view = renderDemo({ onReset });

		fireEvent.click(view.getByRole("button", { name: /reset and regenerate/i }));

		expect(onReset).toHaveBeenCalledTimes(1);

		view.rerender(
			<DealClosingPipelineDemo
				onCreateSigningSession={vi.fn(async () => undefined)}
				onReset={onReset}
				resetPending={true}
				signingSession={null}
				state={buildPipelineState()}
			/>
		);

		expect(
			(view.getByRole("button", { name: /regenerating/i }) as HTMLButtonElement)
				.disabled
		).toBe(true);
	});

	it("opens an eligible signer via dealId and instanceId and renders the Documenso token", async () => {
		const onCreateSigningSession = vi.fn(
			async (_args: DealClosingPipelineCreateSigningSessionArgs) => undefined
		);
		const signingSession: DealClosingPipelineSigningSession = {
			error: null,
			expiresAt: Date.parse("2026-04-30T15:30:00.000Z"),
			host: "https://app.documenso.com",
			instanceId: signableInstanceId,
			isPending: false,
			token: "recipient-token-123",
			url: "https://app.documenso.com/sign/recipient-token-123",
		};
		const view = renderDemo({ onCreateSigningSession, signingSession: null });

		await act(async () => {
			fireEvent.click(
				view.getAllByRole("button", { name: "Sign Investment Agreement" })[0]
			);
		});

		expect(onCreateSigningSession).toHaveBeenCalledWith({
			dealId,
			instanceId: signableInstanceId,
		});

		view.rerender(
			<DealClosingPipelineDemo
				onCreateSigningSession={onCreateSigningSession}
				onReset={vi.fn()}
				resetPending={false}
				signingSession={signingSession}
				state={buildPipelineState()}
			/>
		);

		expect((await view.findByTestId("documenso-embed")).textContent).toContain(
			"recipient-token-123"
		);
	});

	it("closes the signing dialog when Documenso reports completion", async () => {
		const signingSession: DealClosingPipelineSigningSession = {
			error: null,
			expiresAt: Date.parse("2026-04-30T15:30:00.000Z"),
			host: "https://app.documenso.com",
			instanceId: signableInstanceId,
			isPending: false,
			token: "recipient-token-123",
			url: "https://app.documenso.com/sign/recipient-token-123",
		};
		const view = renderDemo({ signingSession });

		expect(await view.findByTestId("documenso-embed")).toBeTruthy();

		await act(async () => {
			fireEvent.click(view.getByRole("button", { name: "Complete signing" }));
		});

		expect(view.queryByTestId("documenso-embed")).toBeNull();
		expect(
			view.getByText(
				"Signing completed. Refresh status after Task 6 webhook sync is available."
			)
		).toBeTruthy();
	});

	it("shows an embedded signing error when Documenso reports an SDK failure", async () => {
		const signingSession: DealClosingPipelineSigningSession = {
			error: null,
			expiresAt: Date.parse("2026-04-30T15:30:00.000Z"),
			host: "https://app.documenso.com",
			instanceId: signableInstanceId,
			isPending: false,
			token: "recipient-token-123",
			url: "https://app.documenso.com/sign/recipient-token-123",
		};
		const view = renderDemo({ signingSession });

		expect(await view.findByTestId("documenso-embed")).toBeTruthy();

		await act(async () => {
			fireEvent.click(view.getByRole("button", { name: "Fail signing" }));
		});

		expect(view.queryByTestId("documenso-embed")).toBeNull();
		expect(view.getByText("Embedded signing unavailable")).toBeTruthy();
		expect(view.getByText("Documenso iframe failed")).toBeTruthy();
	});

	it("does not expose a signing launch for non-current or ineligible instances", () => {
		const view = renderDemo({
			state: buildPipelineState({
				signableCanLaunch: false,
				signableCurrentViewer: false,
			}),
		});

		expect(
			view.queryByRole("button", { name: "Sign Investment Agreement" })
		).toBeNull();

		const blockedRow = view.getByTestId(`package-instance-${blockedInstanceId}`);
		expect(
			within(blockedRow).queryByRole("button", {
				name: "Sign Borrower Disclosure",
			})
		).toBeNull();
	});
});
