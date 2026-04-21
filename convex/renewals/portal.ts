import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { executeTransition } from "../engine/transition";
import {
	portalLenderMutation,
	portalLenderQuery,
	requirePermission,
} from "../fluent";
import {
	buildLenderRenewalTimeline,
	LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS,
	type LenderRenewalIntentChoice,
	renewalSignalEventForIntent,
} from "./constants";
import {
	ensurePendingLenderRenewalIntent,
	findCurrentPositionAccount,
	findExistingLenderRenewalIntent,
	getCurrentHeldFractions,
	loadMortgageOrThrow,
} from "./runtime";

const lenderRenewalIntentChoiceValidator = v.union(
	v.literal("renew"),
	v.literal("exit"),
	v.literal("partial_exit")
);

type LenderRenewalIntentDoc =
	Awaited<ReturnType<typeof findExistingLenderRenewalIntent>> extends infer TDoc
		? Exclude<TDoc, null>
		: never;
type RenewalProjectionContext = Parameters<
	typeof findCurrentPositionAccount
>[0]["ctx"] & {
	viewer: {
		authId: string;
	};
};
type RenewalMutationContext = MutationCtx & {
	lender: Doc<"lenders">;
	viewer: {
		authId: string;
	};
};
type MortgageDoc = Awaited<ReturnType<typeof loadMortgageOrThrow>>;
type PositionAccountDoc = NonNullable<
	Awaited<ReturnType<typeof findCurrentPositionAccount>>
>;
interface SignalOperationPlan {
	shouldPatchOnly: boolean;
	shouldTransition: boolean;
	transitionEventType:
		| "LENDER_CHANGES_MIND"
		| "LENDER_SIGNALS_RENEW"
		| "LENDER_SIGNALS_EXIT"
		| "LENDER_SIGNALS_PARTIAL_EXIT"
		| null;
	transitionPayload: Record<string, unknown> | undefined;
}

function buildPortalTransitionSource(authId: string) {
	return {
		actorId: authId,
		actorType: "member" as const,
		channel: "broker_portal" as const,
	};
}

function buildSystemExpirySource() {
	return {
		actorType: "system" as const,
		channel: "scheduler" as const,
	};
}

function assertValidRequestedIntent(args: {
	currentHeldFractions: number;
	intent: LenderRenewalIntentChoice;
	partialExitFractions: number | undefined;
}) {
	if (
		args.intent !== "partial_exit" &&
		args.partialExitFractions !== undefined
	) {
		throw new ConvexError(
			"partialExitFractions can only be supplied for partial_exit intent"
		);
	}

	if (args.intent !== "partial_exit") {
		return;
	}

	if (args.partialExitFractions === undefined) {
		throw new ConvexError(
			"partialExitFractions is required for partial_exit intent"
		);
	}

	if (!Number.isInteger(args.partialExitFractions)) {
		throw new ConvexError("partialExitFractions must be a whole number");
	}

	if (args.partialExitFractions <= 0) {
		throw new ConvexError("partialExitFractions must be positive");
	}

	if (args.partialExitFractions < LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS) {
		throw new ConvexError(
			`partialExitFractions must be at least ${LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS}`
		);
	}

	if (args.partialExitFractions > args.currentHeldFractions) {
		throw new ConvexError(
			"partialExitFractions cannot exceed the lender's current held position"
		);
	}
}

function getActionBlockedReason(args: {
	currentHeldFractions: number;
	intent: LenderRenewalIntentDoc;
	nowMs: number;
}) {
	const deadlinePassed = args.nowMs >= args.intent.signalDeadline;
	const maturityPassed = args.nowMs >= args.intent.maturityDate;

	if (args.currentHeldFractions <= 0) {
		return "position_sold";
	}
	if (maturityPassed) {
		return "matured";
	}
	if (
		args.intent.status === "expired" ||
		(args.intent.status === "pending_signal" && deadlinePassed)
	) {
		return "expired";
	}
	return null;
}

function buildAvailableChoices(args: {
	actionBlockedReason: string | null;
	currentHeldFractions: number;
	intent: LenderRenewalIntentDoc;
}) {
	const partialExitAvailable =
		args.currentHeldFractions >= LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS;
	const availableChoices: LenderRenewalIntentChoice[] = [];

	if (args.actionBlockedReason) {
		return {
			availableChoices,
			partialExitAvailable,
		};
	}

	switch (args.intent.status) {
		case "pending_signal":
			availableChoices.push("renew", "exit");
			if (partialExitAvailable) {
				availableChoices.push("partial_exit");
			}
			break;
		case "renewed":
			availableChoices.push("exit");
			if (partialExitAvailable) {
				availableChoices.push("partial_exit");
			}
			break;
		case "exiting":
			availableChoices.push("renew");
			if (args.intent.intent === "exit" && partialExitAvailable) {
				availableChoices.push("partial_exit");
			}
			if (args.intent.intent === "partial_exit") {
				availableChoices.push("exit");
			}
			break;
		case "expired":
			break;
		default:
			throw new Error(
				`Unsupported lender renewal status: ${args.intent.status}`
			);
	}

	return {
		availableChoices,
		partialExitAvailable,
	};
}

function summarizeRenewalIntent(args: {
	currentHeldFractions: number;
	intent: LenderRenewalIntentDoc;
	nowMs: number;
}) {
	const actionBlockedReason = getActionBlockedReason(args);
	const { availableChoices, partialExitAvailable } = buildAvailableChoices({
		actionBlockedReason,
		currentHeldFractions: args.currentHeldFractions,
		intent: args.intent,
	});

	return {
		actionBlockedReason,
		actionRequired:
			args.intent.status === "pending_signal" && availableChoices.length > 0,
		availableChoices,
		canChangeIntent:
			args.intent.status === "renewed" || args.intent.status === "exiting",
		currentHeldFractions: args.currentHeldFractions,
		fractionCount: args.intent.fractionCount,
		id: args.intent._id,
		intent: args.intent.intent ?? null,
		maturityDate: args.intent.maturityDate,
		mortgageId: args.intent.mortgageId,
		notes: args.intent.notes ?? null,
		partialExitAvailable,
		partialExitFractions: args.intent.partialExitFractions ?? null,
		partialExitMinimumFractions: LENDER_RENEWAL_PARTIAL_EXIT_MIN_FRACTIONS,
		positionAccountId: args.intent.positionAccountId,
		recordedAt: args.intent.createdAt,
		signalDeadline: args.intent.signalDeadline,
		signalledAt: args.intent.signalledAt ?? null,
		status: args.intent.status,
	};
}

async function resolveSignalIntentRecord(args: {
	ctx: RenewalMutationContext;
	currentHeldFractions: number;
	mortgage: MortgageDoc;
	mortgageId: LenderRenewalIntentDoc["mortgageId"];
	nowMs: number;
	positionAccount: PositionAccountDoc;
}) {
	let intentRecord = await findExistingLenderRenewalIntent({
		ctx: args.ctx,
		lenderId: args.ctx.lender._id,
		mortgageId: args.mortgageId,
	});

	if (!intentRecord) {
		const timeline = buildLenderRenewalTimeline(args.mortgage.maturityDate);
		if (
			!(
				args.nowMs >= timeline.creationWindowOpensAt &&
				args.nowMs < timeline.signalDeadlineAt
			)
		) {
			throw new ConvexError(
				"Renewal intent is not currently available for this mortgage"
			);
		}

		intentRecord = (
			await ensurePendingLenderRenewalIntent({
				asOf: args.nowMs,
				ctx: args.ctx,
				currentHeldFractions: args.currentHeldFractions,
				lender: args.ctx.lender,
				mortgage: args.mortgage,
				positionAccount: args.positionAccount,
			})
		).intent;
	}

	if (
		intentRecord.status === "pending_signal" &&
		args.nowMs >= intentRecord.signalDeadline
	) {
		await executeTransition(args.ctx, {
			entityType: "lenderRenewalIntent",
			entityId: intentRecord._id,
			eventType: "DEADLINE_PASSED",
			source: buildSystemExpirySource(),
		});
		throw new ConvexError("Renewal deadline has passed");
	}

	if (args.nowMs >= intentRecord.maturityDate) {
		throw new ConvexError(
			"Renewal intent is no longer actionable after mortgage maturity"
		);
	}

	return intentRecord;
}

function decideSignalOperation(args: {
	intentRecord: LenderRenewalIntentDoc;
	requestedIntent: LenderRenewalIntentChoice;
}): SignalOperationPlan {
	switch (args.intentRecord.status) {
		case "pending_signal":
			return {
				shouldPatchOnly: false,
				shouldTransition: true,
				transitionEventType: renewalSignalEventForIntent(args.requestedIntent),
				transitionPayload: undefined,
			};
		case "renewed":
			if (args.requestedIntent === "renew") {
				return {
					shouldPatchOnly: true,
					shouldTransition: false,
					transitionEventType: null,
					transitionPayload: undefined,
				};
			}
			return {
				shouldPatchOnly: false,
				shouldTransition: true,
				transitionEventType: "LENDER_CHANGES_MIND",
				transitionPayload: { nextIntent: args.requestedIntent },
			};
		case "exiting":
			if (args.requestedIntent === "renew") {
				return {
					shouldPatchOnly: false,
					shouldTransition: true,
					transitionEventType: "LENDER_CHANGES_MIND",
					transitionPayload: { nextIntent: "renew" },
				};
			}
			return {
				shouldPatchOnly: true,
				shouldTransition: false,
				transitionEventType: null,
				transitionPayload: undefined,
			};
		case "expired":
			throw new ConvexError("Renewal intent has expired");
		default:
			throw new Error(
				`Unsupported lender renewal status: ${args.intentRecord.status}`
			);
	}
}

async function projectRenewalIntent(args: {
	ctx: RenewalProjectionContext;
	intent: LenderRenewalIntentDoc;
	nowMs: number;
}) {
	const positionAccount = await findCurrentPositionAccount({
		ctx: args.ctx,
		lenderAuthId: args.ctx.viewer.authId,
		mortgageId: args.intent.mortgageId,
	});

	return summarizeRenewalIntent({
		currentHeldFractions: getCurrentHeldFractions(positionAccount),
		intent: args.intent,
		nowMs: args.nowMs,
	});
}

export const listLenderRenewalIntents = portalLenderQuery()
	.use(requirePermission("portfolio:signal_renewal"))
	.handler(async (ctx) => {
		const nowMs = Date.now();
		const intents = await ctx.db
			.query("lenderRenewalIntents")
			.withIndex("by_lender", (query) => query.eq("lenderId", ctx.lender._id))
			.collect();

		const projected = await Promise.all(
			intents.map((intent) =>
				projectRenewalIntent({
					ctx,
					intent,
					nowMs,
				})
			)
		);

		return projected.sort((left, right) => {
			if (left.actionRequired !== right.actionRequired) {
				return left.actionRequired ? -1 : 1;
			}
			return left.signalDeadline - right.signalDeadline;
		});
	})
	.public();

export const getLenderRenewalIntentByMortgage = portalLenderQuery({
	mortgageId: v.id("mortgages"),
})
	.use(requirePermission("portfolio:signal_renewal"))
	.handler(async (ctx, args) => {
		const nowMs = Date.now();
		const intent = await findExistingLenderRenewalIntent({
			ctx,
			lenderId: ctx.lender._id,
			mortgageId: args.mortgageId,
		});
		if (!intent) {
			return null;
		}

		return projectRenewalIntent({
			ctx,
			intent,
			nowMs,
		});
	})
	.public();

export const signalLenderRenewalIntent = portalLenderMutation({
	intent: lenderRenewalIntentChoiceValidator,
	mortgageId: v.id("mortgages"),
	notes: v.optional(v.string()),
	partialExitFractions: v.optional(v.number()),
})
	.use(requirePermission("portfolio:signal_renewal"))
	.handler(async (ctx, args) => {
		const nowMs = Date.now();
		const mortgage = await loadMortgageOrThrow(ctx, args.mortgageId);
		const positionAccount = await findCurrentPositionAccount({
			ctx,
			lenderAuthId: ctx.viewer.authId,
			mortgageId: args.mortgageId,
		});
		const currentHeldFractions = getCurrentHeldFractions(positionAccount);

		if (!(positionAccount && currentHeldFractions > 0)) {
			throw new ConvexError(
				"Forbidden: lender does not currently hold an actionable position for this mortgage"
			);
		}

		assertValidRequestedIntent({
			currentHeldFractions,
			intent: args.intent,
			partialExitFractions: args.partialExitFractions,
		});

		const intentRecord = await resolveSignalIntentRecord({
			ctx,
			currentHeldFractions,
			mortgage,
			mortgageId: args.mortgageId,
			nowMs,
			positionAccount,
		});
		const {
			shouldPatchOnly,
			shouldTransition,
			transitionEventType,
			transitionPayload,
		} = decideSignalOperation({
			intentRecord,
			requestedIntent: args.intent,
		});

		if (shouldTransition && transitionEventType) {
			const transitionResult = await executeTransition(ctx, {
				entityType: "lenderRenewalIntent",
				entityId: intentRecord._id,
				eventType: transitionEventType,
				payload: transitionPayload,
				source: buildPortalTransitionSource(ctx.viewer.authId),
			});

			if (!transitionResult.success) {
				throw new ConvexError(
					transitionResult.reason ?? "Renewal transition was rejected"
				);
			}
		}

		if (shouldTransition || shouldPatchOnly) {
			const timeline = buildLenderRenewalTimeline(mortgage.maturityDate);
			await ctx.db.patch(intentRecord._id, {
				brokerId: mortgage.brokerOfRecordId,
				fractionCount: currentHeldFractions,
				intent: args.intent,
				maturityDate: timeline.maturityAt,
				notes: args.notes,
				partialExitFractions:
					args.intent === "partial_exit"
						? args.partialExitFractions
						: undefined,
				positionAccountId: positionAccount._id as string,
				signalDeadline: timeline.signalDeadlineAt,
				signalledAt: nowMs,
			});
		}

		const refreshedIntent = await findExistingLenderRenewalIntent({
			ctx,
			lenderId: ctx.lender._id,
			mortgageId: args.mortgageId,
		});
		if (!refreshedIntent) {
			throw new ConvexError("Failed to reload lender renewal intent");
		}

		return projectRenewalIntent({
			ctx,
			intent: refreshedIntent,
			nowMs,
		});
	})
	.public();
