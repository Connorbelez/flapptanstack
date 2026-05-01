import type { MockIdentity } from "../../auth/helpers";
import {
	createMockViewer,
	ensureSeededIdentity,
} from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { micPortalFields } from "../../../../convex/portals/helpers";
import { createConvexTestKit } from "../testKit";

export const MIC_SCENARIO_NOW = Date.UTC(2026, 0, 15, 12, 0, 0);
export const MIC_SCENARIO_ORG_ID = "org_mic_seed_scenario";
export const MIC_SCENARIO_LENDER_AUTH_ID = "user_mic_seed_lender";
export const NON_MIC_LENDER_AUTH_ID = "user_non_mic_seed_lender";

const SYS_SOURCE = { type: "system" as const, channel: "test" };
const CASH_LEDGER_WARNING =
	"MIC treasury, reserve, cash-on-hand, NAV, and personalized investor metrics are intentionally omitted until complete cash-ledger coverage exists.";

export const MIC_INVESTOR: MockIdentity = createMockViewer({
	email: "mic.investor@example.com",
	firstName: "Mina",
	lastName: "Investor",
	orgId: MIC_SCENARIO_ORG_ID,
	orgName: "FairLend MIC",
	roles: ["micinvestor"],
	subject: "user_mic_seed_investor",
});

export interface SeededMicPortfolioScenario {
	expected: {
		cashLedgerWarning: string;
		concentrationByPropertyType: Array<{
			count: number;
			key: string;
			label: string;
			outstandingPrincipal: number;
			sharePercent: number;
		}>;
		excludedNonMicPositionLabel: string;
		firstMortgagePaymentShares: number[];
		metrics: {
			arrearsExposure: number;
			outstandingPrincipal: number;
			weightedAverageLtv: number;
			weightedAverageYield: number;
		};
		positionLabels: string[];
		positionOutstandingPrincipal: number[];
	};
	identities: {
		investor: MockIdentity;
	};
	ids: {
		firstMortgageId: Id<"mortgages">;
		portalId: Id<"portals">;
		secondMortgageId: Id<"mortgages">;
	};
	t: ReturnType<typeof createConvexTestKit>;
}

interface MortgageSeedInput {
	borrower: {
		authId: string;
		email: string;
		firstName: string;
		lastName: string;
	};
	city: string;
	idempotencyPrefix: string;
	interestRate: number;
	ltvRatio: number;
	maturityDate: string;
	micUnits: number;
	nonMicUnits?: number;
	obligations: Array<{
		amountCents: number;
		amountSettledCents: number;
		dueDate: string;
		paymentNumber: number;
		status: string;
	}>;
	paymentAmount: number;
	postalCode: string;
	principal: number;
	propertyType: "condo" | "multi_unit" | "residential";
	province: string;
	status: string;
	streetAddress: string;
	termMonths: number;
}

export async function seedMicPortfolioScenario(): Promise<SeededMicPortfolioScenario> {
	const t = createConvexTestKit();
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);
	await ensureSeededIdentity(t, MIC_INVESTOR);

	const ids = await t.run(async (ctx) => {
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
			.unique();
		if (!adminUser) {
			throw new Error("Expected seeded admin user");
		}

		const brokerId = await ctx.db.insert("brokers", {
			brokerageName: "FairLend MIC Origination Desk",
			createdAt: MIC_SCENARIO_NOW,
			orgId: MIC_SCENARIO_ORG_ID,
			status: "active",
			userId: adminUser._id,
		});

		const micLenderUserId = await ctx.db.insert("users", {
			authId: MIC_SCENARIO_LENDER_AUTH_ID,
			email: "mic-lender@example.com",
			firstName: "FairLend",
			lastName: "MIC",
		});
		const micLenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: MIC_SCENARIO_NOW,
			onboardingEntryPath: "admin_seed",
			orgId: MIC_SCENARIO_ORG_ID,
			status: "active",
			userId: micLenderUserId,
		});

		const nonMicLenderUserId = await ctx.db.insert("users", {
			authId: NON_MIC_LENDER_AUTH_ID,
			email: "non-mic-lender@example.com",
			firstName: "Outside",
			lastName: "Lender",
		});
		await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: MIC_SCENARIO_NOW,
			onboardingEntryPath: "admin_seed",
			orgId: MIC_SCENARIO_ORG_ID,
			status: "active",
			userId: nonMicLenderUserId,
		});

		const portalId = await ctx.db.insert("portals", {
			...micPortalFields({
				micLenderAuthId: MIC_SCENARIO_LENDER_AUTH_ID,
				now: MIC_SCENARIO_NOW,
				orgId: MIC_SCENARIO_ORG_ID,
			}),
			lenderId: micLenderId,
		});

		return { brokerId, portalId };
	});

	const admin = t.withIdentity(FAIRLEND_ADMIN);
	await admin.mutation(api.ledger.sequenceCounter.initializeSequenceCounter, {});

	const firstMortgageId = await seedMortgagePosition(t, {
		borrower: {
			authId: "user_mic_borrower_riverfront",
			email: "riverfront.borrower@example.com",
			firstName: "Riley",
			lastName: "River",
		},
		city: "Ottawa",
		idempotencyPrefix: "mic-scenario-riverfront",
		interestRate: 11.25,
		ltvRatio: 68,
		maturityDate: "2027-03-31",
		micUnits: 4000,
		nonMicUnits: 1000,
		obligations: [
			{
				amountCents: 200_000,
				amountSettledCents: 0,
				dueDate: "2026-03-01",
				paymentNumber: 2,
				status: "overdue",
			},
			{
				amountCents: 180_000,
				amountSettledCents: 180_000,
				dueDate: "2026-02-01",
				paymentNumber: 1,
				status: "settled",
			},
		],
		paymentAmount: 1800,
		postalCode: "K1P5G4",
		principal: 800_000,
		propertyType: "multi_unit",
		province: "ON",
		status: "active",
		streetAddress: "101 Riverfront Ave",
		termMonths: 18,
	});

	const secondMortgageId = await seedMortgagePosition(t, {
		borrower: {
			authId: "user_mic_borrower_maple",
			email: "maple.borrower@example.com",
			firstName: "Casey",
			lastName: "Maple",
		},
		city: "Kingston",
		idempotencyPrefix: "mic-scenario-maple",
		interestRate: 10.5,
		ltvRatio: 62,
		maturityDate: "2028-06-30",
		micUnits: 2500,
		obligations: [
			{
				amountCents: 125_000,
				amountSettledCents: 125_000,
				dueDate: "2026-02-15",
				paymentNumber: 1,
				status: "settled",
			},
		],
		paymentAmount: 1250,
		postalCode: "K7L1A1",
		principal: 600_000,
		propertyType: "residential",
		province: "ON",
		status: "funded",
		streetAddress: "88 Maple Ridge Rd",
		termMonths: 30,
	});
	await seedMortgagePosition(t, {
		borrower: {
			authId: "user_non_mic_borrower_oak",
			email: "oak.borrower@example.com",
			firstName: "Owen",
			lastName: "Oak",
		},
		city: "London",
		idempotencyPrefix: "mic-scenario-oak-excluded",
		interestRate: 9.75,
		ltvRatio: 55,
		maturityDate: "2027-09-30",
		micUnits: 0,
		nonMicUnits: 3000,
		obligations: [
			{
				amountCents: 90_000,
				amountSettledCents: 90_000,
				dueDate: "2026-02-20",
				paymentNumber: 1,
				status: "settled",
			},
		],
		paymentAmount: 900,
		postalCode: "N6A1A1",
		principal: 500_000,
		propertyType: "condo",
		province: "ON",
		status: "active",
		streetAddress: "5 Oak Lane",
		termMonths: 21,
	});

	return {
		expected: {
			cashLedgerWarning: CASH_LEDGER_WARNING,
			concentrationByPropertyType: [
				{
					count: 1,
					key: "multi_unit",
					label: "multi_unit",
					outstandingPrincipal: 3200,
					sharePercent: 68.09,
				},
				{
					count: 1,
					key: "residential",
					label: "residential",
					outstandingPrincipal: 1500,
					sharePercent: 31.91,
				},
			],
			excludedNonMicPositionLabel: "5 Oak Lane, London",
			firstMortgagePaymentShares: [800, 720],
			metrics: {
				arrearsExposure: 3200,
				outstandingPrincipal: 4700,
				weightedAverageLtv: 66.09,
				weightedAverageYield: 11.01,
			},
			positionLabels: ["101 Riverfront Ave, Ottawa", "88 Maple Ridge Rd, Kingston"],
			positionOutstandingPrincipal: [3200, 1500],
		},
		identities: {
			investor: MIC_INVESTOR,
		},
		ids: {
			firstMortgageId,
			portalId: ids.portalId,
			secondMortgageId,
		},
		t,
	};
}

async function seedMortgagePosition(
	t: ReturnType<typeof createConvexTestKit>,
	input: MortgageSeedInput
) {
	const ids = await t.run(async (ctx) => {
		const broker = await ctx.db
			.query("brokers")
			.withIndex("by_org_status", (query) =>
				query.eq("orgId", MIC_SCENARIO_ORG_ID).eq("status", "active")
			)
			.first();
		if (!broker) {
			throw new Error("Expected seeded MIC broker");
		}

		const borrowerUserId = await ctx.db.insert("users", {
			authId: input.borrower.authId,
			email: input.borrower.email,
			firstName: input.borrower.firstName,
			lastName: input.borrower.lastName,
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			createdAt: MIC_SCENARIO_NOW,
			orgId: MIC_SCENARIO_ORG_ID,
			status: "active",
			userId: borrowerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: input.city,
			createdAt: MIC_SCENARIO_NOW,
			postalCode: input.postalCode,
			propertyType: input.propertyType,
			province: input.province,
			streetAddress: input.streetAddress,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			assignedBrokerId: broker._id,
			brokerOfRecordId: broker._id,
			createdAt: MIC_SCENARIO_NOW,
			firstPaymentDate: "2026-02-01",
			fundedAt: MIC_SCENARIO_NOW,
			interestAdjustmentDate: "2026-01-15",
			interestRate: input.interestRate,
			lienPosition: 1,
			loanType: "conventional",
			maturityDate: input.maturityDate,
			orgId: MIC_SCENARIO_ORG_ID,
			paymentAmount: input.paymentAmount,
			paymentFrequency: "monthly",
			principal: input.principal,
			propertyId,
			rateType: "fixed",
			status: input.status,
			termMonths: input.termMonths,
			termStartDate: "2026-01-15",
		});
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: MIC_SCENARIO_NOW,
			borrowerId,
			mortgageId,
			role: "primary",
		});
		await ctx.db.insert("listings", {
			city: input.city,
			createdAt: MIC_SCENARIO_NOW,
			dataSource: "demo",
			description: `${input.streetAddress} MIC scenario listing`,
			featured: false,
			heroImages: [],
			interestRate: input.interestRate,
			lienPosition: 1,
			loanType: "conventional",
			ltvRatio: input.ltvRatio,
			maturityDate: input.maturityDate,
			monthlyPayment: input.paymentAmount,
			mortgageId,
			paymentFrequency: "monthly",
			principal: input.principal,
			propertyId,
			propertyType: input.propertyType,
			province: input.province,
			publicDocumentIds: [],
			rateType: "fixed",
			status: "published",
			termMonths: input.termMonths,
			title: `${input.streetAddress} Participation`,
			updatedAt: MIC_SCENARIO_NOW,
			viewCount: 0,
		});
		for (const obligation of input.obligations) {
			const dueTime = Date.parse(`${obligation.dueDate}T00:00:00.000Z`);
			await ctx.db.insert("obligations", {
				amount: obligation.amountCents,
				amountSettled: obligation.amountSettledCents,
				borrowerId,
				createdAt: MIC_SCENARIO_NOW,
				dueDate: dueTime,
				gracePeriodEnd: dueTime + 10 * 24 * 60 * 60 * 1000,
				mortgageId,
				orgId: MIC_SCENARIO_ORG_ID,
				paymentNumber: obligation.paymentNumber,
				status: obligation.status,
				type: "regular_interest",
			});
		}
		return mortgageId;
	});

	const admin = t.withIdentity(FAIRLEND_ADMIN);
	await admin.mutation(api.ledger.mutations.mintMortgage, {
		effectiveDate: "2026-01-15",
		idempotencyKey: `${input.idempotencyPrefix}-mint`,
		mortgageId: String(ids),
		source: SYS_SOURCE,
	});
	if (input.micUnits > 0) {
		await admin.mutation(internal.ledger.mutations.issueShares, {
			amount: input.micUnits,
			effectiveDate: "2026-01-15",
			idempotencyKey: `${input.idempotencyPrefix}-mic-issue`,
			lenderId: MIC_SCENARIO_LENDER_AUTH_ID,
			mortgageId: String(ids),
			source: SYS_SOURCE,
		});
	}
	if (input.nonMicUnits) {
		await admin.mutation(internal.ledger.mutations.issueShares, {
			amount: input.nonMicUnits,
			effectiveDate: "2026-01-15",
			idempotencyKey: `${input.idempotencyPrefix}-non-mic-issue`,
			lenderId: NON_MIC_LENDER_AUTH_ID,
			mortgageId: String(ids),
			source: SYS_SOURCE,
		});
	}

	return ids;
}
