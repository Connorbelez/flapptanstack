import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";
import { assertDealAccess } from "../authz/resourceAccess";
import { readDealDocumentPackageSurface } from "../documents/dealPackages";
import { adminQuery, authedQuery, dealQuery } from "../fluent";
import {
	buildDealParticipantProjection,
	type DealParticipantProjection,
	projectFractionalShareUnits,
} from "./participantProjection";

// ── Phase mapping ──────────────────────────────────────────────────────

type DealPhase =
	| "initiated"
	| "lawyerOnboarding"
	| "documentReview"
	| "fundsTransfer"
	| "confirmed"
	| "failed";

function getDealPhase(status: string): DealPhase {
	if (status === "initiated") {
		return "initiated";
	}
	if (status.startsWith("lawyerOnboarding.")) {
		return "lawyerOnboarding";
	}
	if (status.startsWith("documentReview.")) {
		return "documentReview";
	}
	if (status.startsWith("fundsTransfer.")) {
		return "fundsTransfer";
	}
	if (status === "confirmed") {
		return "confirmed";
	}
	if (status === "failed") {
		return "failed";
	}
	// Default to initiated for unknown statuses
	// Log unknown statuses for observability (shouldn't happen in production)
	console.warn(
		`Unknown deal status encountered: ${status}, defaulting to initiated`
	);
	return "initiated";
}

export interface DealWithPhase {
	_id: Id<"deals">;
	buyerId: string;
	closingDate?: number;
	createdAt: number;
	createdBy: string;
	fractionalShare: number;
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	lawyerId?: string;
	lawyerType?: "platform_lawyer" | "guest_lawyer";
	mortgageId: Id<"mortgages">;
	sellerId: string;
	status: string;
}

export interface DealsByPhase {
	confirmed: DealWithPhase[];
	documentReview: DealWithPhase[];
	failed: DealWithPhase[];
	fundsTransfer: DealWithPhase[];
	initiated: DealWithPhase[];
	lawyerOnboarding: DealWithPhase[];
}

type DealDocumentPackageSurface = Awaited<
	ReturnType<typeof readDealDocumentPackageSurface>
>;
type DealDocumentPackageSurfaceInstance =
	DealDocumentPackageSurface["instances"][number];

export interface PortalDealDocumentInstance {
	archivedAt: number | null;
	archivedSigning: DealDocumentPackageSurfaceInstance["archivedSigning"];
	class: DealDocumentPackageSurfaceInstance["class"];
	displayName: string;
	instanceId: DealDocumentPackageSurfaceInstance["instanceId"];
	kind: DealDocumentPackageSurfaceInstance["kind"];
	lastError: string | null;
	packageLabel: string | null;
	signing: DealDocumentPackageSurfaceInstance["signing"];
	status: DealDocumentPackageSurfaceInstance["status"];
	url: string | null;
}

export interface PortalDealDocumentPackage {
	archivedAt: number | null;
	lastError: string | null;
	readyAt: number | null;
	retryCount: number;
	status: NonNullable<DealDocumentPackageSurface["package"]>["status"];
}

export interface PortalDealDetail {
	deal: {
		closingDate: number | null;
		dealId: Id<"deals">;
		/** @deprecated Use fractionalShareUnits or fractionalShareDisplayPercent. */
		fractionalShare: number;
		fractionalShareDisplayPercent: number | null;
		fractionalShareUnits: number;
		lockingFeeAmount: number | null;
		status: string;
	};
	documentInstances: PortalDealDocumentInstance[];
	documentPackage: PortalDealDocumentPackage | null;
	mortgage: {
		interestRate: number;
		maturityDate: string;
		mortgageId: Id<"mortgages">;
		paymentAmount: number;
		paymentFrequency: string;
		principal: number;
		status: string;
	};
	participants: DealParticipantProjection;
	parties: {
		lender: {
			email: string | null;
			name: string;
		};
		seller: {
			email: string | null;
			name: string;
		};
	};
	property: {
		city: string;
		propertyType: string;
		province: string;
		streetAddress: string;
		unit: string | null;
	} | null;
}

function projectPortalDealDocumentInstance(
	instance: DealDocumentPackageSurfaceInstance
): PortalDealDocumentInstance {
	return {
		archivedSigning: instance.archivedSigning,
		archivedAt: instance.archivedAt,
		class: instance.class,
		displayName: instance.displayName,
		instanceId: instance.instanceId,
		kind: instance.kind,
		lastError: instance.lastError,
		packageLabel: instance.packageLabel,
		signing: instance.signing,
		status: instance.status,
		url:
			instance.status === "available" ||
			instance.status === "archived" ||
			instance.archivedSigning?.finalPdfUrl
				? instance.url
				: null,
	};
}

// ── Internal: used by effects ──────────────────────────────────────

/**
 * Internal query to fetch a deal by ID.
 * Used by effects that need to read deal data without auth checks.
 */
export const getInternalDeal = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		const deal = await ctx.db.get(dealId);
		if (!deal) {
			throw new ConvexError("DEAL_NOT_FOUND");
		}
		return deal;
	},
});

/**
 * Internal mutation to set or clear the reservationId on a deal.
 * Called by the reserveShares effect after successfully creating a reservation.
 * Pass undefined for reservationId to clear it.
 */
export const setReservationId = internalMutation({
	args: {
		dealId: v.id("deals"),
		reservationId: v.optional(v.id("ledger_reservations")),
	},
	handler: async (ctx, { dealId, reservationId }) => {
		const deal = await ctx.db.get(dealId);
		if (!deal) {
			throw new ConvexError("DEAL_NOT_FOUND");
		}
		await ctx.db.patch(dealId, { reservationId });
	},
});

export const getActiveDealAccess = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		return await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
	},
});

export const getActiveLawyerAccess = internalQuery({
	args: { dealId: v.id("deals") },
	handler: async (ctx, { dealId }) => {
		const allActive = await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
		return allActive.filter(
			(r) => r.role === "platform_lawyer" || r.role === "guest_lawyer"
		);
	},
});

// ── Public: activeDealAccessRecords ──────────────────────────────────

/**
 * Returns all active dealAccess records for a deal.
 * Enforces two-layer authorization: admin bypass → dealAccess check.
 */
export const activeDealAccessRecords = authedQuery
	.input({ dealId: v.id("deals") })
	.handler(async (ctx, { dealId }) => {
		await assertDealAccess(ctx, dealId);

		return await ctx.db
			.query("dealAccess")
			.withIndex("by_deal", (q) => q.eq("dealId", dealId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.collect();
	})
	.public();

// ── Public: getDealsByPhase ───────────────────────────────────────────

/**
 * Returns deals grouped by phase for Kanban board display.
 * Groups deals into 6 columns: initiated, lawyerOnboarding, documentReview,
 * fundsTransfer, confirmed, failed
 */
export const getDealsByPhase = adminQuery
	.handler(async (ctx): Promise<DealsByPhase> => {
		const allDeals = await ctx.db.query("deals").collect();

		const result: DealsByPhase = {
			initiated: [],
			lawyerOnboarding: [],
			documentReview: [],
			fundsTransfer: [],
			confirmed: [],
			failed: [],
		};

		for (const deal of allDeals) {
			const phase = getDealPhase(deal.status);
			const dealWithPhase: DealWithPhase = {
				_id: deal._id,
				status: deal.status,
				mortgageId: deal.mortgageId,
				buyerId: deal.buyerId,
				sellerId: deal.sellerId,
				fractionalShare: deal.fractionalShare,
				fractionalShareDisplayPercent: projectFractionalShareUnits(
					deal.fractionalShare
				).fractionalShareDisplayPercent,
				fractionalShareUnits: deal.fractionalShare,
				closingDate: deal.closingDate,
				lawyerId: deal.lawyerId,
				lawyerType: deal.lawyerType,
				createdAt: deal.createdAt,
				createdBy: deal.createdBy,
			};
			result[phase].push(dealWithPhase);
		}

		return result;
	})
	.public();

// ── Public: closingTeamAssignments ──────────────────────────────────────

/**
 * Returns closing team assignments for deals.
 * Links to deals via mortgageId field.
 */
export const closingTeamAssignments = adminQuery
	.handler(async (ctx) => {
		return await ctx.db.query("closingTeamAssignments").collect();
	})
	.public();

export const getPortalDealDetail = dealQuery
	.input({
		dealId: v.id("deals"),
	})
	.handler(async (ctx, args): Promise<PortalDealDetail | null> => {
		await assertDealAccess(ctx, args.dealId);

		const deal = await ctx.db.get(args.dealId);
		if (!deal) {
			return null;
		}

		const mortgage = await ctx.db.get(deal.mortgageId);
		if (!mortgage) {
			return null;
		}

		const [property, participants, viewerUser] = await Promise.all([
			ctx.db.get(mortgage.propertyId),
			buildDealParticipantProjection(ctx, deal),
			ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", ctx.viewer.authId))
				.unique(),
		]);

		const packageSurfaceWithViewer = await readDealDocumentPackageSurface(
			ctx,
			args.dealId,
			{
				isFairLendAdmin: ctx.viewer.isFairLendAdmin,
				userId: viewerUser?._id,
			}
		);
		return {
			deal: {
				closingDate: deal.closingDate ?? null,
				dealId: deal._id,
				fractionalShare: deal.fractionalShare,
				fractionalShareDisplayPercent:
					participants.fractionalShareDisplayPercent,
				fractionalShareUnits: participants.fractionalShareUnits,
				lockingFeeAmount: deal.lockingFeeAmount ?? null,
				status: deal.status,
			},
			mortgage: {
				interestRate: mortgage.interestRate,
				maturityDate: mortgage.maturityDate,
				mortgageId: mortgage._id,
				paymentAmount: mortgage.paymentAmount,
				paymentFrequency: mortgage.paymentFrequency,
				principal: mortgage.principal,
				status: mortgage.status,
			},
			property: property
				? {
						city: property.city,
						propertyType: property.propertyType,
						province: property.province,
						streetAddress: property.streetAddress,
						unit: property.unit ?? null,
					}
				: null,
			parties: {
				lender: {
					email: participants.buyer.email,
					name: participants.buyer.displayName,
				},
				seller: {
					email: participants.seller.email,
					name: participants.seller.displayName,
				},
			},
			documentInstances: packageSurfaceWithViewer.instances
				.filter(
					(instance) =>
						instance.class === "private_static" ||
						instance.class === "private_templated_non_signable" ||
						instance.class === "private_templated_signable"
				)
				.map(projectPortalDealDocumentInstance),
			participants,
			documentPackage: packageSurfaceWithViewer.package
				? {
						archivedAt: packageSurfaceWithViewer.package.archivedAt,
						lastError: packageSurfaceWithViewer.package.lastError,
						readyAt: packageSurfaceWithViewer.package.readyAt,
						retryCount: packageSurfaceWithViewer.package.retryCount,
						status: packageSurfaceWithViewer.package.status,
					}
				: null,
		};
	})
	.public();
