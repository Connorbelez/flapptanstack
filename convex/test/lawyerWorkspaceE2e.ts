import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";

type TestDealKind = "representation" | "approval" | "completed";

interface SeededMatterIds {
	borrowerId: Id<"borrowers">;
	brokerId: Id<"brokers">;
	brokerUserId: Id<"users">;
	buyerUserId: Id<"users">;
	dealAccessId: Id<"dealAccess">;
	dealId: Id<"deals">;
	instanceId: Id<"dealDocumentInstances">;
	lenderId: Id<"lenders">;
	mortgageId: Id<"mortgages">;
	packageId: Id<"dealDocumentPackages">;
	propertyId: Id<"properties">;
	sellerUserId: Id<"users">;
}

interface SeededLawyerWorkspaceScenario {
	approval: SeededMatterIds;
	completed: SeededMatterIds;
	representation: SeededMatterIds;
}

function assertE2eEnabled() {
	if (process.env.ALLOW_TEST_AUTH_ENDPOINTS !== "true") {
		throw new ConvexError("Lawyer workspace e2e endpoints are disabled");
	}
}

function requireViewerOrgId(ctx: { viewer: { orgId?: string } }) {
	if (!ctx.viewer.orgId) {
		throw new ConvexError("E2E lawyer workspace seed requires org context");
	}
	return ctx.viewer.orgId;
}

function matterNames(kind: TestDealKind) {
	switch (kind) {
		case "representation":
			return {
				buyer: "E2E Representation Buyer",
				seller: "E2E Representation Seller",
			};
		case "approval":
			return {
				buyer: "E2E Approval Buyer",
				seller: "E2E Approval Seller",
			};
		case "completed":
			return {
				buyer: "E2E Completed Buyer",
				seller: "E2E Completed Seller",
			};
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
}

function statusForMatter(kind: TestDealKind) {
	switch (kind) {
		case "representation":
			return "lawyerOnboarding.verified";
		case "approval":
			return "documentReview.pending";
		case "completed":
			return "confirmed";
		default: {
			const exhaustive: never = kind;
			return exhaustive;
		}
	}
}

async function insertMatter(
	ctx: Pick<MutationCtx, "db"> & { viewer: { authId: string; orgId?: string } },
	kind: TestDealKind
): Promise<SeededMatterIds> {
	const orgId = requireViewerOrgId(ctx);
	const names = matterNames(kind);
	const now = Date.now();
	const suffix = `${kind}-${now}`;

	const buyerUserId = await ctx.db.insert("users", {
		authId: `e2e-${suffix}-buyer`,
		email: `${suffix}-buyer@test.fairlend.ca`,
		firstName: names.buyer,
		lastName: "Client",
	});
	const sellerUserId = await ctx.db.insert("users", {
		authId: `e2e-${suffix}-seller`,
		email: `${suffix}-seller@test.fairlend.ca`,
		firstName: names.seller,
		lastName: "Client",
	});
	const brokerUserId = await ctx.db.insert("users", {
		authId: `e2e-${suffix}-broker`,
		email: `${suffix}-broker@test.fairlend.ca`,
		firstName: "E2E Broker",
		lastName: "User",
	});
	const brokerId = await ctx.db.insert("brokers", {
		createdAt: now,
		status: "active",
		userId: brokerUserId,
	});
	const lenderId = await ctx.db.insert("lenders", {
		accreditationStatus: "accredited",
		brokerId,
		createdAt: now,
		onboardingEntryPath: "e2e",
		status: "active",
		userId: buyerUserId,
	});
	const borrowerId = await ctx.db.insert("borrowers", {
		createdAt: now,
		status: "active",
		userId: sellerUserId,
	});
	const propertyId = await ctx.db.insert("properties", {
		city: "Toronto",
		createdAt: now,
		postalCode: "M5V 1A1",
		propertyType: "residential",
		province: "ON",
		streetAddress: `${kind} King St W`,
	});
	const mortgageId = await ctx.db.insert("mortgages", {
		amortizationMonths: 300,
		brokerOfRecordId: brokerId,
		createdAt: now,
		firstPaymentDate: "2026-02-01",
		interestAdjustmentDate: "2026-01-01",
		interestRate: 9.5,
		lienPosition: 1,
		loanType: "conventional",
		maturityDate: "2031-01-01",
		orgId,
		paymentAmount: 2500,
		paymentFrequency: "monthly",
		principal: 500_000,
		propertyId,
		rateType: "fixed",
		status: "funded",
		termMonths: 60,
		termStartDate: "2026-01-01",
	});
	const dealId = await ctx.db.insert("deals", {
		buyerId: `e2e-${suffix}-buyer`,
		closingDate: now + 14 * 86_400_000,
		createdAt: now,
		createdBy: ctx.viewer.authId,
		fractionalShare: kind === "completed" ? 1000 : 2500,
		lawyerId: ctx.viewer.authId,
		lawyerType: "guest_lawyer",
		lenderId,
		mortgageId,
		selectedLawyer: {
			email: `${ctx.viewer.authId}@e2e.fairlend.ca`,
			name: "E2E Closing Lawyer",
			source: "manual",
			type: "guest_lawyer",
		},
		orgId,
		sellerId: `e2e-${suffix}-seller`,
		status: statusForMatter(kind),
	});
	const dealAccessId = await ctx.db.insert("dealAccess", {
		dealId,
		grantedAt: now,
		grantedBy: ctx.viewer.authId,
		revokedAt: kind === "completed" ? now + 1000 : undefined,
		role: "guest_lawyer",
		status: kind === "completed" ? "revoked" : "active",
		userId: ctx.viewer.authId,
	});
	const packageId = await ctx.db.insert("dealDocumentPackages", {
		createdAt: now,
		dealId,
		mortgageId,
		readyAt: now,
		retryCount: 0,
		status: "ready",
		updatedAt: now,
	});
	const instanceId = await ctx.db.insert("dealDocumentInstances", {
		createdAt: now,
		dealId,
		kind: "generated",
		mortgageId,
		packageId,
		sourceBlueprintSnapshot: {
			class: "private_templated_signable",
			displayName: `${names.buyer} Closing Signature Package`,
			displayOrder: 1,
			packageLabel: "Closing",
		},
		status: "available",
		updatedAt: now,
	});

	return {
		borrowerId,
		brokerId,
		brokerUserId,
		buyerUserId,
		dealAccessId,
		dealId,
		instanceId,
		lenderId,
		mortgageId,
		packageId,
		propertyId,
		sellerUserId,
	};
}

async function deleteIfExists<
	TTable extends Parameters<MutationCtx["db"]["delete"]>[0],
>(ctx: Pick<MutationCtx, "db">, id: TTable | null | undefined) {
	if (id) {
		await ctx.db.delete(id);
	}
}

async function cleanupMatter(
	ctx: Pick<MutationCtx, "db">,
	matter: SeededMatterIds
) {
	await deleteIfExists(ctx, matter.instanceId);
	await deleteIfExists(ctx, matter.packageId);
	await deleteIfExists(ctx, matter.dealAccessId);
	await deleteIfExists(ctx, matter.dealId);
	await deleteIfExists(ctx, matter.mortgageId);
	await deleteIfExists(ctx, matter.propertyId);
	await deleteIfExists(ctx, matter.borrowerId);
	await deleteIfExists(ctx, matter.lenderId);
	await deleteIfExists(ctx, matter.brokerId);
	await deleteIfExists(ctx, matter.brokerUserId);
	await deleteIfExists(ctx, matter.buyerUserId);
	await deleteIfExists(ctx, matter.sellerUserId);
}

export const seedLawyerWorkspaceScenario = adminMutation
	.handler(async (ctx): Promise<SeededLawyerWorkspaceScenario> => {
		assertE2eEnabled();
		return {
			representation: await insertMatter(ctx, "representation"),
			approval: await insertMatter(ctx, "approval"),
			completed: await insertMatter(ctx, "completed"),
		};
	})
	.public();

export const cleanupLawyerWorkspaceScenario = adminMutation
	.input({
		scenario: v.object({
			approval: v.object({
				borrowerId: v.id("borrowers"),
				brokerId: v.id("brokers"),
				brokerUserId: v.id("users"),
				buyerUserId: v.id("users"),
				dealAccessId: v.id("dealAccess"),
				dealId: v.id("deals"),
				instanceId: v.id("dealDocumentInstances"),
				lenderId: v.id("lenders"),
				mortgageId: v.id("mortgages"),
				packageId: v.id("dealDocumentPackages"),
				propertyId: v.id("properties"),
				sellerUserId: v.id("users"),
			}),
			completed: v.object({
				borrowerId: v.id("borrowers"),
				brokerId: v.id("brokers"),
				brokerUserId: v.id("users"),
				buyerUserId: v.id("users"),
				dealAccessId: v.id("dealAccess"),
				dealId: v.id("deals"),
				instanceId: v.id("dealDocumentInstances"),
				lenderId: v.id("lenders"),
				mortgageId: v.id("mortgages"),
				packageId: v.id("dealDocumentPackages"),
				propertyId: v.id("properties"),
				sellerUserId: v.id("users"),
			}),
			representation: v.object({
				borrowerId: v.id("borrowers"),
				brokerId: v.id("brokers"),
				brokerUserId: v.id("users"),
				buyerUserId: v.id("users"),
				dealAccessId: v.id("dealAccess"),
				dealId: v.id("deals"),
				instanceId: v.id("dealDocumentInstances"),
				lenderId: v.id("lenders"),
				mortgageId: v.id("mortgages"),
				packageId: v.id("dealDocumentPackages"),
				propertyId: v.id("properties"),
				sellerUserId: v.id("users"),
			}),
		}),
	})
	.handler(async (ctx, args) => {
		assertE2eEnabled();
		await cleanupMatter(ctx, args.scenario.approval);
		await cleanupMatter(ctx, args.scenario.completed);
		await cleanupMatter(ctx, args.scenario.representation);
		return { ok: true as const };
	})
	.public();
