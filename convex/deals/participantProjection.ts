import { legacyStorageRoleToDealPersona } from "../../src/lib/deals/access-policy/classify";
import type { DealPersona } from "../../src/lib/deals/access-policy/types";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type DealPartyRole =
	| "purchasing_lender"
	| "selling_lender"
	| "primary_borrower"
	| "primary_lawyer";
export type DealAccessStorageRole =
	| "lender"
	| "borrower"
	| "platform_lawyer"
	| "guest_lawyer"
	| "broker_of_record"
	| "assigned_broker";
export type DealPortalPersona = DealPersona;
export type DealInvolvedPartyRole =
	| "purchasing_lender"
	| "selling_lender"
	| "primary_lawyer"
	| "broker_of_record"
	| "assigned_broker"
	| "primary_borrower";

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

interface LenderPersonaProjection extends BuyerProjection {
	persona: "purchasing_lender" | "selling_lender";
}

interface SellerProjection {
	accessRole: "lender";
	authId: string;
	borrowerId: Id<"borrowers"> | null;
	displayName: string;
	email: string | null;
	lenderId: Id<"lenders"> | null;
	userId: Id<"users"> | null;
}

interface BorrowerPersonaProjection {
	authId: string | null;
	borrowerId: Id<"borrowers"> | null;
	displayName: string | null;
	email: string | null;
	persona: "primary_borrower";
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
	/** @deprecated Compatibility alias for purchasing_lender. */
	buyer: BuyerProjection;
	dealId: Id<"deals">;
	fractionalShareDisplayPercent: number | null;
	fractionalShareStatus: DealFractionalShareProjection;
	fractionalShareUnits: number;
	involvedParties: InvolvedPartyProjection[];
	lawyer: LawyerProjection;
	personas: {
		assigned_broker: DealPortalPersona;
		broker_of_record: DealPortalPersona;
		fairlend_admin: DealPortalPersona;
		primary_borrower: DealPortalPersona;
		primary_lawyer: DealPortalPersona;
		purchasing_lender: DealPortalPersona;
		selling_lender: DealPortalPersona;
	};
	primary_borrower: BorrowerPersonaProjection;
	primary_lawyer: LawyerProjection & { persona: "primary_lawyer" };
	purchasing_lender: LenderPersonaProjection;
	/** @deprecated Compatibility alias for selling_lender. */
	seller: SellerProjection;
	selling_lender: LenderPersonaProjection;
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
): DealPortalPersona | null {
	return legacyStorageRoleToDealPersona({ role });
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
	const purchasingLenderAuthId =
		"purchasingLenderAuthId" in deal && deal.purchasingLenderAuthId
			? deal.purchasingLenderAuthId
			: deal.buyerId;
	const sellingLenderAuthId =
		"sellingLenderAuthId" in deal && deal.sellingLenderAuthId
			? deal.sellingLenderAuthId
			: deal.sellerId;
	const [buyerUser, sellerUser, activeAccessRows, mortgage] = await Promise.all(
		[
			getUserByAuthId(ctx, purchasingLenderAuthId),
			getUserByAuthId(ctx, sellingLenderAuthId),
			getActiveDealAccessRows(ctx, deal._id),
			ctx.db.get(deal.mortgageId),
		]
	);

	const [buyerLender, sellerLender, primaryMortgageBorrower] =
		await Promise.all([
			getLenderByUserId(ctx, buyerUser?._id ?? null),
			getLenderByUserId(ctx, sellerUser?._id ?? null),
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
	const borrower = await borrowerProfile(ctx, primaryMortgageBorrower);
	const involvedParties: InvolvedPartyProjection[] = [
		{
			email: normalizeText(buyerUser?.email),
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: purchasingLenderAuthId,
				roles: new Set(["lender"]),
			}),
			label: "Purchasing lender",
			name: displayNameForAuthParticipant(purchasingLenderAuthId, buyerUser),
			role: "purchasing_lender",
		},
		{
			email: normalizeText(sellerUser?.email),
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: sellingLenderAuthId,
				roles: new Set(["lender"]),
			}),
			label: "Selling lender",
			name: displayNameForAuthParticipant(sellingLenderAuthId, sellerUser),
			role: "selling_lender",
		},
		{
			email: selectedLawyerEmail,
			hasWorkspaceAccess: selectedLawyerHasWorkspaceAccess,
			label: "Primary lawyer",
			name: selectedLawyerName,
			role: "primary_lawyer",
		},
		{
			email: broker?.email ?? null,
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: broker?.authId,
				roles: new Set(["assigned_broker", "broker_of_record"]),
			}),
			label: "Broker",
			name: broker?.displayName ?? null,
			role: "broker_of_record",
		},
		{
			email: borrower?.email ?? null,
			hasWorkspaceAccess: hasActiveWorkspaceAccess(activeAccessRows, {
				authId: borrower?.authId,
				roles: new Set(["borrower"]),
			}),
			label: "Primary borrower",
			name: borrower?.displayName ?? null,
			role: "primary_borrower",
		},
	];
	const purchasingLender: LenderPersonaProjection = {
		accessRole: "lender",
		authId: purchasingLenderAuthId,
		displayName: displayNameForAuthParticipant(
			purchasingLenderAuthId,
			buyerUser
		),
		email: normalizeText(buyerUser?.email),
		lenderId: buyerLender?._id ?? deal.lenderId ?? null,
		persona: "purchasing_lender",
		userId: buyerUser?._id ?? null,
	};
	const sellingLender: LenderPersonaProjection = {
		accessRole: "lender",
		authId: sellingLenderAuthId,
		displayName: displayNameForAuthParticipant(sellingLenderAuthId, sellerUser),
		email: normalizeText(sellerUser?.email),
		lenderId: sellerLender?._id ?? null,
		persona: "selling_lender",
		userId: sellerUser?._id ?? null,
	};
	const primaryBorrower: BorrowerPersonaProjection = {
		authId: borrower?.authId ?? null,
		borrowerId: primaryMortgageBorrower?._id ?? null,
		displayName: borrower?.displayName ?? null,
		email: borrower?.email ?? null,
		persona: "primary_borrower",
		userId: primaryMortgageBorrower?.userId ?? null,
	};
	const primaryLawyer: LawyerProjection & { persona: "primary_lawyer" } = {
		authId: lawyerAuthId,
		displayName:
			selectedLawyerName ??
			(lawyerAuthId
				? displayNameForAuthParticipant(lawyerAuthId, lawyerUser)
				: null),
		email: selectedLawyerEmail,
		hasActiveDealAccess: Boolean(
			lawyerAuthId && activeLawyerAccess?.userId === lawyerAuthId
		),
		lawyerType,
		persona: "primary_lawyer",
	};

	return {
		dealId: deal._id,
		buyer: {
			accessRole: "lender",
			authId: purchasingLenderAuthId,
			displayName: purchasingLender.displayName,
			email: normalizeText(buyerUser?.email),
			lenderId: buyerLender?._id ?? deal.lenderId ?? null,
			userId: buyerUser?._id ?? null,
		},
		seller: {
			accessRole: "lender",
			authId: sellingLenderAuthId,
			borrowerId: null,
			displayName: sellingLender.displayName,
			email: normalizeText(sellerUser?.email),
			lenderId: sellerLender?._id ?? null,
			userId: sellerUser?._id ?? null,
		},
		lawyer: {
			authId: primaryLawyer.authId,
			displayName: primaryLawyer.displayName,
			email: primaryLawyer.email,
			hasActiveDealAccess: primaryLawyer.hasActiveDealAccess,
			lawyerType: primaryLawyer.lawyerType,
		},
		fractionalShareDisplayPercent:
			fractionalShareStatus.fractionalShareDisplayPercent,
		fractionalShareStatus,
		fractionalShareUnits: fractionalShareStatus.fractionalShareUnits,
		involvedParties,
		personas: {
			assigned_broker: "assigned_broker",
			broker_of_record: "broker_of_record",
			fairlend_admin: "fairlend_admin",
			primary_borrower: "primary_borrower",
			primary_lawyer: "primary_lawyer",
			purchasing_lender: "purchasing_lender",
			selling_lender: "selling_lender",
		},
		primary_borrower: primaryBorrower,
		primary_lawyer: primaryLawyer,
		purchasing_lender: purchasingLender,
		selling_lender: sellingLender,
	};
}
