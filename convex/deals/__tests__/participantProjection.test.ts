import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";
import {
	buildDealParticipantProjection,
	mapDealAccessRoleToPortalPersona,
	projectFractionalShareUnits,
} from "../participantProjection";

const modules = convexModules;

describe("deal participant projection contract", () => {
	it("maps storage access roles to portal personas without migrating storage values", () => {
		expect(mapDealAccessRoleToPortalPersona("lender")).toBe("buyer");
		expect(mapDealAccessRoleToPortalPersona("borrower")).toBe("seller");
		expect(mapDealAccessRoleToPortalPersona("platform_lawyer")).toBe("lawyer");
		expect(mapDealAccessRoleToPortalPersona("guest_lawyer")).toBe("lawyer");
		expect(mapDealAccessRoleToPortalPersona("broker_of_record")).toBe("broker");
		expect(mapDealAccessRoleToPortalPersona("assigned_broker")).toBe("broker");
	});

	it("projects 10000-based fraction units into display percent", () => {
		expect(projectFractionalShareUnits(2500)).toEqual({
			fractionalShareDisplayPercent: 25,
			fractionalShareUnits: 2500,
			isValid: true,
			validationError: null,
		});
	});

	it("surfaces invalid fraction units without rendering them as percentages", () => {
		expect(projectFractionalShareUnits(10_001)).toMatchObject({
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: 10_001,
			isValid: false,
		});
		expect(projectFractionalShareUnits(0.5)).toMatchObject({
			fractionalShareDisplayPercent: null,
			fractionalShareUnits: 0.5,
			isValid: false,
		});
	});

	it("resolves buyer, seller, lawyer, active access, and fallback fields", async () => {
		const t = convexTest(schema, modules);

		const projection = await t.run(async (ctx) => {
			const [buyerUserId, sellerUserId, brokerUserId] = await Promise.all([
				ctx.db.insert("users", {
					authId: "buyer-auth",
					email: "buyer@test.fairlend.ca",
					firstName: "Bianca",
					lastName: "Buyer",
				}),
				ctx.db.insert("users", {
					authId: "seller-auth",
					email: "seller@test.fairlend.ca",
					firstName: "Sam",
					lastName: "Seller",
				}),
				ctx.db.insert("users", {
					authId: "lawyer-auth",
					email: "lawyer@test.fairlend.ca",
					firstName: "Laura",
					lastName: "Lawyer",
				}),
				ctx.db.insert("users", {
					authId: "broker-auth",
					email: "broker@test.fairlend.ca",
					firstName: "Bryn",
					lastName: "Broker",
				}),
			]).then(([buyer, seller, _lawyer, broker]) => [buyer, seller, broker]);
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: 1,
				status: "active",
				userId: brokerUserId,
			});
			const buyerLenderId = await ctx.db.insert("lenders", {
				accreditationStatus: "accredited",
				brokerId,
				createdAt: 1,
				onboardingEntryPath: "seed",
				status: "active",
				userId: buyerUserId,
			});
			const sellerBorrowerId = await ctx.db.insert("borrowers", {
				createdAt: 1,
				status: "active",
				userId: sellerUserId,
			});
			const propertyId = await ctx.db.insert("properties", {
				city: "Toronto",
				createdAt: 1,
				postalCode: "M5V 1A1",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King St W",
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				amortizationMonths: 300,
				brokerOfRecordId: brokerId,
				createdAt: 1,
				firstPaymentDate: "2026-02-01",
				interestAdjustmentDate: "2026-01-01",
				interestRate: 9.5,
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-01-01",
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
				buyerId: "buyer-auth",
				createdAt: 1,
				createdBy: "admin-auth",
				fractionalShare: 2500,
				lawyerId: "lawyer-auth",
				lawyerType: "guest_lawyer",
				lenderId: buyerLenderId,
				mortgageId,
				sellerId: "seller-auth",
				status: "lawyerOnboarding.pending",
			});
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: 1,
				grantedBy: "admin-auth",
				role: "guest_lawyer",
				status: "active",
				userId: "lawyer-auth",
			});

			const deal = await ctx.db.get(dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			const result = await buildDealParticipantProjection(ctx, deal);
			return { buyerLenderId, projection: result, sellerBorrowerId };
		});

		expect(projection.projection.buyer).toMatchObject({
			accessRole: "lender",
			authId: "buyer-auth",
			displayName: "Bianca Buyer",
			email: "buyer@test.fairlend.ca",
			lenderId: projection.buyerLenderId,
		});
		expect(projection.projection.seller).toMatchObject({
			accessRole: "borrower",
			authId: "seller-auth",
			borrowerId: projection.sellerBorrowerId,
			displayName: "Sam Seller",
		});
		expect(projection.projection.lawyer).toMatchObject({
			authId: "lawyer-auth",
			displayName: "Laura Lawyer",
			email: "lawyer@test.fairlend.ca",
			hasActiveDealAccess: true,
			lawyerType: "guest_lawyer",
		});
		expect(projection.projection.involvedParties).toEqual([
			{
				email: "buyer@test.fairlend.ca",
				hasWorkspaceAccess: false,
				label: "Buyer",
				name: "Bianca Buyer",
				role: "buyer",
			},
			{
				email: "seller@test.fairlend.ca",
				hasWorkspaceAccess: false,
				label: "Seller",
				name: "Sam Seller",
				role: "seller",
			},
			{
				email: "lawyer@test.fairlend.ca",
				hasWorkspaceAccess: true,
				label: "Buyer's Lawyer",
				name: "Laura Lawyer",
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
				email: "broker@test.fairlend.ca",
				hasWorkspaceAccess: false,
				label: "Broker",
				name: "Bryn Broker",
				role: "broker",
			},
			{
				email: "seller@test.fairlend.ca",
				hasWorkspaceAccess: false,
				label: "Borrower",
				name: "Sam Seller",
				role: "borrower",
			},
		]);
		expect(projection.projection.fractionalShareDisplayPercent).toBe(25);
	});

	it("does not attach another lawyer active access row to the projected deal lawyer", async () => {
		const t = convexTest(schema, modules);

		const projection = await t.run(async (ctx) => {
			const brokerUserId = await ctx.db.insert("users", {
				authId: "broker-auth",
				email: "broker@test.fairlend.ca",
				firstName: "Bryn",
				lastName: "Broker",
			});
			await Promise.all([
				ctx.db.insert("users", {
					authId: "deal-lawyer-auth",
					email: "deal-lawyer@test.fairlend.ca",
					firstName: "Dana",
					lastName: "DealLawyer",
				}),
				ctx.db.insert("users", {
					authId: "other-lawyer-auth",
					email: "other-lawyer@test.fairlend.ca",
					firstName: "Omar",
					lastName: "OtherLawyer",
				}),
			]);
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: 1,
				status: "active",
				userId: brokerUserId,
			});
			const propertyId = await ctx.db.insert("properties", {
				city: "Toronto",
				createdAt: 1,
				postalCode: "M5V 1A1",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King St W",
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				amortizationMonths: 300,
				brokerOfRecordId: brokerId,
				createdAt: 1,
				firstPaymentDate: "2026-02-01",
				interestAdjustmentDate: "2026-01-01",
				interestRate: 9.5,
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-01-01",
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
				buyerId: "buyer-auth",
				createdAt: 1,
				createdBy: "admin-auth",
				fractionalShare: 2500,
				lawyerId: "deal-lawyer-auth",
				lawyerType: "platform_lawyer",
				mortgageId,
				sellerId: "seller-auth",
				status: "lawyerOnboarding.pending",
			});
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: 1,
				grantedBy: "admin-auth",
				role: "guest_lawyer",
				status: "active",
				userId: "other-lawyer-auth",
			});

			const deal = await ctx.db.get(dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return buildDealParticipantProjection(ctx, deal);
		});

		expect(projection.lawyer).toMatchObject({
			authId: "deal-lawyer-auth",
			displayName: "Dana DealLawyer",
			email: "deal-lawyer@test.fairlend.ca",
			hasActiveDealAccess: false,
			lawyerType: "platform_lawyer",
		});
	});

	it("keeps unresolved participants and missing lawyer as explicit nullable fields", async () => {
		const t = convexTest(schema, modules);

		const projection = await t.run(async (ctx) => {
			const brokerUserId = await ctx.db.insert("users", {
				authId: "broker-auth",
				email: "broker@test.fairlend.ca",
				firstName: "Bryn",
				lastName: "Broker",
			});
			const brokerId = await ctx.db.insert("brokers", {
				createdAt: 1,
				status: "active",
				userId: brokerUserId,
			});
			const propertyId = await ctx.db.insert("properties", {
				city: "Toronto",
				createdAt: 1,
				postalCode: "M5V 1A1",
				propertyType: "residential",
				province: "ON",
				streetAddress: "123 King St W",
			});
			const mortgageId = await ctx.db.insert("mortgages", {
				amortizationMonths: 300,
				brokerOfRecordId: brokerId,
				createdAt: 1,
				firstPaymentDate: "2026-02-01",
				interestAdjustmentDate: "2026-01-01",
				interestRate: 9.5,
				lienPosition: 1,
				loanType: "conventional",
				maturityDate: "2031-01-01",
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
				buyerId: "unresolved-buyer-auth",
				createdAt: 1,
				createdBy: "admin-auth",
				fractionalShare: 10_001,
				mortgageId,
				sellerId: "unresolved-seller-auth",
				status: "lawyerOnboarding.pending",
			});
			const deal = await ctx.db.get(dealId);
			if (!deal) {
				throw new Error("seeded deal missing");
			}
			return buildDealParticipantProjection(ctx, deal);
		});

		expect(projection.buyer).toMatchObject({
			authId: "unresolved-buyer-auth",
			displayName: "unresolved-buyer-auth",
			email: null,
			lenderId: null,
			userId: null,
		});
		expect(projection.seller).toMatchObject({
			authId: "unresolved-seller-auth",
			displayName: "unresolved-seller-auth",
			email: null,
			userId: null,
		});
		expect(projection.lawyer).toEqual({
			authId: null,
			displayName: null,
			email: null,
			hasActiveDealAccess: false,
			lawyerType: null,
		});
		expect(projection.involvedParties.map((party) => party.label)).toEqual([
			"Buyer",
			"Seller",
			"Buyer's Lawyer",
			"Seller's Lawyer",
			"Broker",
			"Borrower",
		]);
		expect(projection.fractionalShareStatus).toMatchObject({
			fractionalShareDisplayPercent: null,
			isValid: false,
		});
	});
});
