import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import aggregateSchema from "../../../node_modules/@convex-dev/aggregate/dist/component/schema.js";
import auditLogSchema from "../../../node_modules/convex-audit-log/dist/component/schema.js";
import { api } from "../../_generated/api";
import type { Doc, Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import { recordSignedRepresentationEngagementRow } from "../../legalRepresentation/engagements";
import {
	buildEligiblePlatformLawyerProfileFixture,
	buildEligiblePlatformLsoLawyerFixture,
} from "../../legalRepresentation/fixtures";
import { buildManualLawyerVerificationResult } from "../../legalRepresentation/providers";
import { recordLawyerVerificationRow } from "../../legalRepresentation/verifications";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const aggregateModules = {
	"/node_modules/@convex-dev/aggregate/dist/component/_generated/api.js":
		async () =>
			await import(
				"../../../node_modules/@convex-dev/aggregate/dist/component/_generated/api.js"
			),
	"/node_modules/@convex-dev/aggregate/dist/component/_generated/server.js":
		async () =>
			await import(
				"../../../node_modules/@convex-dev/aggregate/dist/component/_generated/server.js"
			),
	"/node_modules/@convex-dev/aggregate/dist/component/arbitrary.helpers.js":
		async () =>
			await import(
				"../../../node_modules/@convex-dev/aggregate/dist/component/arbitrary.helpers.js"
			),
	"/node_modules/@convex-dev/aggregate/dist/component/btree.js": async () =>
		await import(
			"../../../node_modules/@convex-dev/aggregate/dist/component/btree.js"
		),
	"/node_modules/@convex-dev/aggregate/dist/component/compare.js": async () =>
		await import(
			"../../../node_modules/@convex-dev/aggregate/dist/component/compare.js"
		),
	"/node_modules/@convex-dev/aggregate/dist/component/inspect.js": async () =>
		await import(
			"../../../node_modules/@convex-dev/aggregate/dist/component/inspect.js"
		),
	"/node_modules/@convex-dev/aggregate/dist/component/public.js": async () =>
		await import(
			"../../../node_modules/@convex-dev/aggregate/dist/component/public.js"
		),
};

const auditLogModules = {
	"/node_modules/convex-audit-log/dist/component/_generated/api.js": async () =>
		await import(
			"../../../node_modules/convex-audit-log/dist/component/_generated/api.js"
		),
	"/node_modules/convex-audit-log/dist/component/_generated/server.js":
		async () =>
			await import(
				"../../../node_modules/convex-audit-log/dist/component/_generated/server.js"
			),
	"/node_modules/convex-audit-log/dist/component/aggregates.js": async () =>
		await import(
			"../../../node_modules/convex-audit-log/dist/component/aggregates.js"
		),
	"/node_modules/convex-audit-log/dist/component/lib.js": async () =>
		await import(
			"../../../node_modules/convex-audit-log/dist/component/lib.js"
		),
	"/node_modules/convex-audit-log/dist/component/schema.js": async () =>
		await import(
			"../../../node_modules/convex-audit-log/dist/component/schema.js"
		),
	"/node_modules/convex-audit-log/dist/component/shared.js": async () =>
		await import(
			"../../../node_modules/convex-audit-log/dist/component/shared.js"
		),
};

const modules = {
	...convexModules,
};
const LAWYER_ACCESS_ERROR = /lawyer:access/;
const NO_LAWYER_ACCESS_ERROR = /Forbidden: no lawyer access/;
const NO_ACTIVE_LAWYER_ACCESS_ERROR = /Forbidden: no active lawyer access/;
const INVALID_STATE_ERROR = /Invalid deal state/;
const PACKAGE_APPROVAL_BLOCKED_ERROR =
	/Document package is not ready for lawyer approval/;
const EMPTY_DOCUMENT_SKIP_BLOCKED_ERROR =
	/only be skipped when no document instances exist/i;
const MISSING_ENGAGEMENT_ERROR =
	/Signed representation engagement evidence is required/;
const MISSING_VERIFICATION_ERROR =
	/Current eligible lawyer verification evidence is required/;

function createLawyerWorkspaceTestHarness() {
	process.env.DISABLE_GT_HASHCHAIN = "true";
	const t = convexTest(schema, modules);
	t.registerComponent("auditLog", auditLogSchema, auditLogModules);
	t.registerComponent(
		"auditLog/aggregateBySeverity",
		aggregateSchema,
		aggregateModules
	);
	t.registerComponent(
		"auditLog/aggregateByAction",
		aggregateSchema,
		aggregateModules
	);
	return t;
}

function lawyerIdentity(authId: string, email = `${authId}@test.fairlend.ca`) {
	return {
		subject: authId,
		issuer: "https://api.workos.com",
		org_id: "org_law_firm",
		organization_name: "Law Firm",
		role: "lawyer",
		roles: JSON.stringify(["lawyer"]),
		permissions: JSON.stringify(["lawyer:access", "deal:view"]),
		user_email: email,
		user_first_name: "Laura",
		user_last_name: "Lawyer",
	};
}

function memberIdentity(authId: string) {
	return {
		subject: authId,
		issuer: "https://api.workos.com",
		org_id: "org_member",
		organization_name: "Member Org",
		role: "member",
		roles: JSON.stringify(["member"]),
		permissions: JSON.stringify(["deal:view"]),
		user_email: `${authId}@test.fairlend.ca`,
		user_first_name: "Unauth",
		user_last_name: "Member",
	};
}

function fairLendAdminIdentity(authId: string) {
	return {
		subject: authId,
		issuer: "https://api.workos.com",
		org_id: FAIRLEND_STAFF_ORG_ID,
		organization_name: "FairLend Staff",
		role: "admin",
		roles: JSON.stringify(["admin"]),
		permissions: JSON.stringify(["admin:access"]),
		user_email: `${authId}@fairlend.ca`,
		user_first_name: "Admin",
		user_last_name: "User",
	};
}

async function seedLawyerWorkspaceFixture(args?: {
	accessStatus?: "active" | "revoked";
	attemptStatus?: Doc<"dealEnvelopeAttempts">["status"];
	dealStatus?: string;
	includePreSendException?: boolean;
	includeEnvelope?: boolean;
	includeDocumentInstance?: boolean;
	includeRepresentationEngagement?: boolean;
	includeVerificationEvidence?: boolean;
	instanceStatus?: Doc<"dealDocumentInstances">["status"];
	lawyerAuthId?: string;
	packageStatus?: Doc<"dealDocumentPackages">["status"];
}) {
	const t = createLawyerWorkspaceTestHarness();
	const lawyerAuthId = args?.lawyerAuthId ?? "lawyer-auth";
	const ids = await t.run(async (ctx) => {
		const [buyerUserId, sellerUserId, lawyerUserId, brokerUserId] =
			await Promise.all([
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
					authId: lawyerAuthId,
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
			]);
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: 1,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: 1,
			onboardingEntryPath: "seed",
			status: "active",
			userId: buyerUserId,
		});
		await ctx.db.insert("borrowers", {
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
		const lsoLawyerId = await ctx.db.insert(
			"lsoLawyers",
			buildEligiblePlatformLsoLawyerFixture({ now: 1 })
		);
		const dealId = await ctx.db.insert("deals", {
			buyerId: "buyer-auth",
			closingDate: 1_800_000_000_000,
			createdAt: 1,
			createdBy: "admin-auth",
			fractionalShare: 2500,
			lawyerId: lawyerAuthId,
			lawyerType: "guest_lawyer",
			lenderId,
			mortgageId,
			selectedLawyer: {
				type: "guest_lawyer",
				source: "lso_search",
				name: "Laura Lawyer",
				email: "lawyer@test.fairlend.ca",
				firm: "Law Firm",
				lso: {
					barNumber: "LSO123456",
					jurisdiction: "ON",
					licensingStatus: "licensed",
					restrictionStatus: "clear",
					lsoLawyerId,
					source: "test_fixture",
					sourceFetchedAt: 1,
				},
			},
			sellerId: "seller-auth",
			status: args?.dealStatus ?? "documentReview.pending",
		});
		await ctx.db.insert("dealAccess", {
			dealId,
			grantedAt: 1,
			grantedBy: "admin-auth",
			revokedAt: args?.accessStatus === "revoked" ? 20 : undefined,
			role: "guest_lawyer",
			status: args?.accessStatus ?? "active",
			userId: lawyerAuthId,
		});
		const lawyerProfileId = await ctx.db.insert("lawyerProfiles", {
			...buildEligiblePlatformLawyerProfileFixture({
				lawyerAuthId,
				now: 1,
			}),
			email: "lawyer@test.fairlend.ca",
			normalizedEmail: "lawyer@test.fairlend.ca",
			profileKind: "guest",
			platformStatus: undefined,
		});
		if (args?.includeVerificationEvidence) {
			await recordLawyerVerificationRow(ctx, {
				authId: lawyerAuthId,
				barNumber: "LSO123456",
				checkType: "initial_lso",
				createdAt: 1,
				createdBy: "system:test",
				dealId,
				jurisdiction: "ON",
				lawyerProfileId,
				lsoLawyerId,
				normalizedEmail: "lawyer@test.fairlend.ca",
				providerResult: buildManualLawyerVerificationResult({
					evidenceHash: `lawyer-workspace-verification:${lawyerAuthId}`,
					expiresAt: 2_000_000_000_000,
					outcome: "eligible",
					reasonCodes: ["active_license"],
					sourceSnapshot: { source: "lawyer-workspace-test" },
				}),
			});
		}
		if (args?.includeRepresentationEngagement) {
			await recordSignedRepresentationEngagementRow(ctx, {
				dealId,
				evidenceHash: `sha256:lawyer-workspace-engagement:${lawyerAuthId}`,
				lawyerAuthId,
				lawyerProfileId,
				signedAt: 1,
			});
		}
		const packageId = await ctx.db.insert("dealDocumentPackages", {
			createdAt: 1,
			dealId,
			mortgageId,
			readyAt: args?.packageStatus === "ready" ? 1 : undefined,
			retryCount: 0,
			status: args?.packageStatus ?? "ready",
			updatedAt: 1,
		});
		let attemptId: Id<"dealEnvelopeAttempts"> | null = null;
		if (args?.includeDocumentInstance ?? true) {
			const instanceId = await ctx.db.insert("dealDocumentInstances", {
				createdAt: 1,
				dealId,
				kind: "generated",
				mortgageId,
				packageId,
				sourceBlueprintSnapshot: {
					class: "private_templated_signable",
					displayName: "Closing Signature Package",
					displayOrder: 1,
					packageLabel: "Closing",
				},
				status:
					args?.instanceStatus ??
					(args?.includeEnvelope
						? "signature_sent"
						: "signature_pending_recipient_resolution"),
				updatedAt: 1,
			});

			if (args?.includeEnvelope) {
				attemptId = await ctx.db.insert("dealEnvelopeAttempts", {
					active: true,
					attemptNumber: 1,
					createdAt: 10,
					dealDocumentInstanceId: instanceId,
					dealId,
					idempotencyKey: "attempt-1",
					packageId,
					provider: "documenso",
					providerDocumentId: "doc_1",
					providerEnvelopeId: "env_1",
					recipientRoster: [],
					status: args?.attemptStatus ?? "partially_signed",
					updatedAt: 10,
				});
				await ctx.db.insert("dealEnvelopeRecipients", {
					attemptId,
					completedAt: 30,
					createdAt: 11,
					dealDocumentInstanceId: instanceId,
					dealId,
					documensoRole: "SIGNER",
					email: "buyer@test.fairlend.ca",
					name: "Bianca Buyer",
					packageId,
					platformRole: "lender_primary",
					readStatus: "opened",
					required: true,
					sendStatus: "sent",
					signingOrder: 1,
					signingStatus: "completed",
					updatedAt: 30,
				});
				await ctx.db.insert("dealEnvelopeRecipients", {
					attemptId,
					createdAt: 12,
					dealDocumentInstanceId: instanceId,
					dealId,
					documensoRole: "APPROVER",
					email: "lawyer@test.fairlend.ca",
					embeddedSigningToken: "secret-token",
					name: "Laura Lawyer",
					packageId,
					platformRole: "lawyer_primary",
					readStatus: "available",
					required: true,
					sendStatus: "sent",
					signingOrder: 2,
					signingStatus: "not_started",
					tokenAvailableAt: 12,
					tokenExpiresAt: 2_000_000_000_000,
					updatedAt: 12,
				});
				if (args.includePreSendException ?? true) {
					await ctx.db.insert("dealSigningExceptions", {
						attemptId,
						createdAt: 13,
						dealDocumentInstanceId: instanceId,
						dealId,
						kind: "pre_send_configuration_failure",
						message: "Package configuration is incomplete.",
						packageId,
						severity: "blocking",
						status: "open",
						updatedAt: 13,
					});
				}
			}
		}

		return { dealId, lawyerUserId, packageId };
	});

	return { t, ...ids, lawyerAuthId };
}

describe("lawyer workspace projections", () => {
	it("lists only matters assigned to the authenticated active lawyer", async () => {
		const { t } = await seedLawyerWorkspaceFixture();

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.query(api.deals.lawyerQueries.listAssignedClosings, {});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			accessState: "active",
			bucket: "needsPackageReview",
			fractionalShareDisplayPercent: 25,
			matterName: "Bianca Buyer / Sam Seller",
			status: "documentReview.pending",
		});
		expect(JSON.stringify(result)).not.toContain("fractionalShareUnits");

		const unrelated = await t
			.withIdentity(lawyerIdentity("other-lawyer-auth"))
			.query(api.deals.lawyerQueries.listAssignedClosings, {});
		expect(unrelated).toEqual([]);
	});

	it("denies non-lawyers and unrelated lawyers before returning workspace data", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture();

		await expect(
			t
				.withIdentity(memberIdentity("member-auth"))
				.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId })
		).rejects.toThrow(LAWYER_ACCESS_ERROR);

		await expect(
			t
				.withIdentity(lawyerIdentity("other-lawyer-auth"))
				.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId })
		).rejects.toThrow(NO_LAWYER_ACCESS_ERROR);
	});

	it("returns completed revoked lawyer access as read-only workspace data", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			accessStatus: "revoked",
			dealStatus: "confirmed",
		});

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId });

		expect(result?.access).toMatchObject({
			accessRole: "guest_lawyer",
			accessState: "completed_read_only",
		});
		expect(result?.readOnly).toBe(true);
		expect(result?.timeline.closeMilestones).toEqual([
			expect.objectContaining({
				description: "Deal close confirmed.",
				title: "Close complete",
			}),
		]);
		expect(JSON.stringify(result)).not.toContain("fractionalShareUnits");
	});

	it("returns completed active lawyer access as read-only workspace data", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			accessStatus: "active",
			dealStatus: "confirmed",
		});

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId });

		expect(result?.access).toMatchObject({
			accessRole: "guest_lawyer",
			accessState: "completed_read_only",
		});
		expect(result?.readOnly).toBe(true);
	});

	it("returns read-only workspace data to FairLend admins without lawyer assignment", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			lawyerAuthId: "assigned-lawyer-auth",
		});

		const result = await t
			.withIdentity(fairLendAdminIdentity("admin-auth"))
			.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId });

		expect(result?.access).toMatchObject({
			accessRole: "platform_lawyer",
			accessState: "completed_read_only",
		});
		expect(result?.deal.dealId).toBe(dealId);
		expect(result?.readOnly).toBe(true);
	});

	it("projects package blockers, envelope progress, exceptions, and hides embedded tokens", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			includeEnvelope: true,
			includeVerificationEvidence: true,
		});

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.query(api.deals.lawyerQueries.getLawyerDealWorkspace, { dealId });

		expect(result?.packageReview.approval).toMatchObject({
			eligible: false,
			blockers: ["Open pre-send configuration exceptions must be resolved."],
		});
		expect(result?.representationGate.confirmation).toMatchObject({
			decision: "block",
			reasonCodes: ["engagement_missing"],
		});
		expect(result?.envelope.attempts[0]?.recipients).toHaveLength(2);
		expect(result?.envelope.attempts[0]?.recipients[1]).toMatchObject({
			name: "Laura Lawyer",
			tokenAvailable: true,
		});
		expect(
			"embeddedSigningToken" in
				(result?.envelope.attempts[0]?.recipients[1] ?? {})
		).toBe(false);
		expect(result?.envelope.exceptions[0]).toMatchObject({
			kind: "pre_send_configuration_failure",
			status: "open",
		});
	});
});

describe("lawyer workspace mutations", () => {
	it("blocks admin LAWYER_VERIFIED transitions without lawyer verification evidence", async () => {
		const withoutEvidence = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.pending",
		});
		await expect(
			withoutEvidence.t
				.withIdentity(fairLendAdminIdentity("admin-auth"))
				.mutation(api.deals.mutations.transitionDeal, {
					entityId: withoutEvidence.dealId,
					eventType: "LAWYER_VERIFIED",
				})
		).rejects.toThrow(MISSING_VERIFICATION_ERROR);
	});

	it("enforces engagement evidence on admin REPRESENTATION_CONFIRMED transitions", async () => {
		const withoutEngagement = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.verified",
			includeVerificationEvidence: true,
		});
		await expect(
			withoutEngagement.t
				.withIdentity(fairLendAdminIdentity("admin-auth"))
				.mutation(api.deals.mutations.transitionDeal, {
					entityId: withoutEngagement.dealId,
					eventType: "REPRESENTATION_CONFIRMED",
				})
		).rejects.toThrow(MISSING_ENGAGEMENT_ERROR);

		const withEngagement = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.verified",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});
		const result = await withEngagement.t
			.withIdentity(fairLendAdminIdentity("admin-auth"))
			.mutation(api.deals.mutations.transitionDeal, {
				entityId: withEngagement.dealId,
				eventType: "REPRESENTATION_CONFIRMED",
			});

		expect(result).toMatchObject({
			newState: "documentReview.pending",
			previousState: "lawyerOnboarding.verified",
			success: true,
		});
	});

	it("confirms representation through the transition engine", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.verified",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.mutation(api.deals.lawyerMutations.confirmRepresentation, { dealId });

		expect(result).toMatchObject({
			newState: "documentReview.pending",
			previousState: "lawyerOnboarding.verified",
			success: true,
		});
		const deal = await t.run((ctx) => ctx.db.get(dealId));
		expect(deal?.status).toBe("documentReview.pending");
	});

	it("recovers a pending legal representation state when lawyer gates are already satisfied", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.pending",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});

		vi.useFakeTimers();
		try {
			const result = await t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.progressLegalRepresentation, {
					dealId,
				});
			await t.finishAllScheduledFunctions(() => vi.runAllTimers());
			expect(result).toMatchObject({
				success: true,
				transitions: [
					{
						eventType: "LAWYER_VERIFIED",
						newState: "lawyerOnboarding.verified",
						previousState: "lawyerOnboarding.pending",
					},
					{
						eventType: "REPRESENTATION_CONFIRMED",
						newState: "documentReview.pending",
						previousState: "lawyerOnboarding.verified",
					},
				],
			});
		} finally {
			vi.useRealTimers();
		}

		const deal = await t.run((ctx) => ctx.db.get(dealId));
		expect(deal?.status).toBe("documentReview.pending");
	});

	it("allows FairLend admins to recover satisfied legal representation gates", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.pending",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});

		vi.useFakeTimers();
		try {
			const result = await t
				.withIdentity(fairLendAdminIdentity("admin-auth"))
				.mutation(api.deals.lawyerMutations.progressLegalRepresentation, {
					dealId,
				});
			await t.finishAllScheduledFunctions(() => vi.runAllTimers());
			expect(result).toMatchObject({
				dealStatus: "documentReview.pending",
				success: true,
			});
		} finally {
			vi.useRealTimers();
		}

		const deal = await t.run((ctx) => ctx.db.get(dealId));
		expect(deal?.status).toBe("documentReview.pending");
	});

	it("rejects representation confirmation without active lawyer access or the expected state", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			accessStatus: "revoked",
			dealStatus: "lawyerOnboarding.verified",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});

		await expect(
			t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.confirmRepresentation, { dealId })
		).rejects.toThrow(NO_ACTIVE_LAWYER_ACCESS_ERROR);

		const active = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
			includeRepresentationEngagement: true,
			includeVerificationEvidence: true,
		});
		await expect(
			active.t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.confirmRepresentation, {
					dealId: active.dealId,
				})
		).rejects.toThrow(INVALID_STATE_ERROR);
	});

	it("rejects representation confirmation without signed engagement evidence", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "lawyerOnboarding.verified",
			includeVerificationEvidence: true,
		});

		await expect(
			t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.confirmRepresentation, { dealId })
		).rejects.toThrow(MISSING_ENGAGEMENT_ERROR);
	});

	it("approves ready document packages through the transition engine", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
			instanceStatus: "available",
		});

		const result = await t
			.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
			.mutation(api.deals.lawyerMutations.approveDocuments, { dealId });

		expect(result).toMatchObject({
			newState: "documentReview.signed",
			previousState: "documentReview.pending",
			success: true,
		});
		const deal = await t.run((ctx) => ctx.db.get(dealId));
		expect(deal?.status).toBe("documentReview.signed");
	});

	it("lets any active deal participant skip document signing when no document instances exist", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
			includeDocumentInstance: false,
		});

		vi.useFakeTimers();
		try {
			const result = await t
				.withIdentity(memberIdentity("buyer-auth"))
				.mutation(api.deals.portalMutations.skipEmptyDocumentSigning, {
					dealId,
				});
			await t.finishAllScheduledFunctions(() => vi.runAllTimers());

			expect(result.transitions).toEqual([
				expect.objectContaining({
					newState: "documentReview.signed",
					previousState: "documentReview.pending",
					success: true,
				}),
				expect.objectContaining({
					newState: "fundsTransfer.pending",
					previousState: "documentReview.signed",
					success: true,
				}),
			]);
		} finally {
			vi.useRealTimers();
		}
		const deal = await t.run((ctx) => ctx.db.get(dealId));
		expect(deal?.status).toBe("fundsTransfer.pending");
	});

	it("blocks empty document signing skip when any document instance exists", async () => {
		const { dealId, t } = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
		});

		await expect(
			t
				.withIdentity(memberIdentity("buyer-auth"))
				.mutation(api.deals.portalMutations.skipEmptyDocumentSigning, {
					dealId,
				})
		).rejects.toThrow(EMPTY_DOCUMENT_SKIP_BLOCKED_ERROR);
	});

	it("blocks document approval when package prerequisites are incomplete", async () => {
		const missingReadyPackage = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
			instanceStatus: "available",
			packageStatus: "pending",
		});
		await expect(
			missingReadyPackage.t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.approveDocuments, {
					dealId: missingReadyPackage.dealId,
				})
		).rejects.toThrow(PACKAGE_APPROVAL_BLOCKED_ERROR);

		const pendingRecipients = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
		});
		await expect(
			pendingRecipients.t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.approveDocuments, {
					dealId: pendingRecipients.dealId,
				})
		).rejects.toThrow(PACKAGE_APPROVAL_BLOCKED_ERROR);

		const openPreSendException = await seedLawyerWorkspaceFixture({
			dealStatus: "documentReview.pending",
			includeEnvelope: true,
		});
		await expect(
			openPreSendException.t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.approveDocuments, {
					dealId: openPreSendException.dealId,
				})
		).rejects.toThrow(PACKAGE_APPROVAL_BLOCKED_ERROR);

		const pendingSigningState = await seedLawyerWorkspaceFixture({
			attemptStatus: "pending_recipient_resolution",
			dealStatus: "documentReview.pending",
			includeEnvelope: true,
			includePreSendException: false,
			instanceStatus: "available",
		});
		await expect(
			pendingSigningState.t
				.withIdentity(lawyerIdentity("lawyer-auth", "lawyer@test.fairlend.ca"))
				.mutation(api.deals.lawyerMutations.approveDocuments, {
					dealId: pendingSigningState.dealId,
				})
		).rejects.toThrow(PACKAGE_APPROVAL_BLOCKED_ERROR);
	});
});
