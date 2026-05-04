import { makeFunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { httpAction } from "../_generated/server";
import { convex } from "../fluent";
import { jsonResponse } from "../payments/webhooks/utils";
import type { VelocityReadinessBlockerCode } from "./constants";
import type {
	VelocityConnectorCredentialContext,
	VelocityDeal,
	VelocityFairLendEnrichmentV1,
	VelocityMortgageRequest,
	VelocitySubjectProperty,
	VelocityWebhookPayload,
} from "./contracts";
import type {
	ProcessVelocityFullDealSyncArgs,
	VelocityFullDealSyncResult,
} from "./sync";

export const VELOCITY_MOCK_SCENARIO_NAMES = [
	"early_status_package_created",
	"progression_to_funded",
	"missing_link_application_id",
	"duplicate_link_application_id",
	"unsupported_enum",
	"unsupported_payment_frequency",
	"missing_required_core_field",
	"upstream_change_after_final_review",
	"missing_pad",
	"incomplete_bank_data",
	"rotessa_customer_failure",
	"rotessa_schedule_failure",
	"retry_after_remediation",
	"successful_all_or_nothing_activation",
	"post_live_velocity_drift",
] as const;

export type VelocityMockScenarioName =
	(typeof VELOCITY_MOCK_SCENARIO_NAMES)[number];

export interface VelocityMockScenarioRequest {
	amortizationMonths?: number[];
	borrowerCount?: { max: number; min: number };
	duplicateLinkApplicationId?: boolean;
	missingLinkApplicationId?: boolean;
	paymentFrequency?: number[];
	principal?: { max: number; min: number };
	province?: string[];
	rate?: { max: number; min: number };
	scenarioName?: VelocityMockScenarioName;
	seed?: number;
	simulateRotessaCustomerFailure?: boolean;
	simulateRotessaScheduleFailure?: boolean;
	simulateUpstreamChangeAfterReview?: boolean;
	status?: number;
	termMonths?: number[];
	unsupportedEnum?: boolean;
}

export interface VelocityMockScenarioResponse {
	expectedActivationBehavior?: VelocityMockActivationBehavior;
	expectedReadinessBlockers: VelocityReadinessBlockerCode[];
	fairlendEnrichmentPatch?: VelocityMockFairLendEnrichmentPatch;
	linkApplicationId?: string;
	loanCode: string;
	mockDeal: VelocityDeal;
	nextVelocityPatch?: VelocityMockDealPatchRequest;
	scenarioId: string;
	webhookDelivered: boolean;
	webhookPayload: VelocityWebhookPayload;
}

export interface VelocityMockDealPatchRequest {
	borrowers?: VelocityDeal["borrowers"];
	mortgageRequest?: Partial<VelocityMortgageRequest>;
	removeFieldPaths?: string[];
	status?: number;
	subjectProperty?: Partial<VelocitySubjectProperty>;
	unsupportedEnum?: boolean;
}

type JsonRecord = Record<string, unknown>;

export type VelocityMockActivationBehavior =
	| "none"
	| "rotessa_customer_failure"
	| "rotessa_schedule_failure"
	| "retry_after_remediation"
	| "successful_all_or_nothing_activation"
	| "post_live_velocity_drift";

export interface VelocityMockFairLendEnrichmentPatch {
	activationRemediation?: VelocityFairLendEnrichmentV1["activationRemediation"];
	bankInput?: VelocityFairLendEnrichmentV1["bankInput"];
	padEvidenceRequired?: boolean;
}

interface VelocityMockScenarioExpectations {
	expectedActivationBehavior?: VelocityMockActivationBehavior;
	expectedReadinessBlockers: VelocityReadinessBlockerCode[];
	fairlendEnrichmentPatch?: VelocityMockFairLendEnrichmentPatch;
	nextVelocityPatch?: VelocityMockDealPatchRequest;
}

const DEFAULT_SEED = 337;
const DEFAULT_NOW = "2026-04-23T15:00:00.000Z";
const PROVINCE_TO_VELOCITY_CODE: Record<string, number> = {
	AB: 1,
	BC: 2,
	MB: 3,
	NB: 4,
	NL: 5,
	NT: 6,
	NS: 7,
	NU: 8,
	ON: 9,
	PE: 10,
	QC: 11,
	SK: 12,
	YT: 13,
};

const processVelocityFullDealSyncReference = makeFunctionReference<
	"action",
	Record<string, unknown> & ProcessVelocityFullDealSyncArgs,
	Promise<VelocityFullDealSyncResult>
>("velocity/sync:processVelocityFullDealSync");

const storeVelocityMockDealReference = makeFunctionReference<
	"mutation",
	{
		dealJson: string;
		scenarioId: string;
		scenarioName?: string;
		webhookPayloadJson: string;
	},
	Promise<{ mockDealId: Id<"velocityMockDeals"> }>
>("velocity/mock:storeVelocityMockDeal");

const persistVelocityWebhookEventsReference = makeFunctionReference<
	"mutation",
	{
		connectorCredentialContext: VelocityConnectorCredentialContext;
		payload: VelocityWebhookPayload;
		rawBody: string;
	},
	Promise<{
		acceptedEvents: Array<{
			dealHref?: string;
			eventType?: number;
			isDuplicate: boolean;
			loanCode?: string;
			statusCode?: number;
			webhookEventId: Id<"velocityWebhookEvents">;
		}>;
		duplicateEvents: number;
	}>
>("velocity/webhook:persistVelocityWebhookEvents");

const getVelocityMockDealByLoanCodeReference = makeFunctionReference<
	"query",
	{ loanCode: string },
	Promise<{
		dealJson: string;
		loanCode: string;
		scenarioId: string;
		scenarioName?: string;
		webhookPayloadJson: string;
	} | null>
>("velocity/mock:getVelocityMockDealByLoanCode");

const patchVelocityMockDealReference = makeFunctionReference<
	"mutation",
	{ loanCode: string; patchJson: string },
	Promise<VelocityMockScenarioResponse>
>("velocity/mock:patchVelocityMockDealRecord");

const deliverVelocityMockScenarioReference = makeFunctionReference<
	"action",
	{ loanCode: string },
	Promise<VelocityFullDealSyncResult>
>("velocity/mock:deliverVelocityMockScenario");

function assertMockVelocityEnabled() {
	if (
		process.env.NODE_ENV === "production" &&
		process.env.ALLOW_VELOCITY_DEV_ENDPOINTS !== "true"
	) {
		throw new ConvexError(
			"Mock Velocity endpoints are disabled in production."
		);
	}
}

function createSeededRandom(seed: number) {
	let state = seed >>> 0;
	return () => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 0x1_00_00_00_00;
	};
}

function integerInRange(
	random: () => number,
	range: { max: number; min: number }
) {
	const min = Math.ceil(range.min);
	const max = Math.floor(range.max);
	return Math.floor(random() * (max - min + 1)) + min;
}

function numberInRange(
	random: () => number,
	range: { max: number; min: number },
	decimals: number
) {
	const scale = 10 ** decimals;
	return (
		Math.round((range.min + random() * (range.max - range.min)) * scale) / scale
	);
}

function pick<T>(random: () => number, values: readonly T[], fallback: T): T {
	if (values.length === 0) {
		return fallback;
	}
	return values[Math.floor(random() * values.length)] ?? fallback;
}

function scenarioDefaults(
	scenarioName?: VelocityMockScenarioName
): VelocityMockScenarioRequest {
	switch (scenarioName) {
		case "early_status_package_created":
			return { status: 4 };
		case "progression_to_funded":
		case "retry_after_remediation":
		case "successful_all_or_nothing_activation":
		case "post_live_velocity_drift":
			return { status: 6 };
		case "missing_link_application_id":
			return { missingLinkApplicationId: true, status: 6 };
		case "duplicate_link_application_id":
			return { duplicateLinkApplicationId: true, status: 6 };
		case "unsupported_enum":
			return { status: 6, unsupportedEnum: true };
		case "unsupported_payment_frequency":
			return { paymentFrequency: [4], status: 6 };
		case "missing_required_core_field":
			return { status: 6 };
		case "upstream_change_after_final_review":
			return { simulateUpstreamChangeAfterReview: true, status: 6 };
		case "missing_pad":
		case "incomplete_bank_data":
		case "rotessa_customer_failure":
		case "rotessa_schedule_failure":
			return { status: 6 };
		default:
			return {};
	}
}

function completeActivationRemediation(): NonNullable<
	VelocityFairLendEnrichmentV1["activationRemediation"]
> {
	return {
		lienPosition: 1,
		loanType: "conventional",
	};
}

function completeBankInput(): NonNullable<
	VelocityFairLendEnrichmentV1["bankInput"]
> {
	return {
		accountHolderName: "Velocity Borrower",
		accountLast4: "6789",
		accountNumber: "123456789",
		country: "CA",
		currency: "CAD",
		institutionNumber: "001",
		transitNumber: "00011",
	};
}

function completeFairLendEnrichmentPatch(): VelocityMockFairLendEnrichmentPatch {
	return {
		activationRemediation: completeActivationRemediation(),
		bankInput: completeBankInput(),
		padEvidenceRequired: true,
	};
}

function scenarioExpectations(
	scenarioName?: VelocityMockScenarioName
): VelocityMockScenarioExpectations {
	switch (scenarioName) {
		case "early_status_package_created":
			return { expectedReadinessBlockers: ["velocity_not_funded"] };
		case "progression_to_funded":
			return {
				expectedReadinessBlockers: [
					"missing_bank_data",
					"missing_pad_pdf",
					"missing_fairlend_owned_field",
				],
			};
		case "missing_link_application_id":
			return { expectedReadinessBlockers: ["missing_link_application_id"] };
		case "duplicate_link_application_id":
			return { expectedReadinessBlockers: ["identity_collision"] };
		case "unsupported_enum":
			return {
				expectedReadinessBlockers: [
					"unsupported_velocity_status",
					"missing_required_core_field",
				],
			};
		case "unsupported_payment_frequency":
			return { expectedReadinessBlockers: ["unsupported_payment_frequency"] };
		case "missing_required_core_field":
			return { expectedReadinessBlockers: ["missing_required_core_field"] };
		case "upstream_change_after_final_review":
			return {
				expectedReadinessBlockers: ["upstream_changed_after_review"],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
				nextVelocityPatch: {
					mortgageRequest: { rate: 12.25 },
				},
			};
		case "missing_pad":
			return {
				expectedReadinessBlockers: ["missing_pad_pdf"],
				fairlendEnrichmentPatch: {
					activationRemediation: completeActivationRemediation(),
					bankInput: completeBankInput(),
					padEvidenceRequired: false,
				},
			};
		case "incomplete_bank_data":
			return {
				expectedReadinessBlockers: ["missing_bank_data"],
				fairlendEnrichmentPatch: {
					activationRemediation: completeActivationRemediation(),
					bankInput: {
						accountHolderName: "Velocity Borrower",
						accountLast4: "6789",
						country: "CA",
						currency: "CAD",
						institutionNumber: "001",
					},
					padEvidenceRequired: true,
				},
			};
		case "rotessa_customer_failure":
			return {
				expectedActivationBehavior: "rotessa_customer_failure",
				expectedReadinessBlockers: [],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
			};
		case "rotessa_schedule_failure":
			return {
				expectedActivationBehavior: "rotessa_schedule_failure",
				expectedReadinessBlockers: [],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
			};
		case "retry_after_remediation":
			return {
				expectedActivationBehavior: "retry_after_remediation",
				expectedReadinessBlockers: [],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
			};
		case "successful_all_or_nothing_activation":
			return {
				expectedActivationBehavior: "successful_all_or_nothing_activation",
				expectedReadinessBlockers: [],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
			};
		case "post_live_velocity_drift":
			return {
				expectedActivationBehavior: "post_live_velocity_drift",
				expectedReadinessBlockers: [],
				fairlendEnrichmentPatch: completeFairLendEnrichmentPatch(),
				nextVelocityPatch: {
					mortgageRequest: { rate: 12.25 },
				},
			};
		default:
			return {
				expectedReadinessBlockers: [
					"missing_bank_data",
					"missing_pad_pdf",
					"missing_fairlend_owned_field",
				],
			};
	}
}

function mergeScenarioRequest(
	request: VelocityMockScenarioRequest
): VelocityMockScenarioRequest {
	return {
		...scenarioDefaults(request.scenarioName),
		...request,
	};
}

function scenarioSeed(request: VelocityMockScenarioRequest) {
	if (typeof request.seed === "number" && Number.isFinite(request.seed)) {
		return request.seed;
	}
	const name = request.scenarioName ?? "velocity_mock";
	return (
		DEFAULT_SEED +
		Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0)
	);
}

function scenarioIdFrom(seed: number, scenarioName?: string) {
	return `velocity-mock-${scenarioName ?? "scenario"}-${seed}`;
}

function loanCodeFrom(seed: number) {
	return `MOCK-LC-${String(seed).padStart(5, "0")}`;
}

function linkApplicationIdFrom(
	seed: number,
	request: VelocityMockScenarioRequest
) {
	if (request.missingLinkApplicationId) {
		return undefined;
	}
	if (request.duplicateLinkApplicationId) {
		return "MOCK-LINK-DUPLICATE";
	}
	return `MOCK-LINK-${String(seed).padStart(5, "0")}`;
}

function buildBorrowers(
	count: number,
	seed: number
): VelocityDeal["borrowers"] {
	return Array.from({ length: count }, (_, index) => ({
		cellPhone: `416555${String(seed + index)
			.slice(-4)
			.padStart(4, "0")}`,
		email: `velocity.borrower.${seed}.${index + 1}@example.test`,
		firstName: index === 0 ? "Velocity" : "Co",
		lastName: `Borrower ${index + 1}`,
	}));
}

function buildWebhookPayload(args: {
	loanCode: string;
	status: number;
}): VelocityWebhookPayload {
	return {
		agent: {
			email: "mock.velocity.agent@example.test",
			firmCode: "MOCK-FIRM",
			firstName: "Mock",
			lastName: "Velocity",
			tenantId: "mock-tenant",
			username: "mock.velocity.agent",
		},
		events: [
			{
				deal: {
					loanCode: args.loanCode,
					status: args.status,
				},
				eventType: 10,
				links: [
					{
						href: `/api/dev/mock-velocity/v1/deals?loancode=${encodeURIComponent(args.loanCode)}`,
						method: "GET",
						rel: "deal",
					},
				],
				timestamp: DEFAULT_NOW,
			},
		],
		timestamp: DEFAULT_NOW,
	};
}

export function buildVelocityMockScenario(
	input: VelocityMockScenarioRequest = {}
): VelocityMockScenarioResponse {
	const request = mergeScenarioRequest(input);
	const seed = scenarioSeed(request);
	const random = createSeededRandom(seed);
	const scenarioId = scenarioIdFrom(seed, request.scenarioName);
	const loanCode = loanCodeFrom(seed);
	const linkApplicationId = linkApplicationIdFrom(seed, request);
	const borrowerCount = integerInRange(
		random,
		request.borrowerCount ?? { max: 2, min: 1 }
	);
	const province = pick(random, request.province ?? ["ON", "BC", "AB"], "ON");
	const principal = integerInRange(
		random,
		request.principal ?? { max: 900_000, min: 150_000 }
	);
	const rate = numberInRange(
		random,
		request.rate ?? { max: 12.5, min: 6.5 },
		2
	);
	const termMonths = pick(random, request.termMonths ?? [12, 24, 36], 12);
	const amortizationMonths = pick(
		random,
		request.amortizationMonths ?? [240, 300],
		300
	);
	const paymentFrequency = pick(
		random,
		request.paymentFrequency ?? [1, 2, 3, 5],
		3
	);
	const status = request.status ?? 6;
	const expectations = scenarioExpectations(request.scenarioName);
	const requestedPrincipal =
		request.scenarioName === "missing_required_core_field"
			? undefined
			: principal;
	const deal: VelocityDeal = {
		agent: "Mock Velocity Agent",
		borrowers: buildBorrowers(borrowerCount, seed),
		closingDate: "2026-05-01",
		conditions: [{ isApproved: false, isSent: true, name: "PAD evidence" }],
		customSource: "fairlend_mock_velocity",
		dateCreated: DEFAULT_NOW,
		isConfirmedCompliant: true,
		lenderConditions: ["Mock lender condition"],
		lenderReferenceNumber: `MOCK-LENDER-${seed}`,
		linkApplicationId,
		loanCode,
		mockScenario: {
			expectedActivationBehavior:
				expectations.expectedActivationBehavior ?? "none",
			expectedReadinessBlockers: expectations.expectedReadinessBlockers,
			fairlendEnrichmentPatch: expectations.fairlendEnrichmentPatch,
			nextVelocityPatch: expectations.nextVelocityPatch,
			scenarioName: request.scenarioName ?? "custom",
		},
		mortgageRequest: {
			amortizationMonths,
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			lenderName: "Mock Velocity Lender",
			maturityDate: "2027-05-01",
			mortgages:
				requestedPrincipal == null ? [] : [{ amount: requestedPrincipal }],
			payment: Math.round((principal * (rate / 100)) / 12),
			paymentFrequency,
			purpose: 10,
			rate,
			rateType: request.unsupportedEnum ? 999 : 4,
			termInMonths: termMonths,
		},
		notes: [{ dateCreated: "2026-04-23", text: "Mock Velocity scenario" }],
		status,
		subjectProperty: {
			city: "Toronto",
			intendedUse: 1,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: PROVINCE_TO_VELOCITY_CODE[province] ?? 9,
			purchasePrice: Math.round(principal * 1.4),
			streetName: "King",
			streetNumber: String(100 + (seed % 800)),
			unitNumber: "1201",
		},
	};

	return {
		expectedActivationBehavior: expectations.expectedActivationBehavior,
		expectedReadinessBlockers: expectations.expectedReadinessBlockers,
		fairlendEnrichmentPatch: expectations.fairlendEnrichmentPatch,
		linkApplicationId,
		loanCode,
		mockDeal: deal,
		nextVelocityPatch: expectations.nextVelocityPatch,
		scenarioId,
		webhookDelivered: false,
		webhookPayload: buildWebhookPayload({ loanCode, status }),
	};
}

function scenarioNameFromRequest(request: VelocityMockScenarioRequest) {
	return request.scenarioName;
}

function cloneRecord(value: unknown): JsonRecord {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}
	return JSON.parse(JSON.stringify(value)) as JsonRecord;
}

function removePath(target: JsonRecord, path: string) {
	const segments = path.split(".").filter(Boolean);
	let cursor: JsonRecord | null = target;
	for (const [index, segment] of segments.entries()) {
		if (!cursor) {
			return;
		}
		if (index === segments.length - 1) {
			delete cursor[segment];
			return;
		}
		const nextValue: unknown = cursor[segment];
		cursor =
			nextValue && typeof nextValue === "object" && !Array.isArray(nextValue)
				? (nextValue as JsonRecord)
				: null;
	}
}

export function patchVelocityMockDeal(
	deal: VelocityDeal,
	patch: VelocityMockDealPatchRequest
): VelocityDeal {
	const next = cloneRecord(deal);
	if (patch.status !== undefined) {
		next.status = patch.status;
	}
	if (patch.borrowers !== undefined) {
		next.borrowers = patch.borrowers;
	}
	if (patch.mortgageRequest) {
		next.mortgageRequest = {
			...cloneRecord(next.mortgageRequest),
			...patch.mortgageRequest,
		};
	}
	if (patch.subjectProperty) {
		next.subjectProperty = {
			...cloneRecord(next.subjectProperty),
			...patch.subjectProperty,
		};
	}
	if (patch.unsupportedEnum) {
		next.status = 999;
		const mortgageRequest = cloneRecord(next.mortgageRequest);
		mortgageRequest.rateType = 999;
		next.mortgageRequest = mortgageRequest;
	}
	for (const path of patch.removeFieldPaths ?? []) {
		removePath(next, path);
	}
	return next as VelocityDeal;
}

function parseJsonRecord(raw: string): JsonRecord {
	const parsed = JSON.parse(raw) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new ConvexError("Expected a JSON object.");
	}
	return parsed as JsonRecord;
}

function parseScenarioRequest(raw: string): VelocityMockScenarioRequest {
	return parseJsonRecord(raw) as VelocityMockScenarioRequest;
}

function parsePatchRequest(raw: string): VelocityMockDealPatchRequest {
	return parseJsonRecord(raw) as VelocityMockDealPatchRequest;
}

function storedDealResponse(args: {
	deal: VelocityDeal;
	scenarioId: string;
	scenarioName?: VelocityMockScenarioName;
	webhookDelivered: boolean;
	webhookPayload: VelocityWebhookPayload;
}): VelocityMockScenarioResponse {
	const expectations = scenarioExpectations(args.scenarioName);
	return {
		expectedActivationBehavior: expectations.expectedActivationBehavior,
		expectedReadinessBlockers: expectations.expectedReadinessBlockers,
		fairlendEnrichmentPatch: expectations.fairlendEnrichmentPatch,
		linkApplicationId: args.deal.linkApplicationId ?? undefined,
		loanCode: args.deal.loanCode ?? "",
		mockDeal: args.deal,
		nextVelocityPatch: expectations.nextVelocityPatch,
		scenarioId: args.scenarioId,
		webhookDelivered: args.webhookDelivered,
		webhookPayload: args.webhookPayload,
	};
}

const MOCK_WEBHOOK_CREDENTIAL_CONTEXT = {
	credentialId: "mock-velocity-webhook",
	provider: "velocity",
	scope: "mock_velocity",
	usedFor: "webhook_ingress",
} satisfies VelocityConnectorCredentialContext;

export const storeVelocityMockDeal = convex
	.mutation()
	.input({
		dealJson: v.string(),
		scenarioId: v.string(),
		scenarioName: v.optional(v.string()),
		webhookPayloadJson: v.string(),
	})
	.handler(async (ctx, args) => {
		assertMockVelocityEnabled();
		const deal = parseJsonRecord(args.dealJson) as VelocityDeal;
		const loanCode = deal.loanCode;
		if (!loanCode) {
			throw new ConvexError("Mock Velocity deal requires loanCode.");
		}
		const existing = await ctx.db
			.query("velocityMockDeals")
			.withIndex("by_loan_code", (query) => query.eq("loanCode", loanCode))
			.first();
		const now = Date.now();
		if (existing) {
			await ctx.db.patch(existing._id, {
				dealJson: args.dealJson,
				linkApplicationId: deal.linkApplicationId ?? undefined,
				scenarioId: args.scenarioId,
				scenarioName: args.scenarioName,
				updatedAt: now,
				webhookPayloadJson: args.webhookPayloadJson,
			});
			return { mockDealId: existing._id };
		}
		return {
			mockDealId: await ctx.db.insert("velocityMockDeals", {
				createdAt: now,
				dealJson: args.dealJson,
				linkApplicationId: deal.linkApplicationId ?? undefined,
				loanCode,
				scenarioId: args.scenarioId,
				scenarioName: args.scenarioName,
				updatedAt: now,
				webhookPayloadJson: args.webhookPayloadJson,
			}),
		};
	})
	.internal();

export const getVelocityMockDealByLoanCode = convex
	.query()
	.input({ loanCode: v.string() })
	.handler(async (ctx, args) => {
		assertMockVelocityEnabled();
		const deal = await ctx.db
			.query("velocityMockDeals")
			.withIndex("by_loan_code", (query) => query.eq("loanCode", args.loanCode))
			.first();
		if (!deal) {
			return null;
		}
		return {
			dealJson: deal.dealJson,
			loanCode: deal.loanCode,
			scenarioId: deal.scenarioId,
			scenarioName: deal.scenarioName,
			webhookPayloadJson: deal.webhookPayloadJson,
		};
	})
	.internal();

export const patchVelocityMockDealRecord = convex
	.mutation()
	.input({ loanCode: v.string(), patchJson: v.string() })
	.handler(async (ctx, args) => {
		assertMockVelocityEnabled();
		const stored = await ctx.db
			.query("velocityMockDeals")
			.withIndex("by_loan_code", (query) => query.eq("loanCode", args.loanCode))
			.first();
		if (!stored) {
			throw new ConvexError("Mock Velocity deal not found.");
		}
		const deal = JSON.parse(stored.dealJson) as VelocityDeal;
		const patch = parsePatchRequest(args.patchJson);
		const patched = patchVelocityMockDeal(deal, patch);
		const webhookPayload = buildWebhookPayload({
			loanCode: patched.loanCode ?? stored.loanCode,
			status: typeof patched.status === "number" ? patched.status : 0,
		});
		await ctx.db.patch(stored._id, {
			dealJson: JSON.stringify(patched),
			linkApplicationId: patched.linkApplicationId ?? undefined,
			updatedAt: Date.now(),
			webhookPayloadJson: JSON.stringify(webhookPayload),
		});
		return storedDealResponse({
			deal: patched,
			scenarioId: stored.scenarioId,
			scenarioName: stored.scenarioName as VelocityMockScenarioName | undefined,
			webhookDelivered: false,
			webhookPayload,
		});
	})
	.internal();

export const deliverVelocityMockScenario = convex
	.action()
	.input({ loanCode: v.string() })
	.handler(async (ctx, args) => {
		assertMockVelocityEnabled();
		const stored = await ctx.runQuery(getVelocityMockDealByLoanCodeReference, {
			loanCode: args.loanCode,
		});
		if (!stored) {
			throw new ConvexError("Mock Velocity deal not found.");
		}
		const webhookPayload = JSON.parse(
			stored.webhookPayloadJson
		) as VelocityWebhookPayload;
		const persisted = await ctx.runMutation(
			persistVelocityWebhookEventsReference,
			{
				connectorCredentialContext: MOCK_WEBHOOK_CREDENTIAL_CONTEXT,
				payload: webhookPayload,
				rawBody: stored.webhookPayloadJson,
			}
		);
		const acceptedEvent = persisted.acceptedEvents.find(
			(event) => !event.isDuplicate && event.loanCode === args.loanCode
		);
		const replayEvent =
			acceptedEvent ??
			persisted.acceptedEvents.find(
				(event) => event.loanCode === args.loanCode
			);
		if (!replayEvent) {
			throw new ConvexError("Mock Velocity webhook event was not accepted.");
		}
		return await ctx.runAction(processVelocityFullDealSyncReference, {
			dealHref: replayEvent?.dealHref,
			loanCode: args.loanCode,
			trigger: "mock_scenario",
			webhookAgent: webhookPayload.agent ?? undefined,
			webhookCredentialContext: MOCK_WEBHOOK_CREDENTIAL_CONTEXT,
			webhookEventId: replayEvent?.webhookEventId,
		});
	})
	.internal();

export const createVelocityMockScenario = httpAction(async (ctx, request) => {
	assertMockVelocityEnabled();
	const body = await request.text();
	const scenario = buildVelocityMockScenario(
		body.trim() ? parseScenarioRequest(body) : {}
	);
	const scenarioRequest = body.trim() ? parseScenarioRequest(body) : {};
	await ctx.runMutation(storeVelocityMockDealReference, {
		dealJson: JSON.stringify(scenario.mockDeal),
		scenarioId: scenario.scenarioId,
		scenarioName: scenarioNameFromRequest(scenarioRequest),
		webhookPayloadJson: JSON.stringify(scenario.webhookPayload),
	});
	await ctx.runAction(deliverVelocityMockScenarioReference, {
		loanCode: scenario.loanCode,
	});
	return jsonResponse({
		...scenario,
		webhookDelivered: true,
	});
});

export const deliverVelocityMockWebhook = httpAction(async (ctx, request) => {
	assertMockVelocityEnabled();
	const body = await request.text();
	const parsed = body.trim() ? parseJsonRecord(body) : {};
	let loanCode: string | undefined;
	if (typeof parsed.loanCode === "string") {
		loanCode = parsed.loanCode;
	} else if (typeof parsed.loancode === "string") {
		loanCode = parsed.loancode;
	}
	if (!loanCode) {
		return jsonResponse({ error: "loanCode is required", ok: false }, 400);
	}
	const result = await ctx.runAction(deliverVelocityMockScenarioReference, {
		loanCode,
	});
	return jsonResponse({ ok: true, result });
});

export const fetchVelocityMockDeal = httpAction(async (ctx, request) => {
	assertMockVelocityEnabled();
	const url = new URL(request.url);
	const loanCode =
		url.searchParams.get("loancode") ?? url.searchParams.get("loanCode");
	if (!loanCode) {
		return jsonResponse({ error: "loancode is required" }, 400);
	}
	const stored = await ctx.runQuery(getVelocityMockDealByLoanCodeReference, {
		loanCode,
	});
	if (!stored) {
		return jsonResponse({
			deals: [],
			pageNumber: 1,
			totalDeals: 0,
			totalPages: 1,
		});
	}
	return jsonResponse({
		deals: [JSON.parse(stored.dealJson) as VelocityDeal],
		pageNumber: 1,
		totalDeals: 1,
		totalPages: 1,
	});
});

export const searchVelocityMockDeals = httpAction(async (ctx, request) => {
	assertMockVelocityEnabled();
	const body = await request.text();
	const parsed = body.trim() ? parseJsonRecord(body) : {};
	const loanCodes = Array.isArray(parsed.loanCodes)
		? parsed.loanCodes.filter(
				(value): value is string => typeof value === "string"
			)
		: [];
	if (loanCodes.length === 0) {
		return jsonResponse({
			deals: [],
			pageNumber: 1,
			totalDeals: 0,
			totalPages: 1,
		});
	}
	const deals: VelocityDeal[] = [];
	for (const loanCode of loanCodes) {
		const stored = await ctx.runQuery(getVelocityMockDealByLoanCodeReference, {
			loanCode,
		});
		if (stored) {
			deals.push(JSON.parse(stored.dealJson) as VelocityDeal);
		}
	}
	return jsonResponse({
		deals,
		pageNumber: 1,
		totalDeals: deals.length,
		totalPages: 1,
	});
});

export const patchVelocityMockDealHttp = httpAction(async (ctx, request) => {
	assertMockVelocityEnabled();
	const url = new URL(request.url);
	const pathPrefix = "/api/dev/mock-velocity/deals/";
	const loanCode =
		url.pathname.startsWith(pathPrefix) &&
		url.pathname.length > pathPrefix.length
			? decodeURIComponent(url.pathname.slice(pathPrefix.length))
			: (url.searchParams.get("loancode") ?? url.searchParams.get("loanCode"));
	if (!loanCode) {
		return jsonResponse({ error: "loanCode is required" }, 400);
	}
	const patchJson = await request.text();
	const response = await ctx.runMutation(patchVelocityMockDealReference, {
		loanCode,
		patchJson: patchJson.trim() ? patchJson : "{}",
	});
	return jsonResponse({ ...response });
});
