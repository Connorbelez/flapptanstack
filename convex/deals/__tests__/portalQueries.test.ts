import { anyApi } from "convex/server";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../../_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../constants";
import schema from "../../schema";
import { convexModules } from "../../test/moduleMaps";

const portalQueriesApi = anyApi.deals.portalQueries;

const NOW = 1_800_000_000_000;
const LENDER_AUTH_ID = "lender-auth";
const SELLER_AUTH_ID = "seller-auth";
const BROKER_AUTH_ID = "broker-auth";
const ADMIN_AUTH_ID = "admin-auth";
const FORBIDDEN_DEAL_ACCESS_ERROR = /Forbidden: no deal access/;

function identity(args: {
	authId: string;
	email: string;
	orgId?: string;
	permissions?: string[];
	role?: string;
	roles?: string[];
}) {
	const role = args.role ?? "member";
	const roles = args.roles ?? [role];
	return {
		subject: args.authId,
		issuer: "https://api.workos.com",
		org_id: args.orgId ?? `org_${args.authId}`,
		role,
		roles: JSON.stringify(roles),
		permissions: JSON.stringify(args.permissions ?? ["deal:view"]),
		user_email: args.email,
		user_email_verified: true,
		user_first_name: args.authId.split("-")[0],
		user_last_name: "Portal",
	};
}

const LENDER_IDENTITY = identity({
	authId: LENDER_AUTH_ID,
	email: "lender@example.test",
	role: "lender",
	roles: ["lender"],
});
const SELLER_IDENTITY = identity({
	authId: SELLER_AUTH_ID,
	email: "seller@example.test",
	role: "borrower",
	roles: ["borrower"],
});
const BROKER_IDENTITY = identity({
	authId: BROKER_AUTH_ID,
	email: "broker@example.test",
	role: "broker",
	roles: ["broker"],
});
const ADMIN_IDENTITY = identity({
	authId: ADMIN_AUTH_ID,
	email: "admin@fairlend.ca",
	orgId: FAIRLEND_STAFF_ORG_ID,
	permissions: ["admin:access", "deal:view"],
	role: "admin",
	roles: ["admin"],
});
const UNAUTHORIZED_IDENTITY = identity({
	authId: "outsider-auth",
	email: "outsider@example.test",
});

function createHarness() {
	return convexTest(schema, convexModules);
}

function guestLawyerSnapshot(email = "guest-lawyer@example.test") {
	return {
		type: "guest_lawyer" as const,
		source: "manual" as const,
		name: "Grace Guestlaw",
		email,
		firm: "Guestlaw LLP",
	};
}

async function seedPortalDeal(
	t: ReturnType<typeof createHarness>,
	args?: {
		dealStatus?: string;
		closingTeamAccessUserId?: string;
		lawyerAuthId?: string;
		lawyerEmail?: string;
		lawyerAccessUserId?: string;
		lawyerOnboardingSessionStatus?: Doc<"lawyerOnboardingSessions">["status"];
		missingPaymentProofAsset?: boolean;
		withPaymentProof?: boolean;
		withRepresentationInvitation?: boolean;
	}
) {
	return await t.run(async (ctx) => {
		const [lenderUserId, sellerUserId, brokerUserId] = await Promise.all([
			ctx.db.insert("users", {
				authId: LENDER_AUTH_ID,
				email: "lender@example.test",
				firstName: "Lena",
				lastName: "Lender",
			}),
			ctx.db.insert("users", {
				authId: SELLER_AUTH_ID,
				email: "seller@example.test",
				firstName: "Sasha",
				lastName: "Seller",
			}),
			ctx.db.insert("users", {
				authId: BROKER_AUTH_ID,
				email: "broker@example.test",
				firstName: "Bryn",
				lastName: "Broker",
			}),
		]);
		const brokerId = await ctx.db.insert("brokers", {
			createdAt: NOW,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			brokerId,
			createdAt: NOW,
			onboardingEntryPath: "portal-query-test",
			status: "active",
			userId: lenderUserId,
		});
		await ctx.db.insert("borrowers", {
			createdAt: NOW,
			status: "active",
			userId: sellerUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: NOW,
			postalCode: "M5V 1A1",
			propertyType: "residential",
			province: "ON",
			streetAddress: "100 Portal St",
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			assignedBrokerId: brokerId,
			brokerOfRecordId: brokerId,
			createdAt: NOW,
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
		if (args?.closingTeamAccessUserId) {
			await ctx.db.insert("closingTeamAssignments", {
				assignedAt: NOW,
				assignedBy: ADMIN_AUTH_ID,
				mortgageId,
				role: "closing_lawyer",
				userId: args.closingTeamAccessUserId,
			});
		}
		const lawyerEmail = args?.lawyerEmail ?? "guest-lawyer@example.test";
		const lawyerAuthId = args?.lawyerAuthId;
		if (lawyerAuthId) {
			await ctx.db.insert("users", {
				authId: lawyerAuthId,
				email: lawyerEmail,
				firstName: "Grace",
				lastName: "Guestlaw",
			});
		}
		const dealId = await ctx.db.insert("deals", {
			buyerId: LENDER_AUTH_ID,
			closingDate: NOW + 86_400_000,
			createdAt: NOW,
			createdBy: ADMIN_AUTH_ID,
			fractionalShare: 2500,
			lawyerId: lawyerAuthId,
			lawyerType: "guest_lawyer",
			lenderId,
			mortgageId,
			purchasingLenderAuthId: LENDER_AUTH_ID,
			selectedLawyer: guestLawyerSnapshot(lawyerEmail),
			sellerId: SELLER_AUTH_ID,
			sellingLenderAuthId: SELLER_AUTH_ID,
			status: args?.dealStatus ?? "lawyerOnboarding.pending",
		});
		const accessRows: Array<{
			role:
				| "assigned_broker"
				| "borrower"
				| "broker_of_record"
				| "guest_lawyer"
				| "lender";
			userId: string;
		}> = [
			{ role: "lender", userId: LENDER_AUTH_ID },
			{ role: "lender", userId: SELLER_AUTH_ID },
			{ role: "broker_of_record", userId: BROKER_AUTH_ID },
		];
		if (args?.lawyerAccessUserId) {
			accessRows.push({
				role: "guest_lawyer",
				userId: args.lawyerAccessUserId,
			});
		}
		for (const row of accessRows) {
			await ctx.db.insert("dealAccess", {
				dealId,
				grantedAt: NOW,
				grantedBy: ADMIN_AUTH_ID,
				role: row.role,
				status: "active",
				userId: row.userId,
			});
		}
		if (args?.withRepresentationInvitation) {
			await ctx.db.insert("lawyerInvitations", {
				createdAt: NOW,
				createdBy: ADMIN_AUTH_ID,
				dealId,
				expiresAt: Date.now() + 86_400_000,
				normalizedTargetEmail: lawyerEmail.toLowerCase(),
				selectedLawyerSnapshot: guestLawyerSnapshot(lawyerEmail),
				status: "pending",
				targetEmail: lawyerEmail,
				tokenHash: `token:${dealId}`,
				updatedAt: NOW,
			});
		}
		if (args?.lawyerOnboardingSessionStatus) {
			await ctx.db.insert("lawyerOnboardingSessions", {
				createdAt: NOW,
				currentStep:
					args.lawyerOnboardingSessionStatus === "complete"
						? "complete"
						: "auth",
				dealId,
				nextRoute: "/lawyer/onboarding/test",
				normalizedTargetEmail: lawyerEmail.toLowerCase(),
				path: "guest_invited",
				returnPath: `/deals/${String(dealId)}`,
				status: args.lawyerOnboardingSessionStatus,
				updatedAt: NOW,
			});
			if (args.lawyerOnboardingSessionStatus === "complete") {
				await ctx.db.insert("lawyerVerifications", {
					authId: args.closingTeamAccessUserId,
					checkType: "idv",
					createdAt: NOW,
					createdBy: "test",
					dealId,
					expiresAt: NOW + 86_400_000,
					normalizedEmail: lawyerEmail.toLowerCase(),
					outcome: "eligible",
					provider: "manual_admin",
					reasonCodes: ["identity_confirmed"],
					sourceSnapshot: {
						source: "test",
					},
				});
				await ctx.db.insert("representationEngagements", {
					createdAt: NOW,
					dealId,
					evidenceHash: "sha256:test-engagement",
					lawyerAuthId: args.closingTeamAccessUserId ?? "lawyer-auth",
					provider: "manual_admin",
					signedAt: NOW,
					status: "signed",
					updatedAt: NOW,
				});
			}
		}
		if (args?.withPaymentProof) {
			const fileRef = await (
				ctx.storage as unknown as { store: (blob: Blob) => Promise<string> }
			).store(new Blob(["wire proof"], { type: "application/pdf" }));
			const assetId = await ctx.db.insert("documentAssets", {
				description: "Wire proof",
				fileHash: "wire-proof-hash",
				fileRef: fileRef as Id<"_storage">,
				fileSize: 10,
				mimeType: "application/pdf",
				name: "wire-proof.pdf",
				originalFilename: "wire-proof.pdf",
				pageCount: 1,
				source: "payment_proof_upload",
				uploadedAt: NOW,
				uploadedByUserId: lenderUserId,
			});
			await ctx.db.insert("dealPaymentProofs", {
				amount: 125_000,
				attachmentIds: [assetId],
				createdAt: NOW + 1,
				currency: "CAD",
				dealId,
				institutionName: "Test Bank",
				note: "Wire receipt",
				referenceNumber: "WIRE-123",
				reviewReason: "Matches expected funds transfer.",
				reviewedAt: NOW + 2,
				reviewedBy: ADMIN_AUTH_ID,
				sendingParty: "Lena Lender",
				status: "approved",
				submittedBy: LENDER_AUTH_ID,
				submittedByPersona: "purchasing_lender",
				submittedByRole: "purchasing_lender",
				transferDate: NOW,
				updatedAt: NOW + 2,
			});
			if (args.missingPaymentProofAsset) {
				await ctx.db.delete(assetId);
			}
		}
		return { dealId };
	});
}

async function getWorkspace(
	t: ReturnType<typeof createHarness>,
	viewer: ReturnType<typeof identity>,
	dealId: Id<"deals">
) {
	return await t
		.withIdentity(viewer)
		.query(portalQueriesApi.getDealPortalWorkspace, { dealId });
}

type PortalWorkspace = NonNullable<Awaited<ReturnType<typeof getWorkspace>>>;

function expectOnboardingOnlyWorkspace(workspace: PortalWorkspace) {
	expect(workspace.accessDecision.allowed).toBe(false);
	expect(workspace.activeScreen).toBe("unavailable");
	expect(workspace.blockers).toEqual([]);
	expect(workspace.capabilities).toEqual([]);
	expect(workspace.documents).toMatchObject({
		instances: [],
		package: null,
		participants: null,
	});
	expect(workspace.participants.involvedParties).toEqual([]);
	expect(workspace.payment).toEqual({
		adminReview: null,
		hasApprovedProof: false,
		hasPendingProof: false,
		proofs: [],
	});
}

describe("deal portal shared projection", () => {
	it("projects lender representation screen and invite capabilities without payment review", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t, {
			withRepresentationInvitation: true,
		});

		const result = await getWorkspace(t, LENDER_IDENTITY, dealId);

		expect(result).toMatchObject({
			activeScreen: "representation",
			deal: { dealValue: 125_000 },
			viewer: { persona: "purchasing_lender" },
		});
		expect(result.capabilities).toContain("representation.invitation.resend");
		expect(result.capabilities).toContain("representation.lawyer.replace");
		expect(result.capabilities).not.toContain("payment.proof.review");
		expect(result.payment.adminReview).toBeNull();
	});

	it("treats guest lawyer email deal access as onboarding-required until completion", async () => {
		const t = createHarness();
		const guestEmail = "guest-lawyer@example.test";
		const { dealId } = await seedPortalDeal(t, {
			lawyerAccessUserId: guestEmail,
			lawyerEmail: guestEmail,
		});

		const result = await getWorkspace(
			t,
			identity({
				authId: "workos-guest-lawyer-auth",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(result.viewer).toMatchObject({
			authId: "workos-guest-lawyer-auth",
			persona: "primary_lawyer",
			readiness: "invited",
		});
		expect(result.capabilities).toEqual([]);
		expect(result.onboarding.required).toBe(true);
		expectOnboardingOnlyWorkspace(result);
	});

	it("resolves selected lawyer persona from completed onboarding session", async () => {
		const t = createHarness();
		const guestEmail = "completed-guest-lawyer@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: "workos-completed-guest-lawyer-auth",
			lawyerEmail: guestEmail,
			lawyerOnboardingSessionStatus: "complete",
		});

		const result = await getWorkspace(
			t,
			identity({
				authId: "workos-completed-guest-lawyer-auth",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(result.viewer).toMatchObject({
			authId: "workos-completed-guest-lawyer-auth",
			persona: "primary_lawyer",
			readiness: "active",
		});
		expect(result.onboarding.required).toBe(false);
	});

	it("uses the latest onboarding session when older complete and newer pending sessions both match", async () => {
		const t = createHarness();
		const guestEmail = "stale-complete-guest-lawyer@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: "workos-stale-complete-guest-lawyer-auth",
			lawyerEmail: guestEmail,
			lawyerOnboardingSessionStatus: "complete",
		});
		const pendingSessionId = await t.run((ctx) =>
			ctx.db.insert("lawyerOnboardingSessions", {
				createdAt: NOW + 1,
				currentStep: "auth",
				dealId,
				nextRoute: "/lawyer/onboarding/latest",
				normalizedTargetEmail: guestEmail,
				path: "guest_invited",
				returnPath: `/deals/${String(dealId)}`,
				status: "auth_pending",
				updatedAt: NOW + 1,
			})
		);

		const result = await getWorkspace(
			t,
			identity({
				authId: "workos-stale-complete-guest-lawyer-auth",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(result.viewer.persona).toBe("primary_lawyer");
		expect(result.viewer.readiness).toBe("onboarding_in_progress");
		expect(result.onboarding).toMatchObject({
			nextRoute: "/lawyer/onboarding/latest",
			required: true,
			sessionId: pendingSessionId,
		});
		expectOnboardingOnlyWorkspace(result);
	});

	it("downgrades selected-lawyer email match until onboarding is complete", async () => {
		const t = createHarness();
		const guestEmail = "guest@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: "user_guest",
			lawyerEmail: guestEmail,
			lawyerOnboardingSessionStatus: "auth_pending",
		});

		const workspace = await getWorkspace(
			t,
			identity({
				authId: "user_guest",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(workspace.viewer.persona).toBe("primary_lawyer");
		expect(workspace.viewer.readiness).toBe("onboarding_in_progress");
		expect(workspace.capabilities).toEqual([]);
		expect(workspace.capabilities).not.toContain("representation.confirm");
		expect(workspace.onboarding.sessionId).toBeTruthy();
		expect(workspace.onboarding).toMatchObject({
			nextRoute: "/lawyer/onboarding/test",
			required: true,
		});
		expectOnboardingOnlyWorkspace(workspace);
	});

	it("does not expose payment upload blockers for onboarding-required selected lawyers", async () => {
		const t = createHarness();
		const guestEmail = "funds-pending-guest@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: "user_funds_pending_guest",
			dealStatus: "fundsTransfer.pending",
			lawyerEmail: guestEmail,
			lawyerOnboardingSessionStatus: "auth_pending",
		});

		const workspace = await getWorkspace(
			t,
			identity({
				authId: "user_funds_pending_guest",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(workspace.viewer.persona).toBe("primary_lawyer");
		expect(workspace.viewer.readiness).toBe("onboarding_in_progress");
		expect(workspace.capabilities).toEqual([]);
		expect(
			workspace.blockers.map((blocker) => blocker.recoverableAction)
		).not.toContain("payment.proof.upload");
		expectOnboardingOnlyWorkspace(workspace);
	});

	it("returns a bootstrap path for selected-lawyer email match without onboarding session", async () => {
		const t = createHarness();
		const guestEmail = "guest-without-session@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: "user_guest_without_session",
			lawyerEmail: guestEmail,
		});

		const workspace = await getWorkspace(
			t,
			identity({
				authId: "user_guest_without_session",
				email: guestEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(workspace.viewer.persona).toBe("primary_lawyer");
		expect(workspace.viewer.readiness).toBe("invited");
		expect(workspace.accessDecision).toMatchObject({
			allowed: false,
			persona: "primary_lawyer",
			readiness: "invited",
			redirectTo: `/lawyer/deals/${String(dealId)}`,
			scope: "none",
		});
		expect(workspace.capabilities).toEqual([]);
		expect(workspace.onboarding).toEqual({
			nextRoute: `/lawyer/deals/${String(dealId)}`,
			required: true,
			sessionId: null,
		});
		expectOnboardingOnlyWorkspace(workspace);
	});

	it("shows payment review attachment previews to admins and upload-capable deal personas", async () => {
		const t = createHarness();
		const lawyerAuthId = "lawyer-payment-auth";
		const lawyerEmail = "lawyer-payment@example.test";
		const { dealId } = await seedPortalDeal(t, {
			closingTeamAccessUserId: lawyerAuthId,
			dealStatus: "fundsTransfer.pending",
			lawyerAccessUserId: lawyerAuthId,
			lawyerEmail,
			lawyerOnboardingSessionStatus: "complete",
			withPaymentProof: true,
		});

		const adminResult = await getWorkspace(t, ADMIN_IDENTITY, dealId);
		const lenderResult = await getWorkspace(t, LENDER_IDENTITY, dealId);
		const lawyerResult = await getWorkspace(
			t,
			identity({
				authId: lawyerAuthId,
				email: lawyerEmail,
				role: "lawyer",
				roles: ["lawyer"],
			}),
			dealId
		);

		expect(adminResult.activeScreen).toBe("payment");
		expect(adminResult.capabilities).toContain("payment.proof.review");
		expect(adminResult.payment.proofs).toHaveLength(1);
		expect(adminResult.payment.adminReview).toEqual({
			proofs: [
				expect.objectContaining({
					attachments: [
						expect.objectContaining({
							assetId: expect.any(String),
							fileSize: 10,
							mimeType: "application/pdf",
							name: "wire-proof.pdf",
							originalFilename: "wire-proof.pdf",
							url: expect.any(String),
						}),
					],
					reviewReason: "Matches expected funds transfer.",
					reviewedBy: ADMIN_AUTH_ID,
					status: "approved",
				}),
			],
		});
		expect(lenderResult.viewer.persona).toBe("purchasing_lender");
		expect(lenderResult.payment.proofs).toHaveLength(1);
		expect(lenderResult.payment.adminReview).toEqual({
			proofs: [
				expect.objectContaining({
					attachments: [
						expect.objectContaining({
							mimeType: "application/pdf",
							name: "wire-proof.pdf",
							url: expect.any(String),
						}),
					],
					status: "approved",
				}),
			],
		});
		expect(lenderResult.capabilities).not.toContain("payment.proof.approve");
		expect(lenderResult.capabilities).not.toContain("payment.proof.reject");
		expect(lawyerResult.viewer.persona).toBe("primary_lawyer");
		expect(lawyerResult.payment.adminReview).toEqual({
			proofs: [
				expect.objectContaining({
					attachments: [
						expect.objectContaining({
							mimeType: "application/pdf",
							name: "wire-proof.pdf",
							url: expect.any(String),
						}),
					],
					status: "approved",
				}),
			],
		});
		expect(lawyerResult.capabilities).not.toContain("payment.proof.approve");
		expect(lawyerResult.capabilities).not.toContain("payment.proof.reject");
	});

	it("shows payment proof attachments to involved brokers without approval capabilities", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t, {
			dealStatus: "fundsTransfer.pending",
			withPaymentProof: true,
		});

		const brokerResult = await getWorkspace(t, BROKER_IDENTITY, dealId);

		expect(brokerResult.viewer.persona).toBe("broker_of_record");
		expect(brokerResult.capabilities).toContain("payment.proof.review");
		expect(brokerResult.capabilities).not.toContain("payment.proof.approve");
		expect(brokerResult.capabilities).not.toContain("payment.proof.reject");
		expect(brokerResult.payment.adminReview).toEqual({
			proofs: [
				expect.objectContaining({
					attachments: [
						expect.objectContaining({
							mimeType: "application/pdf",
							name: "wire-proof.pdf",
							url: expect.any(String),
						}),
					],
					status: "approved",
				}),
			],
		});
	});

	it("keeps review rows available when a payment proof attachment URL is unavailable", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t, {
			dealStatus: "fundsTransfer.pending",
			missingPaymentProofAsset: true,
			withPaymentProof: true,
		});

		const adminResult = await getWorkspace(t, ADMIN_IDENTITY, dealId);

		expect(adminResult.payment.adminReview).toEqual({
			proofs: [
				expect.objectContaining({
					attachments: [
						expect.objectContaining({
							assetId: expect.any(String),
							fileSize: null,
							mimeType: null,
							name: "Unavailable attachment",
							originalFilename: "Unavailable attachment",
							url: null,
						}),
					],
					status: "approved",
				}),
			],
		});
	});

	it("exposes empty document progression to involved active deal personas", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t, {
			dealStatus: "documentReview.pending",
		});

		const workspaces = await Promise.all([
			getWorkspace(t, LENDER_IDENTITY, dealId),
			getWorkspace(t, SELLER_IDENTITY, dealId),
			getWorkspace(t, BROKER_IDENTITY, dealId),
			getWorkspace(t, ADMIN_IDENTITY, dealId),
		]);

		for (const workspace of workspaces) {
			expect(workspace.activeScreen).toBe("documents");
			expect(workspace.documents.instances).toEqual([]);
			expect(workspace.capabilities).toContain("documents.skipEmpty");
		}
	});

	it("keeps broker and seller personas view-only for payment proof by default", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t, {
			dealStatus: "fundsTransfer.pending",
		});

		const brokerResult = await getWorkspace(t, BROKER_IDENTITY, dealId);
		const sellerResult = await getWorkspace(t, SELLER_IDENTITY, dealId);

		expect(brokerResult.viewer.persona).toBe("broker_of_record");
		expect(sellerResult.viewer.persona).toBe("selling_lender");
		for (const workspace of [brokerResult, sellerResult]) {
			expect(workspace.capabilities).not.toContain("payment.proof.upload");
			expect(workspace.capabilities).not.toContain("payment.proof.review");
			expect(workspace.capabilities).not.toContain("payment.proof.approve");
			expect(workspace.capabilities).not.toContain("payment.proof.reject");
		}
	});

	it("rejects an unauthorized viewer for an existing deal", async () => {
		const t = createHarness();
		const { dealId } = await seedPortalDeal(t);

		await expect(
			getWorkspace(t, UNAUTHORIZED_IDENTITY, dealId)
		).rejects.toThrow(FORBIDDEN_DEAL_ACCESS_ERROR);
	});
});
