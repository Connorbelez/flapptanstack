import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import type { QueryCtx } from "../../../../convex/_generated/server";
import type { Viewer } from "../../../../convex/fluent";
import {
	classifyDealAccessFacts,
	legacyStorageRoleToDealPersona,
	type NormalizedDealAccessFacts,
} from "./classify";
import type {
	DealAccessDecision,
	DealAccessIntent,
	DealPersona,
} from "./types";

type AccessPolicyCtx = Pick<QueryCtx, "db">;

function normalizeEmail(value: string | null | undefined): string | null {
	const trimmed = value?.trim().toLowerCase();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

function viewerEmail(viewer: Viewer) {
	return normalizeEmail(viewer.verifiedEmail ?? viewer.email);
}

function selectedLawyerAuthId(deal: Doc<"deals">): string | null {
	if (deal.lawyerId) {
		return deal.lawyerId;
	}
	if (deal.selectedLawyer?.type === "platform_lawyer") {
		return deal.selectedLawyer.lawyerId ?? null;
	}
	return null;
}

function selectedLawyerMatchesViewerByEmail(
	deal: Doc<"deals">,
	viewer: Viewer
) {
	const email = viewerEmail(viewer);
	return email !== null && email === normalizeEmail(deal.selectedLawyer?.email);
}

function selectedLawyerInvitationMatchesViewer(
	deal: Doc<"deals">,
	viewer: Viewer
) {
	return selectedLawyerMatchesViewerByEmail(deal, viewer);
}

function dealPositionForAccessRow(deal: Doc<"deals">, row: Doc<"dealAccess">) {
	if (row.role !== "lender") {
		return undefined;
	}
	if (row.userId === deal.buyerId) {
		return "purchasing" as const;
	}
	if (row.userId === deal.sellerId) {
		return "selling" as const;
	}
	return undefined;
}

function personaForAccessRow(
	deal: Doc<"deals">,
	row: Doc<"dealAccess">
): DealPersona | null {
	if ("persona" in row && row.persona) {
		return row.persona as DealPersona;
	}
	return legacyStorageRoleToDealPersona({
		dealPosition: dealPositionForAccessRow(deal, row),
		role: row.role,
	});
}

async function getViewerBorrowerPersona(
	ctx: AccessPolicyCtx,
	args: {
		deal: Doc<"deals">;
		viewer: Viewer;
	}
): Promise<NormalizedDealAccessFacts["mortgageBorrower"]> {
	const user = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", args.viewer.authId))
		.first();
	if (!user) {
		return null;
	}
	const borrower = await ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
	if (!borrower) {
		return null;
	}
	const links = await ctx.db
		.query("mortgageBorrowers")
		.withIndex("by_borrower", (query) => query.eq("borrowerId", borrower._id))
		.collect();
	const orderedLinks = links
		.filter((link) => link.mortgageId === args.deal.mortgageId)
		.sort((left, right) => left.addedAt - right.addedAt);
	const primaryLink = orderedLinks.find((link) => link.role === "primary");
	if (primaryLink) {
		return {
			authId: args.viewer.authId,
			persona: "primary_borrower",
		};
	}
	const coBorrowerIndex = orderedLinks.findIndex(
		(link) => link.role === "co_borrower"
	);
	if (coBorrowerIndex === 0) {
		return {
			authId: args.viewer.authId,
			persona: "co_borrower_1",
		};
	}
	if (coBorrowerIndex > 0) {
		return {
			authId: args.viewer.authId,
			persona: "co_borrower_2",
		};
	}
	return null;
}

async function hasClosingTeamAccess(
	ctx: AccessPolicyCtx,
	args: {
		deal: Doc<"deals">;
		viewer: Viewer;
	}
) {
	const assignments = await ctx.db
		.query("closingTeamAssignments")
		.withIndex("by_user", (query) => query.eq("userId", args.viewer.authId))
		.collect();
	return assignments.some(
		(assignment) => assignment.mortgageId === args.deal.mortgageId
	);
}

async function getOwnedOnboardingSession(
	ctx: AccessPolicyCtx,
	args: {
		dealId: Id<"deals">;
		viewer: Viewer;
	}
): Promise<Doc<"lawyerOnboardingSessions"> | null> {
	const sessions: Doc<"lawyerOnboardingSessions">[] = [];
	const email = viewerEmail(args.viewer);
	if (email) {
		const byEmail = await ctx.db
			.query("lawyerOnboardingSessions")
			.withIndex("by_target_email_deal", (query) =>
				query.eq("normalizedTargetEmail", email).eq("dealId", args.dealId)
			)
			.collect();
		sessions.push(...byEmail);
	}
	const byWorkos = await ctx.db
		.query("lawyerOnboardingSessions")
		.withIndex("by_workos_deal", (query) =>
			query.eq("workosUserId", args.viewer.authId).eq("dealId", args.dealId)
		)
		.collect();
	sessions.push(...byWorkos);

	return (
		[
			...new Map(sessions.map((session) => [session._id, session])).values(),
		].sort((left, right) => {
			if (right.updatedAt !== left.updatedAt) {
				return right.updatedAt - left.updatedAt;
			}
			if (right.createdAt !== left.createdAt) {
				return right.createdAt - left.createdAt;
			}
			return String(right._id).localeCompare(String(left._id));
		})[0] ?? null
	);
}

async function hasAcceptedEngagement(
	ctx: AccessPolicyCtx,
	args: {
		dealId: Id<"deals">;
		lawyerAuthId: string;
	}
) {
	const engagements = await ctx.db
		.query("representationEngagements")
		.withIndex("by_deal", (query) => query.eq("dealId", args.dealId))
		.collect();
	return engagements.some(
		(engagement) =>
			engagement.lawyerAuthId === args.lawyerAuthId &&
			engagement.status === "signed"
	);
}

async function hasCurrentVerification(
	ctx: AccessPolicyCtx,
	args: {
		deal: Doc<"deals">;
		lawyerAuthId: string;
	}
) {
	const profile = await ctx.db
		.query("lawyerProfiles")
		.withIndex("by_auth_id", (query) => query.eq("authId", args.lawyerAuthId))
		.first();
	const byAuth = await ctx.db
		.query("lawyerVerifications")
		.withIndex("by_auth_check_created", (query) =>
			query.eq("authId", args.lawyerAuthId)
		)
		.collect();
	const byProfile = profile
		? await ctx.db
				.query("lawyerVerifications")
				.withIndex("by_profile_check_created", (query) =>
					query.eq("lawyerProfileId", profile._id)
				)
				.collect()
		: [];
	const verifications = [...byAuth, ...byProfile];
	return verifications.some((verification) => {
		if (verification.outcome !== "eligible") {
			return false;
		}
		return (
			verification.expiresAt === undefined ||
			verification.expiresAt > Date.now()
		);
	});
}

export async function resolveDealAccessDecision(
	ctx: AccessPolicyCtx,
	args: {
		dealId: Id<"deals">;
		intent: DealAccessIntent;
		viewer: Viewer;
	}
): Promise<DealAccessDecision | null> {
	const deal = await ctx.db.get(args.dealId);
	if (!deal) {
		return null;
	}

	const [activeRows, mortgageBorrower, closingTeam, onboardingSession] =
		await Promise.all([
			ctx.db
				.query("dealAccess")
				.withIndex("by_user_and_deal", (query) =>
					query.eq("userId", args.viewer.authId).eq("dealId", args.dealId)
				)
				.filter((query) => query.eq(query.field("status"), "active"))
				.collect(),
			getViewerBorrowerPersona(ctx, { deal, viewer: args.viewer }),
			hasClosingTeamAccess(ctx, { deal, viewer: args.viewer }),
			getOwnedOnboardingSession(ctx, {
				dealId: args.dealId,
				viewer: args.viewer,
			}),
		]);

	const activeDealAccess = activeRows.flatMap((row) => {
		const persona = personaForAccessRow(deal, row);
		return persona ? [{ persona, source: row.role }] : [];
	});
	const lawyerAuthId = selectedLawyerAuthId(deal);
	const lawyerMatchesByAuthId = lawyerAuthId === args.viewer.authId;
	const selectedByEmail = selectedLawyerMatchesViewerByEmail(deal, args.viewer);
	const lawyerRelated =
		lawyerMatchesByAuthId ||
		selectedByEmail ||
		activeDealAccess.some((access) => access.persona === "primary_lawyer") ||
		onboardingSession !== null;
	const hasPrimaryLawyerAccess = activeDealAccess.some(
		(access) => access.persona === "primary_lawyer"
	);
	const [currentVerification, acceptedEngagement] =
		lawyerRelated &&
		(lawyerAuthId === args.viewer.authId ||
			onboardingSession ||
			hasPrimaryLawyerAccess)
			? await Promise.all([
					hasCurrentVerification(ctx, {
						deal,
						lawyerAuthId: args.viewer.authId,
					}),
					hasAcceptedEngagement(ctx, {
						dealId: args.dealId,
						lawyerAuthId: args.viewer.authId,
					}),
				])
			: [false, false];

	return classifyDealAccessFacts({
		activeDealAccess,
		closingTeam,
		dealId: String(args.dealId),
		intent: args.intent,
		isFairLendAdmin: args.viewer.isFairLendAdmin,
		lawyer: {
			hasAcceptedEngagement: acceptedEngagement,
			hasCurrentVerification: currentVerification,
			hasOwnedOnboardingSession: onboardingSession !== null,
			invitationTargetMatchesViewer: selectedLawyerInvitationMatchesViewer(
				deal,
				args.viewer
			),
			isSelectedByAuthId: lawyerMatchesByAuthId,
			isSelectedByEmail: selectedByEmail,
			kind: deal.lawyerType ?? deal.selectedLawyer?.type ?? null,
			onboardingSessionId: onboardingSession
				? String(onboardingSession._id)
				: null,
			onboardingStatus: onboardingSession?.status ?? null,
		},
		mortgageBorrower,
		purchasingLenderAuthId:
			"purchasingLenderAuthId" in deal
				? ((deal.purchasingLenderAuthId as string | undefined) ?? deal.buyerId)
				: deal.buyerId,
		sellingLenderAuthId:
			"sellingLenderAuthId" in deal
				? ((deal.sellingLenderAuthId as string | undefined) ?? deal.sellerId)
				: deal.sellerId,
		viewerAuthId: args.viewer.authId,
		workosRoles: [...args.viewer.roles],
	});
}
