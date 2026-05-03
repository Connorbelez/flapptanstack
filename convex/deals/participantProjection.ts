import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type DealPartyRole = "buyer" | "seller" | "lawyer";
export type DealAccessStorageRole =
	| "lender"
	| "borrower"
	| "platform_lawyer"
	| "guest_lawyer"
	| "broker_of_record"
	| "assigned_broker";
export type DealPortalPersona =
	| "buyer"
	| "seller"
	| "lawyer"
	| "broker"
	| "admin";
export type DealInvolvedPartyRole =
	| "buyer"
	| "seller"
	| "buyer_lawyer"
	| "seller_lawyer"
	| "broker"
	| "borrower";

export interface DealFractionalShareProjection {
	fractionalShareDisplayPercent: number | null;
	fractionalShareUnits: number;
	isValid: boolean;
	validationError: string | null;
}

interface BuyerProjection {
	accessRole: "lender";
	authId: string;
	displayName: string;
	email: string | null;
	lenderId: Id<"lenders"> | null;
	userId: Id<"users"> | null;
}

interface SellerProjection {
	accessRole: "borrower" | "lender";
	authId: string;
	borrowerId: Id<"borrowers"> | null;
	displayName: string;
	email: string | null;
	lenderId: Id<"lenders"> | null;
	userId: Id<"users"> | null;
}

interface LawyerProjection {
	authId: string | null;
	displayName: string | null;
	email: string | null;
	hasActiveDealAccess: boolean;
	lawyerType: "platform_lawyer" | "guest_lawyer" | null;
}

interface InvolvedPartyProjection {
	email: string | null;
	hasWorkspaceAccess: boolean;
	label: string;
	name: string | null;
	role: DealInvolvedPartyRole;
}

export interface DealParticipantProjection {
	buyer: BuyerProjection;
	dealId: Id<"deals">;
	fractionalShareDisplayPercent: number | null;
	fractionalShareStatus: DealFractionalShareProjection;
	fractionalShareUnits: number;
	involvedParties: InvolvedPartyProjection[];
	lawyer: LawyerProjection;
	personas: {
		admin: DealPortalPersona;
		buyer: DealPortalPersona;
		lawyer: DealPortalPersona;
		seller: DealPortalPersona;
	};
	seller: SellerProjection;
}

type ProjectionReaderCtx = Pick<QueryCtx, "db">;

function normalizeText(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	return trimmed && trimmed.length > 0 ? trimmed : null;
}

export function displayNameForAuthParticipant(
	authId: string,
	user: Pick<Doc<"users">, "email" | "firstName" | "lastName"> | null
) {
	const fullName = [user?.firstName, user?.lastName]
		.filter(Boolean)
		.join(" ")
		.trim();
	return fullName || normalizeText(user?.email) || authId;
}

export function projectFractionalShareUnits(
	units: number
): DealFractionalShareProjection {
	if (!Number.isSafeInteger(units)) {
		return {
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: units,
			isValid: false,
			validationError: "fractionalShare must be an integer number of units",
		};
	}
	if (units < 0 || units > 10_000) {
		return {
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: units,
			isValid: false,
			validationError: "fractionalShare units must be between 0 and 10000",
		};
	}

	return {
		fractionalShareDisplayPercent: units / 100,
		fractionalShareUnits: units,
		isValid: true,
		validationError: null,
	};
}

export function mapDealAccessRoleToPortalPersona(
	role: DealAccessStorageRole
): DealPortalPersona {
	// dealAccess storage roles intentionally remain lender/borrower/lawyer
	// variants; buyer/seller/lawyer/admin are projection personas only.
	if (role === "lender") {
		return "buyer";
	}
	if (role === "borrower") {
		return "seller";
	}
	if (role === "broker_of_record" || role === "assigned_broker") {
		return "broker";
	}
	return "lawyer";
}

async function getUserByAuthId(ctx: ProjectionReaderCtx, authId: string) {
	return ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
}

async function getLenderByUserId(
	ctx: ProjectionReaderCtx,
	userId: Id<"users"> | null
) {
	if (!userId) {
		return null;
	}
	return ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.first();
}

async function getBorrowerByUserId(
	ctx: ProjectionReaderCtx,
	userId: Id<"users"> | null
) {
	if (!userId) {
		return null;
	}
	return ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", userId))
		.first();
}

async function getPrimaryMortgageBorrower(
	ctx: ProjectionReaderCtx,
	mortgageId: Id<"mortgages">
) {
	const borrowerLink = await ctx.db
		.query("mortgageBorrowers")
		.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
		.filter((query) => query.eq(query.field("role"), "primary"))
		.first();
	return borrowerLink ? ctx.db.get(borrowerLink.borrowerId) : null;
}

async function getActiveDealAccessRows(
	ctx: ProjectionReaderCtx,
	dealId: Id<"deals">
) {
	return ctx.db
		.query("dealAccess")
		.withIndex("by_deal", (query) => query.eq("dealId", dealId))
		.filter((query) => query.eq(query.field("status"), "active"))
		.collect();
}

function isLawyerAccessRow(
	access: Doc<"dealAccess">
): access is Doc<"dealAccess"> & {
	role: "guest_lawyer" | "platform_lawyer";
} {
	return access.role === "platform_lawyer" || access.role === "guest_lawyer";
}

async function getPrimaryClosingLawyerAuthId(
	ctx: ProjectionReaderCtx,
	mortgageId: Id<"mortgages">
) {
	const assignments = await ctx.db
		.query("closingTeamAssignments")
		.withIndex("by_mortgage", (query) => query.eq("mortgageId", mortgageId))
		.collect();
	return (
		assignments.find((assignment) => assignment.role === "closing_lawyer")
			?.userId ??
		assignments.find((assignment) => assignment.role === "reviewing_lawyer")
			?.userId ??
		null
	);
}

function activeSellerAccessRole(
	accessRows: Doc<"dealAccess">[],
	authId: string,
	hasBorrowerRecord: boolean
): "borrower" | "lender" {
	const row = accessRows.find(
		(access) =>
			access.userId === authId &&
			(access.role === "borrower" || access.role === "lender")
	);
	if (row?.role === "borrower" || row?.role === "lender") {
		return row.role;
	}
	return hasBorrowerRecord ? "borrower" : "lender";
}

async function brokerProfile(
	ctx: ProjectionReaderCtx,
	brokerId: Id<"brokers"> | null | undefined
) {
	if (!brokerId) {
		return null;
	}
	const broker = await ctx.db.get(brokerId);
	if (!broker) {
		return null;
	}
	const user = await ctx.db.get(broker.userId);
	return {
		authId: user?.authId ?? null,
		displayName: displayNameForAuthParticipant(
			user?.authId ?? String(brokerId),
			user
		),
		email: normalizeText(user?.email),
	};
}

async function borrowerProfile(
	ctx: ProjectionReaderCtx,
	borrower: Doc<"borrowers"> | null
) {
	if (!borrower) {
		return null;
	}
	const user = await ctx.db.get(borrower.userId);
	return {
		authId: user?.authId ?? null,
		displayName: displayNameForAuthParticipant(
			user?.authId ?? String(borrower._id),
			user
		),
		email: normalizeText(user?.email),
	};
}

function hasActiveWorkspaceAccess(
	accessRows: Doc<"dealAccess">[],
	args: {
		authId: string | null | undefined;
		email?: string | null;
		roles: ReadonlySet<Doc<"dealAccess">["role"]>;
	}
) {
	return accessRows.some((access) => {
		if (access.status !== "active" || !args.roles.has(access.role)) {
			return false;
		}
		if (args.authId && access.userId === args.authId) {
			return true;
		}
		if (
			args.email &&
			normalizeText(access.userId)?.toLowerCase() === args.email.toLowerCase()
		) {
			return true;
		}
		return false;
	});
}

export async function buildDealParticipantProjection(
	ctx: ProjectionReaderCtx,
	deal: Doc<"deals">
): Promise<DealParticipantProjection> {
	const [buyerUser, sellerUser, activeAccessRows, mortgage] = await Promise.all(
		[
			getUserByAuthId(ctx, deal.buyerId),
			getUserByAuthId(ctx, deal.sellerId),
			getActiveDealAccessRows(ctx, deal._id),
			ctx.db.get(deal.mortgageId),
		]
	);

	const [buyerLender, sellerLender, sellerBorrower, primaryMortgageBorrower] =
		await Promise.all([
			getLenderByUserId(ctx, buyerUser?._id ?? null),
			getLenderByUserId(ctx, sellerUser?._id ?? null),
			getBorrowerByUserId(ctx, sellerUser?._id ?? null),
			getPrimaryMortgageBorrower(ctx, deal.mortgageId),
		]);

	const fallbackActiveLawyerAccess = activeAccessRows.find(isLawyerAccessRow);
	const assignedLawyerAuthId = await getPrimaryClosingLawyerAuthId(
		ctx,
		deal.mortgageId
	);
	const lawyerAuthId =
		deal.lawyerId ??
		assignedLawyerAuthId ??
		fallbackActiveLawyerAccess?.userId ??
		null;
	const activeLawyerAccess = lawyerAuthId
		? activeAccessRows.find(
				(
					access
				): access is Doc<"dealAccess"> & {
					role: "guest_lawyer" | "platform_lawyer";
				} => access.userId === lawyerAuthId && isLawyerAccessRow(access)
			)
		: undefined;
	const lawyerUser = lawyerAuthId
		? await getUserByAuthId(ctx, lawyerAuthId)
		: null;
	const lawyerType = deal.lawyerType ?? activeLawyerAccess?.role ?? null;
	const fractionalShareStatus = projectFractionalShareUnits(
		deal.fractionalShare
	);
	const selectedLawyerName =
		normalizeText(deal.selectedLawyer?.name) ??
		(lawyerAuthId
			? displayNameForAuthParticipant(lawyerAuthId, lawyerUser)
			: null);
	const selectedLawyerEmail =
		normalizeText(deal.selectedLawyer?.email) ??
		normalizeText(lawyerUser?.email);
	const selectedLawyerHasWorkspaceAccess = hasActiveWorkspaceAccess(
		activeAccessRows,
		{
			authId: lawyerAuthId,
			email: selectedLawyerEmail,
			roles: new Set(["guest_lawyer", "platform_lawyer"]),
		}
	);
	const broker = await brokerProfile(
		ctx,
		mortgage?.assignedBrokerId ?? mortgage?.brokerOfRecordId
	);
	const borrower = await borrowerProfile(
		ctx,
		primaryMortgageBorrower ?? sellerBorrower
	);
	const involvedParties: InvolvedPartyProjection[] = [
		{
			email: normalizeText(buyerUser?.email),
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: deal.buyerId,
				roles: new Set(["lender"]),
			}),
			label: "Buyer",
			name: displayNameForAuthParticipant(deal.buyerId, buyerUser),
			role: "buyer",
		},
		{
			email: normalizeText(sellerUser?.email),
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: deal.sellerId,
				roles: new Set(["borrower", "lender"]),
			}),
			label: "Seller",
			name: displayNameForAuthParticipant(deal.sellerId, sellerUser),
			role: "seller",
		},
		{
			email: selectedLawyerEmail,
			hasWorkspaceAccess: selectedLawyerHasWorkspaceAccess,
			label: "Buyer's Lawyer",
			name: selectedLawyerName,
			role: "buyer_lawyer",
		},
		{
			email: null,
			hasWorkspaceAccess: false,
			label: "Seller's Lawyer",
			name: null,
			role: "seller_lawyer",
		},
		{
			email: broker?.email ?? null,
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: broker?.authId,
				roles: new Set(["assigned_broker", "broker_of_record"]),
			}),
			label: "Broker",
			name: broker?.displayName ?? null,
			role: "broker",
		},
		{
			email: borrower?.email ?? normalizeText(sellerUser?.email),
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: borrower?.authId ?? deal.sellerId,
				roles: new Set(["borrower"]),
			}),
			label: "Borrower",
			name:
				borrower?.displayName ??
				displayNameForAuthParticipant(deal.sellerId, sellerUser),
			role: "borrower",
		},
	];

	return {
		dealId: deal._id,
		buyer: {
			accessRole: "lender",
			authId: deal.buyerId,
			displayName: displayNameForAuthParticipant(deal.buyerId, buyerUser),
			email: normalizeText(buyerUser?.email),
			lenderId: buyerLender?._id ?? deal.lenderId ?? null,
			userId: buyerUser?._id ?? null,
		},
		seller: {
			accessRole: activeSellerAccessRole(
				activeAccessRows,
				deal.sellerId,
				Boolean(sellerBorrower)
			),
			authId: deal.sellerId,
			borrowerId: sellerBorrower?._id ?? null,
			displayName: displayNameForAuthParticipant(deal.sellerId, sellerUser),
			email: normalizeText(sellerUser?.email),
			lenderId: sellerLender?._id ?? null,
			userId: sellerUser?._id ?? null,
		},
		lawyer: {
			authId: lawyerAuthId,
			displayName: lawyerAuthId
				? displayNameForAuthParticipant(lawyerAuthId, lawyerUser)
				: null,
			email: normalizeText(lawyerUser?.email),
			hasActiveDealAccess: Boolean(
				lawyerAuthId && activeLawyerAccess?.userId === lawyerAuthId
			),
			lawyerType,
		},
		fractionalShareDisplayPercent:
			fractionalShareStatus.fractionalShareDisplayPercent,
		fractionalShareStatus,
		fractionalShareUnits: fractionalShareStatus.fractionalShareUnits,
		involvedParties,
		personas: {
			admin: "admin",
			buyer: "buyer",
			lawyer: "lawyer",
			seller: "seller",
		},
	};
}
