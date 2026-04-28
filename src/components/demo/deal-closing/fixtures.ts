export type ClosingStage =
	| "locked"
	| "lawyer"
	| "documents"
	| "transfer"
	| "review"
	| "completed";

export type EnvelopeTone = "blue" | "green" | "orange" | "purple";

export interface PublishedSignableTemplateFixture {
	basePdfId: string;
	name: string;
	publishedAt: number;
	signableRoles: string[];
	signatureFieldCount: number;
	templateId: string;
	version: number;
	versionId: string;
}

export interface ClosingEnvelopeFixture {
	completedAt?: string;
	completedBy?: string;
	envelopeId: string;
	finalAction: string;
	id: string;
	isSignableTemplateSource?: boolean;
	name: string;
	nextRequired: string;
	progress: number;
	signingHtml?: string;
	status: "future" | "ready" | "waiting" | "complete" | "aging";
	template?: PublishedSignableTemplateFixture;
	tone: EnvelopeTone;
	waitingFor: string;
}

export type QuickActionDestination =
	| { type: "embeddedSigning"; envelopeId: string }
	| { type: "section"; sectionId: string };

export interface ClosingQuickActionFixture {
	assigneeName: string;
	assigneeRole: string;
	assigneeUserId: string;
	description: string;
	destination: QuickActionDestination;
	dueLabel: string;
	envelopeId?: string;
	id: string;
	label: string;
	priority: "normal" | "aging" | "blocked";
}

export interface DealClosingPipelineFixture {
	activeEnvelopeId: string;
	auditTrail: Array<{
		actor: string;
		label: string;
		state: "complete" | "current" | "future";
		when: string;
	}>;
	deal: {
		createdLabel: string;
		currentAction: string;
		id: string;
		stage: ClosingStage;
		statusLabel: string;
		statusTone: "green" | "orange" | "purple";
		title: string;
	};
	envelopes: ClosingEnvelopeFixture[];
	parties: Array<{
		detail: string;
		name: string;
		role: string;
		tone: EnvelopeTone;
	}>;
	property: Array<{
		label: string;
		value: string;
	}>;
	quickActions: ClosingQuickActionFixture[];
	summary: Array<{
		label: string;
		value: string;
	}>;
	template: PublishedSignableTemplateFixture;
	viewer: {
		name: string;
		role: string;
		userId: string;
	};
}

const publishedSignableTemplate: PublishedSignableTemplateFixture = {
	basePdfId: "p971g63dfv4y7psszm9emg3tc182rtn8",
	name: "loanaggreement",
	publishedAt: Date.parse("2026-04-27T16:00:58.435Z"),
	signableRoles: ["lender", "lender_lawyer"],
	signatureFieldCount: 2,
	templateId: "pn73mjvjmydxe649rpvwn41w6d82rxfg",
	version: 3,
	versionId: "ph7dyktb64q56t5a30pg7wz9sh85qpmg",
};

export const dealClosingPipelineFixture: DealClosingPipelineFixture = {
	activeEnvelopeId: "investment-agreement",
	auditTrail: [
		{
			actor: "Documenso",
			label: "Investor signature requested",
			state: "current",
			when: "Mar 13",
		},
		{
			actor: "Smith LLP",
			label: "Lawyer package completed",
			state: "complete",
			when: "Mar 12",
		},
		{
			actor: "Sarah Chen",
			label: "Deal locked by investor",
			state: "complete",
			when: "Mar 8",
		},
		{
			actor: "Future state",
			label: "Funds transfer pending",
			state: "future",
			when: "",
		},
	],
	deal: {
		createdLabel: "Created March 8, 2026 - Documents open for 18 hours",
		currentAction: "Investor signature required",
		id: "FLD-2026-0142",
		stage: "documents",
		statusLabel: "Documents in progress",
		statusTone: "green",
		title: "47 Willowdale Ave, North York",
	},
	envelopes: [
		{
			envelopeId: "FL-DA-1042",
			finalAction: "Investor signed",
			id: "investment-agreement",
			isSignableTemplateSource: true,
			name: "Investment Agreement",
			nextRequired: "Investor - sign",
			progress: 68,
			signingHtml: buildDocumensoSigningHtml({
				documentName: "Investment Agreement",
				envelopeId: "FL-DA-1042",
				recipientName: "Sarah Chen",
				template: publishedSignableTemplate,
			}),
			status: "waiting",
			template: publishedSignableTemplate,
			tone: "green",
			waitingFor: "18 hours",
		},
		{
			envelopeId: "FL-DA-1043",
			finalAction: "Lawyer approved",
			id: "mortgage-assignment",
			name: "Mortgage Assignment",
			nextRequired: "Lawyer - approve",
			progress: 52,
			status: "waiting",
			tone: "blue",
			waitingFor: "2 days",
		},
		{
			envelopeId: "FL-DA-1044",
			finalAction: "Borrower acknowledged",
			id: "disclosure-statement",
			name: "Disclosure Statement",
			nextRequired: "Borrower - acknowledge",
			progress: 84,
			status: "waiting",
			tone: "purple",
			waitingFor: "4 hours",
		},
		{
			envelopeId: "FL-DA-1045",
			finalAction: "Title company countersigned",
			id: "title-transfer-deed",
			name: "Title Transfer Deed",
			nextRequired: "Title company - countersign",
			progress: 41,
			status: "aging",
			tone: "orange",
			waitingFor: "5 days",
		},
	],
	parties: [
		{
			detail: "s.chen@email.com",
			name: "Sarah Chen",
			role: "Investor",
			tone: "blue",
		},
		{
			detail: "d.okonkwo@email.com",
			name: "David Okonkwo",
			role: "Borrower",
			tone: "orange",
		},
		{
			detail: "Completed KYC and trust review",
			name: "Smith & Associates LLP",
			role: "Lawyer",
			tone: "purple",
		},
		{
			detail: "Lic #M12045891",
			name: "Apex Mortgage Group",
			role: "Broker",
			tone: "green",
		},
	],
	property: [
		{ label: "Loan Amount", value: "$450,000" },
		{ label: "Interest Rate", value: "8.50%" },
		{ label: "Mortgage Type", value: "First Position - Fixed" },
		{ label: "Purchase %", value: "1.0%" },
		{ label: "Address", value: "47 Willowdale Ave, North York, ON M2N 4Z2" },
		{ label: "MLS #", value: "FLM-2026-0847" },
	],
	quickActions: [
		{
			assigneeName: "Sarah Chen",
			assigneeRole: "Investor",
			assigneeUserId: "user_sarah_chen",
			description:
				"Sign the investment agreement generated from the published template.",
			destination: {
				envelopeId: "investment-agreement",
				type: "embeddedSigning",
			},
			dueLabel: "Due in 18h",
			envelopeId: "FL-DA-1042",
			id: "qa-investment-signature",
			label: "Sign Investment Agreement",
			priority: "normal",
		},
		{
			assigneeName: "Smith & Associates LLP",
			assigneeRole: "Lawyer",
			assigneeUserId: "org_smith_associates",
			description:
				"Approve the mortgage assignment package before transfer can open.",
			destination: {
				sectionId: "document-envelopes",
				type: "section",
			},
			dueLabel: "Waiting 2 days",
			envelopeId: "FL-DA-1043",
			id: "qa-lawyer-assignment-approval",
			label: "Approve Mortgage Assignment",
			priority: "normal",
		},
		{
			assigneeName: "David Okonkwo",
			assigneeRole: "Borrower",
			assigneeUserId: "user_david_okonkwo",
			description:
				"Acknowledge the disclosure statement in the closing package.",
			destination: {
				sectionId: "document-envelopes",
				type: "section",
			},
			dueLabel: "Waiting 4h",
			envelopeId: "FL-DA-1044",
			id: "qa-borrower-disclosure-ack",
			label: "Acknowledge Disclosure Statement",
			priority: "normal",
		},
		{
			assigneeName: "TitleCo North",
			assigneeRole: "Title company",
			assigneeUserId: "org_titleco_north",
			description: "Countersign the title transfer deed; this item is aging.",
			destination: {
				sectionId: "document-envelopes",
				type: "section",
			},
			dueLabel: "Waiting 5 days",
			envelopeId: "FL-DA-1045",
			id: "qa-title-transfer-countersign",
			label: "Countersign Title Transfer Deed",
			priority: "aging",
		},
	],
	summary: [
		{ label: "Deal Value", value: "$4,500.00" },
		{ label: "Purchase %", value: "1.0%" },
		{ label: "Doc Stage Opened", value: "Mar 12, 2026" },
		{ label: "Days Active", value: "9" },
	],
	template: publishedSignableTemplate,
	viewer: {
		name: "Sarah Chen",
		role: "Investor",
		userId: "user_sarah_chen",
	},
};

function buildDocumensoSigningHtml(args: {
	documentName: string;
	envelopeId: string;
	recipientName: string;
	template: PublishedSignableTemplateFixture;
}) {
	return `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>Documenso Signing</title>
	<style>
		:root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
		body { margin: 0; background: #f6f7f4; color: #101915; }
		.shell { min-height: 100vh; display: grid; grid-template-rows: auto 1fr auto; }
		header { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #d9ded8; background: #fff; padding: 18px 24px; }
		.brand { font-weight: 700; color: #173d34; letter-spacing: -0.01em; }
		.badge { border: 1px solid #cfe0d5; border-radius: 6px; background: #f8fbf8; color: #115d45; font-size: 12px; font-weight: 700; padding: 7px 10px; }
		main { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 20px; padding: 22px; }
		.document { min-height: 720px; border: 1px solid #d9ded8; background: #fff; box-shadow: 0 12px 32px rgba(23, 58, 48, 0.08); }
		.page { margin: 28px auto; width: min(640px, calc(100% - 56px)); min-height: 840px; border: 1px solid #e1e4e0; padding: 42px; box-sizing: border-box; }
		h1 { font-size: 24px; line-height: 1.2; margin: 0 0 24px; }
		.line { height: 10px; background: #eef1ed; border-radius: 99px; margin: 14px 0; }
		.line.short { width: 62%; }
		.field { margin-top: 46px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
		.signbox { border: 2px solid #115d45; border-radius: 6px; height: 72px; display: grid; place-items: center; color: #115d45; font-weight: 700; background: #f8fcfa; }
		.panel { border: 1px solid #d9ded8; background: #fff; padding: 18px; align-self: start; }
		.panel h2 { font-size: 13px; margin: 0 0 14px; color: #173d34; letter-spacing: 0.04em; text-transform: uppercase; }
		.row { border-top: 1px solid #ecefeb; padding: 12px 0; }
		.label { color: #6f7771; font-size: 12px; }
		.value { margin-top: 3px; font-weight: 700; }
		footer { display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid #d9ded8; background: #fff; padding: 16px 24px; }
		button { border: 1px solid #d6ddd8; border-radius: 6px; background: #fff; padding: 11px 18px; font-weight: 700; }
		button.primary { border-color: #115d45; background: #115d45; color: #fff; }
		@media (max-width: 860px) { main { grid-template-columns: 1fr; } .page { width: calc(100% - 28px); padding: 24px; } }
	</style>
</head>
<body>
	<div class="shell">
		<header>
			<div class="brand">documenso</div>
			<div class="badge">Embedded signing session</div>
		</header>
		<main>
			<section class="document" aria-label="Document preview">
				<div class="page">
					<h1>${args.documentName}</h1>
					<div class="line"></div>
					<div class="line"></div>
					<div class="line short"></div>
					<div class="field">
						<div>
							<div class="label">Signer</div>
							<div class="value">${args.recipientName}</div>
						</div>
						<div class="signbox">Click to Sign</div>
					</div>
				</div>
			</section>
			<aside class="panel">
				<h2>Signing Details</h2>
				<div class="row"><div class="label">Envelope</div><div class="value">${args.envelopeId}</div></div>
				<div class="row"><div class="label">Template</div><div class="value">${args.template.name} v${args.template.version}</div></div>
				<div class="row"><div class="label">Roles</div><div class="value">${args.template.signableRoles.join(", ")}</div></div>
				<div class="row"><div class="label">Signature fields</div><div class="value">${args.template.signatureFieldCount}</div></div>
			</aside>
		</main>
		<footer>
			<button>Decline</button>
			<button class="primary">Complete signing</button>
		</footer>
	</div>
</body>
</html>`;
}
