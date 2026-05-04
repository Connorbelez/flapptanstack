import { afterEach, describe, expect, it, vi } from "vitest";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { api, internal } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { FAIRLEND_STAFF_ORG_ID } from "../../../../convex/constants";
import { CANONICAL_DOCUMENT_VARIABLES } from "../../../../convex/documentEngine/variableRegistry";
import { getSignatureProvider } from "../../../../convex/documents/signature/provider";
import {
	createMockViewer,
	createTestConvex,
	ensureSeededIdentity,
} from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

async function sha256Hex(bytes: Uint8Array) {
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function createPdfBytes(label: string) {
	const pdf = await PDFDocument.create();
	const page = pdf.addPage([612, 792]);
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	page.drawText(label, {
		x: 72,
		y: 700,
		size: 20,
		font,
		color: rgb(0, 0, 0),
	});
	return new Uint8Array(await pdf.save());
}

interface MockDocumensoOptions {
	envelopeStatus?: "COMPLETED" | "PENDING";
	failEnvelopeFetch?: boolean;
	failCertificateDownload?: boolean;
	failCreate?: boolean;
	failDelete?: boolean;
	failDistribute?: boolean;
	failSync?: boolean;
	failSignedDownload?: boolean;
	includeCompletionCertificate?: boolean;
	recipientEmail?: string;
	recipientName?: string;
	recipientSigningOrder?: number;
	recipientSigningStatus?: "SIGNED" | null;
	signingUrl?: string;
}

const originalFetch = globalThis.fetch;

function installMockDocumensoFetch(options?: MockDocumensoOptions) {
	const envelopeId = "doc_env_1";
	const envelopeItemId = "doc_item_1";
	const completionCertificateItemId = "doc_cert_1";
	const recipientId = "doc_rcpt_1";
	const signingUrl =
		options?.signingUrl ?? "https://documenso.test/sign/session_1";
	const recipientSigningStatus = options?.recipientSigningStatus ?? null;
	const envelopeStatus = options?.envelopeStatus ?? "PENDING";
	const signedPdfBytes = new TextEncoder().encode("signed pdf bytes");
	const completionCertificateBytes = new TextEncoder().encode(
		"completion certificate bytes"
	);
	const envelopeItems = [
		{
			id: envelopeItemId,
			name: "Borrower signature packet",
			type: "DOCUMENT",
		},
		...(options?.includeCompletionCertificate
			? [
					{
						id: completionCertificateItemId,
						name: "Completion Certificate",
						type: "CERTIFICATE",
					},
				]
			: []),
	];

	const recipientPayload = {
		email: options?.recipientEmail ?? "borrower.phase7@test.fairlend.ca",
		id: recipientId,
		name: options?.recipientName ?? "Ada Borrower",
		readStatus: recipientSigningStatus ? "OPENED" : null,
		role: "SIGNER",
		signedAt:
			recipientSigningStatus === "SIGNED"
				? "2026-05-15T16:00:00.000Z"
				: null,
		signingOrder: options?.recipientSigningOrder ?? 1,
		signingStatus: recipientSigningStatus,
		signingUrl,
		token: "token_1",
	};

	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const parsedUrl = new URL(url);
		const version = parsedUrl.searchParams.get("version");
		if (url.endsWith("/envelope/create")) {
			if (options?.failCreate) {
				return new Response(JSON.stringify({ error: "create failed" }), {
					status: 500,
				});
			}
			return new Response(JSON.stringify({ id: envelopeId }), { status: 200 });
		}
		if (url.endsWith(`/envelope/${envelopeId}`)) {
			if (options?.failSync || options?.failEnvelopeFetch) {
				return new Response(JSON.stringify({ error: "envelope fetch failed" }), {
					status: 500,
				});
			}
			return new Response(
				JSON.stringify({
					envelopeItems,
					id: envelopeId,
					recipients: [recipientPayload],
					status: envelopeStatus,
					updatedAt: "2026-05-15T16:00:00.000Z",
				}),
				{ status: 200 }
			);
		}
		if (
			parsedUrl.pathname.endsWith(`/envelope/item/${envelopeItemId}/download`) &&
			version === "signed"
		) {
			if (options?.failSignedDownload) {
				return new Response(JSON.stringify({ error: "signed download failed" }), {
					status: 500,
				});
			}
			return new Response(signedPdfBytes, {
				headers: { "Content-Type": "application/pdf" },
				status: 200,
			});
		}
		if (
			parsedUrl.pathname.endsWith(`/envelope/item/${completionCertificateItemId}/download`)
		) {
			if (options?.failCertificateDownload) {
				return new Response(
					JSON.stringify({ error: "certificate download failed" }),
					{
						status: 500,
					}
				);
			}
			return new Response(completionCertificateBytes, {
				headers: { "Content-Type": "application/pdf" },
				status: 200,
			});
		}
		if (
			parsedUrl.pathname.endsWith(`/envelope/item/${envelopeItemId}/download`) &&
			version === "certificate"
		) {
			if (!options?.includeCompletionCertificate) {
				return new Response(
					JSON.stringify({ error: "certificate not available" }),
					{ status: 404 }
				);
			}
			if (options?.failCertificateDownload) {
				return new Response(
					JSON.stringify({ error: "certificate download failed" }),
					{
						status: 500,
					}
				);
			}
			return new Response(completionCertificateBytes, {
				headers: { "Content-Type": "application/pdf" },
				status: 200,
			});
		}
		if (url.endsWith("/envelope/distribute")) {
			if (options?.failDistribute) {
				return new Response(JSON.stringify({ error: "distribution failed" }), {
					status: 500,
				});
			}
			return new Response(
				JSON.stringify({
					id: envelopeId,
					recipients: [recipientPayload],
					success: true,
				}),
				{ status: 200 }
			);
		}
		if (url.endsWith("/envelope/delete")) {
			if (options?.failDelete) {
				return new Response(JSON.stringify({ error: "delete failed" }), {
					status: 500,
				});
			}
			return new Response(JSON.stringify({ success: true }), { status: 200 });
		}
		if (url.endsWith(`/envelope/recipient/${recipientId}`)) {
			return new Response(JSON.stringify(recipientPayload), { status: 200 });
		}

		return new Response(
			JSON.stringify({
				init,
				url,
			}),
			{ status: 404 }
		);
	});

	globalThis.fetch = fetchMock as unknown as typeof fetch;
	process.env.DOCUMENSO_API_TOKEN = "documenso_test_token";

	return {
		completionCertificateItemId,
		envelopeId,
		envelopeItemId,
		fetchMock,
		recipientId,
		signingUrl,
	};
}

function buildArchiveEffectArgs(dealId: Id<"deals">) {
	return {
		effectName: "archiveSignedDocuments",
		entityId: dealId,
		entityType: "deal" as const,
		eventType: "ALL_PARTIES_SIGNED",
		journalEntryId: "journal_archive_signed_documents",
		source: {
			actorId: "test-admin",
			actorType: "admin" as const,
			channel: "admin_dashboard" as const,
		},
	};
}

async function seedDocumentAsset(
	t: ReturnType<typeof createTestConvex>,
	args: {
		contents: Uint8Array;
		description?: string;
		name: string;
	}
) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	return t.run(async (ctx) => {
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
			.unique();
		if (!adminUser) {
			throw new Error("Admin user not found");
		}

		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob([args.contents], { type: "application/pdf" }));

		return ctx.db.insert("documentAssets", {
			description: args.description ?? args.name,
			fileHash: await sha256Hex(args.contents),
			fileRef,
			fileSize: args.contents.byteLength,
			mimeType: "application/pdf",
			name: args.name,
			originalFilename: `${args.name.toLowerCase().replace(/\s+/g, "-")}.pdf`,
			pageCount: 1,
			source: "admin_upload",
			uploadedAt: Date.now(),
			uploadedByUserId: adminUser._id,
		});
	});
}

async function storePdfStorageId(
	t: ReturnType<typeof createTestConvex>,
	label: string
) {
	const bytes = await createPdfBytes(label);

	return t.run(async (ctx) => {
		return (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob([bytes], { type: "application/pdf" }));
	});
}

afterEach(() => {
	globalThis.fetch = originalFetch;
	delete process.env.DOCUMENSO_API_KEY;
	delete process.env.DOCUMENSO_API_TOKEN;
	delete process.env.DOCUMENSO_API_BASE_URL;
	delete process.env.DOCUMENSO_APP_BASE_URL;
	delete process.env.DOCUMENSO_TIMEOUT_MS;
});

async function seedPublishedTemplate(
	t: ReturnType<typeof createTestConvex>,
	args: {
		fields: PublishedTemplateField[];
		name: string;
		signatories?: Array<{
			order: number;
			platformRole: string;
			role: "approver" | "signatory" | "viewer";
		}>;
	}
) {
	const bytes = await createPdfBytes(args.name);
	const fileHash = await sha256Hex(bytes);

	return t.run(async (ctx) => {
		const fileRef = await (
			ctx.storage as unknown as {
				store: (blob: Blob) => Promise<Id<"_storage">>;
			}
		).store(new Blob([bytes], { type: "application/pdf" }));

		const basePdfId = await ctx.db.insert("documentBasePdfs", {
			fileHash,
			fileRef,
			fileSize: bytes.byteLength,
			name: `${args.name} Base`,
			pageCount: 1,
			pageDimensions: [{ height: 792, page: 0, width: 612 }],
			uploadedAt: Date.now(),
			uploadedBy: "test_admin",
		});
		const templateId = await ctx.db.insert("documentTemplates", {
			basePdfHash: fileHash,
			basePdfId,
			createdAt: Date.now(),
			currentPublishedVersion: 1,
			description: `${args.name} description`,
			draft: {
				fields: args.fields,
				pdfmeSchema: [],
				signatories: args.signatories ?? [],
			},
			hasDraftChanges: false,
			name: args.name,
			updatedAt: Date.now(),
		});
		await ctx.db.insert("documentTemplateVersions", {
			basePdfHash: fileHash,
			basePdfId,
			publishedAt: Date.now(),
			publishedBy: "test_admin",
			snapshot: {
				fields: args.fields,
				pdfmeSchema: [],
				signatories: args.signatories ?? [],
			},
			templateId,
			version: 1,
		});

		return templateId;
	});
}

async function seedSystemVariable(
	t: ReturnType<typeof createTestConvex>,
	key: string,
	label = key
) {
	return t.run(async (ctx) => {
		const existing = await ctx.db
			.query("systemVariables")
			.withIndex("by_key", (query) => query.eq("key", key))
			.unique();
		if (existing) {
			return existing._id;
		}

		return ctx.db.insert("systemVariables", {
			createdAt: Date.now(),
			key,
			label,
			type: "string",
		});
	});
}

type PublishedTemplateField = {
	fieldMeta?: {
		helpText?: string;
		placeholder?: string;
		readOnly?: boolean;
	};
	id: string;
	position: {
		height: number;
		page: number;
		width: number;
		x: number;
		y: number;
	};
	required?: boolean;
	signableType?: "SIGNATURE";
	signatoryPlatformRole?: string;
	type: "interpolable" | "signable";
	variableKey?: string;
};

function buildCanonicalInterpolableFields(): PublishedTemplateField[] {
	return CANONICAL_DOCUMENT_VARIABLES.map((variable, index) => ({
		id: `canonical_${variable.key}`,
		position: {
			height: 8,
			page: 0,
			width: 220,
			x: index < 20 ? 72 : 320,
			y: 72 + (index % 20) * 14,
		},
		type: "interpolable",
		variableKey: variable.key,
	}));
}

async function insertListing(
	t: ReturnType<typeof createTestConvex>,
	args: {
		mortgageId: Id<"mortgages">;
		propertyId: Id<"properties">;
		title: string;
	}
) {
	return t.run(async (ctx) => {
		return ctx.db.insert("listings", {
			adminNotes: undefined,
			approximateLatitude: undefined,
			approximateLongitude: undefined,
			borrowerSignal: { stale: true },
			city: "Toronto",
			createdAt: Date.now(),
			dataSource: "mortgage_pipeline",
			delistedAt: undefined,
			delistReason: undefined,
			description: "Deal listing projection",
			displayOrder: 0,
			featured: false,
			heroImages: [],
			interestRate: 9.5,
			lastTransitionAt: undefined,
			latestAppraisalDate: "2026-05-01",
			latestAppraisalValueAsIs: 425_000,
			lienPosition: 1,
			loanType: "conventional",
			ltvRatio: 58,
			machineContext: undefined,
			marketplaceCopy: "Marketplace copy",
			maturityDate: "2027-04-30",
			monthlyPayment: 2_450,
			mortgageId: args.mortgageId,
			paymentFrequency: "monthly",
			paymentHistory: { stale: true },
			principal: 250_000,
			propertyId: args.propertyId,
			propertyType: "residential",
			province: "ON",
			publicDocumentIds: [],
			publishedAt: undefined,
			rateType: "fixed",
			seoSlug: "deal-package-listing",
			status: "draft",
			termMonths: 12,
			title: args.title,
			updatedAt: Date.now(),
			viewCount: 0,
		});
	});
}

async function setDealStatus(
	t: ReturnType<typeof createTestConvex>,
	dealId: Id<"deals">,
	status: string
) {
	await t.run(async (ctx) => {
		await ctx.db.patch(dealId, { status });
	});
}

async function seedDealPackageFixture(
	t: ReturnType<typeof createTestConvex>,
	args?: {
		includeFullVariableData?: boolean;
		includeListing?: boolean;
		omitSignableSignatories?: boolean;
		requireLawyerSignatory?: boolean;
		signableFieldPlatformRole?: string;
		signablePlatformRole?: string;
		templatedVariableKey?: string;
	}
) {
	await ensureSeededIdentity(t, FAIRLEND_ADMIN);

	const lenderIdentity = createMockViewer({
		email: "lender.phase7@test.fairlend.ca",
		firstName: "Lena",
		lastName: "Lender",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["lender"],
		subject: "user_phase7_lender",
	});
	const sellerIdentity = createMockViewer({
		email: "seller.phase7@test.fairlend.ca",
		firstName: "Sam",
		lastName: "Seller",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["member"],
		subject: "user_phase7_seller",
	});
	const brokerIdentity = createMockViewer({
		email: "broker.phase7@test.fairlend.ca",
		firstName: "Brooke",
		lastName: "Broker",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["broker"],
		subject: "user_phase7_broker",
	});
	const borrowerIdentity = createMockViewer({
		email: "borrower.phase7@test.fairlend.ca",
		firstName: "Ada",
		lastName: "Borrower",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["member"],
		subject: "user_phase7_borrower",
	});
	const lawyerIdentity = createMockViewer({
		email: "lawyer.phase7@test.fairlend.ca",
		firstName: "Layla",
		lastName: "Lawyer",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["member"],
		subject: "user_phase7_lawyer",
	});
	const coBorrowerOneIdentity = createMockViewer({
		email: "co1.phase7@test.fairlend.ca",
		firstName: "Cora",
		lastName: "Coborrower",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["member"],
		subject: "user_phase7_coborrower_1",
	});
	const coBorrowerTwoIdentity = createMockViewer({
		email: "co2.phase7@test.fairlend.ca",
		firstName: "Chris",
		lastName: "Coborrower",
		orgId: FAIRLEND_STAFF_ORG_ID,
		orgName: "FairLend Staff",
		roles: ["member"],
		subject: "user_phase7_coborrower_2",
	});

	const [
		lenderUserId,
		sellerUserId,
		brokerUserId,
		borrowerUserId,
		coBorrowerOneUserId,
		coBorrowerTwoUserId,
	] =
		await Promise.all([
			ensureSeededIdentity(t, lenderIdentity),
			ensureSeededIdentity(t, sellerIdentity),
			ensureSeededIdentity(t, brokerIdentity),
			ensureSeededIdentity(t, borrowerIdentity),
			ensureSeededIdentity(t, coBorrowerOneIdentity),
			ensureSeededIdentity(t, coBorrowerTwoIdentity),
		]);
	await ensureSeededIdentity(t, lawyerIdentity);

	await seedSystemVariable(
		t,
		args?.templatedVariableKey ?? "borrower_primary_full_name",
		"Borrower primary full name"
	);

	const staticAssetId = await seedDocumentAsset(t, {
		contents: await createPdfBytes("Private static package doc"),
		name: "Private Static Package Doc",
	});
	const nonSignableTemplateId = await seedPublishedTemplate(t, {
		fields: args?.includeFullVariableData
			? buildCanonicalInterpolableFields()
			: [
					{
						id: "field_non_signable_1",
						position: { height: 18, page: 0, width: 220, x: 72, y: 120 },
						type: "interpolable",
						variableKey:
							args?.templatedVariableKey ?? "borrower_primary_full_name",
					},
				],
		name: "Mortgage Counsel Memo",
		signatories: args?.requireLawyerSignatory
			? [
					{
						order: 0,
						platformRole: "lawyer_primary",
						role: "viewer",
					},
				]
			: [],
	});
	const signableTemplateId = await seedPublishedTemplate(t, {
		fields: [
			{
				id: "field_signable_1",
				position: { height: 18, page: 0, width: 180, x: 72, y: 180 },
				required: true,
				fieldMeta: {
					placeholder: "Sign here",
				},
				signableType: "SIGNATURE",
				signatoryPlatformRole:
					args?.signableFieldPlatformRole ??
					args?.signablePlatformRole ??
					"borrower_primary",
				type: "signable",
			},
		],
		name: "Borrower Signature Packet",
		signatories: args?.omitSignableSignatories
			? []
			: [
					{
						order: 0,
						platformRole: args?.signablePlatformRole ?? "borrower_primary",
						role: "signatory",
					},
				],
	});

	return t.run(async (ctx) => {
		const adminUser = await ctx.db
			.query("users")
			.withIndex("authId", (query) => query.eq("authId", FAIRLEND_ADMIN.subject))
			.unique();
		if (!adminUser) {
			throw new Error("Admin user not found");
		}

		const brokerId = await ctx.db.insert("brokers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: brokerUserId,
		});
		const lenderId = await ctx.db.insert("lenders", {
			accreditationStatus: "accredited",
			activatedAt: Date.now(),
			brokerId,
			createdAt: Date.now(),
			onboardingEntryPath: "admin_direct",
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: lenderUserId,
		});
		const borrowerId = await ctx.db.insert("borrowers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: borrowerUserId,
		});
		const coBorrowerOneId = await ctx.db.insert("borrowers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: coBorrowerOneUserId,
		});
		const coBorrowerTwoId = await ctx.db.insert("borrowers", {
			createdAt: Date.now(),
			lastTransitionAt: Date.now(),
			onboardedAt: Date.now(),
			orgId: FAIRLEND_STAFF_ORG_ID,
			status: "active",
			userId: coBorrowerTwoUserId,
		});
		const propertyId = await ctx.db.insert("properties", {
			city: "Toronto",
			createdAt: Date.now(),
			postalCode: "M5H 1J9",
			propertyType: "residential",
			province: "ON",
			streetAddress: "123 King St W",
			unit: args?.includeFullVariableData ? "Suite 1201" : undefined,
		});
		const mortgageId = await ctx.db.insert("mortgages", {
			amortizationMonths: 300,
			assignedBrokerId: args?.includeFullVariableData ? brokerId : undefined,
			brokerOfRecordId: brokerId,
			collectionExecutionMode: "app_owned",
			collectionExecutionUpdatedAt: Date.now(),
			createdAt: Date.now(),
			creationSource: "admin_origination",
			firstPaymentDate: "2026-06-01",
			interestAdjustmentDate: "2026-05-01",
			interestRate: 9.5,
			lienPosition: 1,
			loanType: "conventional",
			machineContext: { lastPaymentAt: 0, missedPayments: 0 },
			maturityDate: "2027-04-30",
			orgId: FAIRLEND_STAFF_ORG_ID,
			originationPath: "admin_direct",
			originatedByUserId: FAIRLEND_ADMIN.subject,
			originatingWorkflowId: "origination_case_phase7",
			originatingWorkflowType: "admin_origination_case",
			paymentAmount: 2_450,
			paymentBootstrapScheduleRuleMissing: false,
			paymentFrequency: "monthly",
			principal: 250_000,
			propertyId,
			rateType: "fixed",
			status: "active",
			termMonths: 12,
			termStartDate: "2026-05-01",
			workflowSourceKey: "origination_case_phase7",
		});
		await ctx.db.insert("mortgageValuationSnapshots", {
			createdAt: Date.now(),
			createdByUserId: adminUser._id,
			mortgageId,
			relatedDocumentAssetId: undefined,
			source: "admin_origination",
			valuationDate: "2026-05-01",
			valueAsIs: 425_000,
		});
		await ctx.db.insert("mortgageBorrowers", {
			addedAt: Date.now(),
			borrowerId,
			mortgageId,
			role: "primary",
		});
		if (args?.includeFullVariableData) {
			await ctx.db.insert("mortgageBorrowers", {
				addedAt: Date.now(),
				borrowerId: coBorrowerOneId,
				mortgageId,
				role: "co_borrower",
			});
			await ctx.db.insert("mortgageBorrowers", {
				addedAt: Date.now(),
				borrowerId: coBorrowerTwoId,
				mortgageId,
				role: "co_borrower",
			});
		}
		const dealId = await ctx.db.insert("deals", {
			buyerId: lenderIdentity.subject,
			closingDate: new Date("2026-05-15T12:00:00.000Z").getTime(),
			createdAt: Date.now(),
			createdBy: FAIRLEND_ADMIN.subject,
			fractionalShare: 2_500,
			lawyerId: args?.includeFullVariableData
				? lawyerIdentity.subject
				: undefined,
			lawyerType: args?.requireLawyerSignatory ? "platform_lawyer" : undefined,
			lockingFeeAmount: 7_500,
			lenderId,
			mortgageId,
			orgId: FAIRLEND_STAFF_ORG_ID,
			sellerId: sellerIdentity.subject,
			status: "initiated",
		});

		if (args?.includeListing) {
			await ctx.db.insert("listings", {
				adminNotes: undefined,
				approximateLatitude: undefined,
				approximateLongitude: undefined,
				borrowerSignal: { stale: true },
				city: "Toronto",
				createdAt: Date.now(),
				dataSource: "mortgage_pipeline",
				delistedAt: undefined,
				delistReason: undefined,
				description: "Deal listing projection",
				displayOrder: 0,
				featured: false,
				heroImages: [],
				interestRate: 9.5,
				lastTransitionAt: undefined,
				latestAppraisalDate: "2026-05-01",
				latestAppraisalValueAsIs: 425_000,
				lienPosition: 1,
				loanType: "conventional",
				ltvRatio: 58,
				machineContext: undefined,
				marketplaceCopy: "Marketplace copy",
				marketplacePropertyType: "Condo",
				maturityDate: "2027-04-30",
				monthlyPayment: 2_450,
				mortgageId,
				paymentFrequency: "monthly",
				paymentHistory: { stale: true },
				principal: 250_000,
				propertyId,
				propertyType: "residential",
				province: "ON",
				publicDocumentIds: [],
				publishedAt: undefined,
				rateType: "fixed",
				seoSlug: "deal-package-listing",
				status: "draft",
				termMonths: 12,
				title: "King West bridge opportunity",
				updatedAt: Date.now(),
				viewCount: 0,
			});
		}

		await ctx.db.insert("mortgageDocumentBlueprints", {
			archivedAt: undefined,
			archivedByUserId: undefined,
			assetId: staticAssetId,
			category: "private",
			class: "private_static",
			createdAt: Date.now(),
			createdByUserId: adminUser._id,
			description: "Private static package document",
			displayName: "Private static memo",
			displayOrder: 0,
			mortgageId,
			packageKey: "closing",
			packageLabel: "Closing package",
			sourceDraftId: undefined,
			sourceKind: "asset",
			status: "active",
			templateId: undefined,
			templateSnapshotMeta: undefined,
			templateVersion: undefined,
		});
		await ctx.db.insert("mortgageDocumentBlueprints", {
			archivedAt: undefined,
			archivedByUserId: undefined,
			assetId: undefined,
			category: "private",
			class: "private_templated_non_signable",
			createdAt: Date.now(),
			createdByUserId: adminUser._id,
			description: "Generated counsel memo",
			displayName: "Counsel memo",
			displayOrder: 1,
			mortgageId,
			packageKey: "closing",
			packageLabel: "Closing package",
			sourceDraftId: undefined,
			sourceKind: "template_version",
			status: "active",
			templateId: nonSignableTemplateId,
			templateSnapshotMeta: undefined,
			templateVersion: 1,
		});
		await ctx.db.insert("mortgageDocumentBlueprints", {
			archivedAt: undefined,
			archivedByUserId: undefined,
			assetId: undefined,
			category: "private",
			class: "private_templated_signable",
			createdAt: Date.now(),
			createdByUserId: adminUser._id,
			description: "Signature packet placeholder",
			displayName: "Borrower signature packet",
			displayOrder: 2,
			mortgageId,
			packageKey: "closing",
			packageLabel: "Closing package",
			sourceDraftId: undefined,
			sourceKind: "template_version",
			status: "active",
			templateId: signableTemplateId,
			templateSnapshotMeta: undefined,
			templateVersion: 1,
		});

		return {
			brokerIdentity,
			borrowerId,
			borrowerUserId,
			borrowerIdentity,
			dealId,
			lenderIdentity,
			lenderUserId,
			lawyerIdentity,
			mortgageId,
			propertyId,
		};
	});
}

async function seedFailedCounselMemoPackage() {
	installMockDocumensoFetch();
	const t = createTestConvex({ includeWorkflowComponents: true });
	const fixture = await seedDealPackageFixture(t, {
		includeListing: true,
		templatedVariableKey: "unmapped_deal_variable",
	});
	await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
		dealId: fixture.dealId,
		retry: false,
	});
	const failedInstance = await t.run(async (ctx) => {
		const row = await ctx.db
			.query("dealDocumentInstances")
			.withIndex("by_deal", (query) => query.eq("dealId", fixture.dealId))
			.collect()
			.then((rows) =>
				rows.find(
					(instance) =>
						instance.status === "generation_failed" &&
						instance.sourceBlueprintSnapshot.displayName === "Counsel memo"
				)
			);
		if (!row) {
			throw new Error("Expected failed Counsel memo instance");
		}
		return row;
	});

	return { failedInstance, fixture, t };
}

describe("documents/dealPackages", () => {
	it("materializes every canonical system variable when a locked deal package is generated", async () => {
		const { fetchMock } = installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeFullVariableData: true,
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "mortgage_principal",
		});

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const variables = await t.query(
			internal.documents.dealPackages.resolveDealDocumentVariablesInternal,
			{
				dealId: fixture.dealId,
			}
		);
		const generatedDocuments = await t.run((ctx) =>
			ctx.db.query("generatedDocuments").collect()
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);
		const staticInstances = await t.run((ctx) =>
			ctx.db
				.query("dealDocumentInstances")
				.filter((query) => query.eq(query.field("kind"), "static_reference"))
				.collect()
		);

		expect(staticInstances).toHaveLength(1);
		expect(generatedDocuments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Counsel memo",
					signingStatus: "not_applicable",
				}),
				expect.objectContaining({
					name: "Borrower signature packet",
					signingStatus: "draft",
				}),
			])
		);
		expect(signatureEnvelopes).toHaveLength(0);
		expect(fetchMock).not.toHaveBeenCalledWith(
			expect.stringContaining("/envelope/create"),
			expect.anything()
		);
		expect(variables).toMatchObject({
			assigned_broker_email: "broker.phase7@test.fairlend.ca",
			assigned_broker_full_name: "Brooke Broker",
			borrower_co_1_email: "co1.phase7@test.fairlend.ca",
			borrower_co_1_full_name: "Cora Coborrower",
			borrower_co_2_email: "co2.phase7@test.fairlend.ca",
			borrower_co_2_full_name: "Chris Coborrower",
			borrower_primary_email: "seller.phase7@test.fairlend.ca",
			borrower_primary_full_name: "Sam Seller",
			broker_of_record_email: "broker.phase7@test.fairlend.ca",
			broker_of_record_full_name: "Brooke Broker",
			deal_investment_amount: "62500",
			deal_selected_fraction_units: "2500",
			lawyer_primary_email: "lawyer.phase7@test.fairlend.ca",
			lawyer_primary_full_name: "Layla Lawyer",
			listing_description: "Deal listing projection",
			listing_marketplace_copy: "Marketplace copy",
			listing_title: "King West bridge opportunity",
			lender_primary_email: "lender.phase7@test.fairlend.ca",
			lender_primary_full_name: "Lena Lender",
			lender_primary_system_id: String(fixture.lenderUserId),
			mortgage_amortization_months: "300",
			mortgage_amount: "250000",
			mortgage_first_payment_date: "2026-06-01",
			mortgage_interest_rate: "9.5",
			mortgage_lien_position: "1",
			mortgage_maturity_date: "2027-04-30",
			mortgage_payment_amount: "2450",
			mortgage_payment_frequency: "monthly",
			mortgage_principal: "250000",
			mortgage_rate_type: "fixed",
			mortgage_term_months: "12",
			mortgage_term_start_date: "2026-05-01",
			property_city: "Toronto",
			property_postal_code: "M5H 1J9",
			property_province: "ON",
			property_street_address: "123 King St W",
			property_type: "residential",
			property_unit: "Suite 1201",
			valuation_date: "2026-05-01",
			valuation_value_as_is: "425000",
		});
		for (const { key } of CANONICAL_DOCUMENT_VARIABLES) {
			expect(variables[key], key).toBeTruthy();
		}
	});

	it("upgrades locked signable review documents into signing envelopes after approval retry", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const retryResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: true,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const allInstances = await t.run((ctx) =>
			ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_deal", (query) => query.eq("dealId", fixture.dealId))
				.collect()
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(retryResult.status).toBe("ready");
		expect(signatureEnvelopes).toEqual([
			expect.objectContaining({
				dealId: fixture.dealId,
				providerCode: "documenso",
				status: "sent",
			}),
		]);
		expect(packageSurface.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Borrower signature packet",
					signing: expect.objectContaining({
						recipients: expect.arrayContaining([
							expect.objectContaining({
								email: "seller.phase7@test.fairlend.ca",
								status: "pending",
							}),
						]),
						status: "sent",
					}),
					status: "signature_sent",
				}),
			])
		);
		expect(
			allInstances.filter(
				(instance) =>
					instance.sourceBlueprintSnapshot.displayName ===
						"Borrower signature packet" &&
					instance.status === "archived"
			)
		).toHaveLength(1);
	});

	it("keeps onboarding signable packages as generated previews without provider side effects", async () => {
		for (const dealStatus of [
			"lawyerOnboarding.pending",
			"lawyerOnboarding.verified",
		]) {
			const { fetchMock } = installMockDocumensoFetch();
			const t = createTestConvex({ includeWorkflowComponents: false });
			const fixture = await seedDealPackageFixture(t, {
				includeListing: true,
				templatedVariableKey: "borrower_primary_full_name",
			});
			await setDealStatus(t, fixture.dealId, dealStatus);

			const result = await t.action(
				internal.documents.dealPackages.runCreateDocumentPackageInternal,
				{
					dealId: fixture.dealId,
					retry: false,
				}
			);
			const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
				api.documents.dealPackages.getPortalDocumentPackage,
				{
					dealId: fixture.dealId,
				}
			);
			const generatedDocuments = await t.run((ctx) =>
				ctx.db.query("generatedDocuments").collect()
			);
			const signatureEnvelopes = await t.run((ctx) =>
				ctx.db.query("signatureEnvelopes").collect()
			);
			const dealEnvelopeAttempts = await t.run((ctx) =>
				ctx.db.query("dealEnvelopeAttempts").collect()
			);
			const signableInstance = packageSurface.instances.find(
				(instance) => instance.class === "private_templated_signable"
			);

			expect(result.status).toBe("ready");
			expect(signableInstance).toMatchObject({
				displayName: "Borrower signature packet",
				generatedDocumentId: expect.any(String),
				status: "available",
			});
			expect(generatedDocuments).toEqual(
				expect.arrayContaining([
					expect.objectContaining({
						name: "Borrower signature packet",
						signingStatus: "draft",
					}),
				])
			);
			expect(signatureEnvelopes).toHaveLength(0);
			expect(dealEnvelopeAttempts).toHaveLength(0);
			expect(fetchMock).not.toHaveBeenCalled();
		}
	});

	it("materializes immutable deal packages from active private mortgage blueprints", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const dealDetail = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.deals.queries.getPortalDealDetail,
			{
				dealId: fixture.dealId,
			}
		);
		const variables = await t.query(
			internal.documents.dealPackages.resolveDealDocumentVariablesInternal,
			{
				dealId: fixture.dealId,
			}
		);
		const signatories = await t.query(
			internal.documents.dealPackages.resolveDealDocumentSignatoriesInternal,
			{
				dealId: fixture.dealId,
			}
		);
		const generatedDocuments = await t.run((ctx) =>
			ctx.db.query("generatedDocuments").collect()
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);
		const signatureRecipients = await t.run((ctx) =>
			ctx.db.query("signatureRecipients").collect()
		);

		expect(result.status).toBe("ready");
		expect(packageSurface.package).toMatchObject({
			dealId: fixture.dealId,
			mortgageId: fixture.mortgageId,
			retryCount: 0,
			status: "ready",
		});
		expect(packageSurface.instances).toHaveLength(3);
		expect(packageSurface.participants?.fractionalShareDisplayPercent).toBe(25);
		expect(packageSurface.participants?.buyer.authId).toBe(
			fixture.lenderIdentity.subject
		);
		expect(variables).toMatchObject({
			borrower_primary_email: "seller.phase7@test.fairlend.ca",
			borrower_primary_full_name: "Sam Seller",
			lender_primary_email: "lender.phase7@test.fairlend.ca",
			lender_primary_full_name: "Lena Lender",
		});
		expect(signatories).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					email: "lender.phase7@test.fairlend.ca",
					name: "Lena Lender",
					platformRole: "lender_primary",
				}),
				expect.objectContaining({
					email: "seller.phase7@test.fairlend.ca",
					name: "Sam Seller",
					platformRole: "borrower_primary",
				}),
			])
		);
		expect(
			packageSurface.instances.map((instance) => instance.displayName)
		).toEqual([
			"Private static memo",
			"Counsel memo",
			"Borrower signature packet",
		]);
		expect(packageSurface.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Private static memo",
					kind: "static_reference",
					status: "available",
					url: expect.any(String),
				}),
				expect.objectContaining({
					displayName: "Counsel memo",
					generatedDocumentId: expect.any(String),
					kind: "generated",
					status: "available",
					url: expect.any(String),
				}),
				expect.objectContaining({
					displayName: "Borrower signature packet",
					generatedDocumentId: expect.any(String),
					kind: "generated",
					signing: expect.objectContaining({
						generatedDocumentSigningStatus: "sent",
						status: "sent",
					}),
					status: "signature_sent",
					url: null,
				}),
			])
		);
		expect(generatedDocuments).toHaveLength(2);
		expect(generatedDocuments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: String(fixture.dealId),
					entityType: "deal",
					name: "Counsel memo",
					signingStatus: "not_applicable",
				}),
				expect.objectContaining({
					documensoEnvelopeId: "doc_env_1",
					entityId: String(fixture.dealId),
					entityType: "deal",
					name: "Borrower signature packet",
					signingStatus: "sent",
				}),
			])
		);
		expect(signatureEnvelopes).toEqual([
			expect.objectContaining({
				dealId: fixture.dealId,
				providerCode: "documenso",
				providerEnvelopeId: "doc_env_1",
				status: "sent",
			}),
		]);
		expect(signatureRecipients).toEqual([
			expect.objectContaining({
				email: "seller.phase7@test.fairlend.ca",
				name: "Sam Seller",
				platformRole: "borrower_primary",
				status: "pending",
			}),
		]);
		expect(dealDetail.documentPackage?.status).toBe("ready");
		expect(dealDetail.deal.fractionalShareUnits).toBe(2500);
		expect(dealDetail.deal.fractionalShareDisplayPercent).toBe(25);
		expect(dealDetail.participants.fractionalShareStatus.isValid).toBe(true);
		expect(dealDetail.participants.lawyer).toMatchObject({
			authId: null,
			hasActiveDealAccess: false,
			lawyerType: null,
		});
		expect(
			dealDetail.documentInstances.filter(
				(instance) =>
					instance.status === "available" ||
					instance.status === "signature_sent"
			)
		).toHaveLength(3);
	});

	it("archives failed instances and creates successor rows on retry", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: false,
			requireLawyerSignatory: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const firstResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageAfterFirstRun = await t.withIdentity(
			FAIRLEND_ADMIN
		).query(api.documents.dealPackages.getPortalDocumentPackage, {
			dealId: fixture.dealId,
		});

		expect(firstResult.status).toBe("partial_failure");
		expect(packageAfterFirstRun.package).toMatchObject({
			retryCount: 0,
			status: "partial_failure",
		});
		expect(packageAfterFirstRun.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Private static memo",
					status: "available",
					url: expect.any(String),
				}),
			])
		);

		await t.run(async (ctx) => {
			await ctx.db.insert("closingTeamAssignments", {
				assignedAt: Date.now(),
				assignedBy: FAIRLEND_ADMIN.subject,
				mortgageId: fixture.mortgageId,
				role: "closing_lawyer",
				userId: fixture.lawyerIdentity.subject,
			});
		});

		const retryResult = await t.withIdentity(FAIRLEND_ADMIN).action(
			api.documents.dealPackages.retryPackageGeneration,
			{
				dealId: fixture.dealId,
			}
		);
		const packageAfterRetry = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const allInstances = await t.run((ctx) =>
			ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_deal", (query) => query.eq("dealId", fixture.dealId))
				.collect()
		);
		const retrySignatories = await t.query(
			internal.documents.dealPackages.resolveDealDocumentSignatoriesInternal,
			{
				dealId: fixture.dealId,
			}
		);

		expect(retryResult.status).toBe("ready");
		expect(packageAfterRetry.package).toMatchObject({
			retryCount: 1,
			status: "ready",
		});
		expect(
			packageAfterRetry.instances.filter(
				(instance) =>
					instance.displayName === "Counsel memo" &&
					instance.status === "available"
			)
		).toHaveLength(1);
		expect(
			allInstances.filter(
				(instance) =>
					instance.sourceBlueprintSnapshot.displayName === "Counsel memo" &&
					instance.status === "archived" &&
					instance.archivedAt
			)
		).toHaveLength(1);
		expect(retrySignatories).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					email: "lawyer.phase7@test.fairlend.ca",
					name: "Layla Lawyer",
					platformRole: "lawyer_primary",
				}),
			])
		);
	});

	it("replays missing package members from the frozen blueprint snapshot without adopting later blueprint changes", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const frozenBlueprints = await t.query(
			internal.documents.dealPackages.listActivePackageBlueprintInputsInternal,
			{
				mortgageId: fixture.mortgageId,
			}
		);

		await t.run(async (ctx) => {
			const packageId = await ctx.db.insert("dealDocumentPackages", {
				archivedAt: undefined,
				blueprintSnapshots: frozenBlueprints.map((blueprint) => ({
					assetId: blueprint.assetId,
					sourceBlueprintId: blueprint._id,
					sourceBlueprintSnapshot: {
						category: blueprint.category,
						class: blueprint.class,
						description: blueprint.description,
						displayName: blueprint.displayName,
						displayOrder: blueprint.displayOrder,
						packageKey: blueprint.packageKey,
						packageLabel: blueprint.packageLabel,
						templateId: blueprint.templateId,
						templateVersion: blueprint.templateVersion,
					},
				})),
				createdAt: Date.now(),
				dealId: fixture.dealId,
				lastError: undefined,
				mortgageId: fixture.mortgageId,
				readyAt: undefined,
				retryCount: 0,
				status: "pending",
				updatedAt: Date.now(),
			});

			const staticBlueprint = frozenBlueprints.find(
				(blueprint) => blueprint.class === "private_static"
			);
			if (!staticBlueprint?.assetId) {
				throw new Error("Expected a frozen private static blueprint");
			}

			await ctx.db.insert("dealDocumentInstances", {
				archivedAt: undefined,
				assetId: staticBlueprint.assetId,
				createdAt: Date.now(),
				dealId: fixture.dealId,
				generatedDocumentId: undefined,
				kind: "static_reference",
				lastError: undefined,
				mortgageId: fixture.mortgageId,
				packageId,
				sourceBlueprintId: staticBlueprint._id,
				sourceBlueprintSnapshot: {
					category: staticBlueprint.category,
					class: staticBlueprint.class,
					description: staticBlueprint.description,
					displayName: staticBlueprint.displayName,
					displayOrder: staticBlueprint.displayOrder,
					packageKey: staticBlueprint.packageKey,
					packageLabel: staticBlueprint.packageLabel,
					templateId: staticBlueprint.templateId,
					templateVersion: staticBlueprint.templateVersion,
				},
				status: "available",
				updatedAt: Date.now(),
			});

			await ctx.db.insert("mortgageDocumentBlueprints", {
				archivedAt: undefined,
				archivedByUserId: undefined,
				assetId: staticBlueprint.assetId,
				category: "private",
				class: "private_static",
				createdAt: Date.now(),
				createdByUserId: frozenBlueprints[0]!.createdByUserId,
				description: "Late-added blueprint should not join the frozen package",
				displayName: "Late addendum",
				displayOrder: 99,
				mortgageId: fixture.mortgageId,
				packageKey: "closing",
				packageLabel: "Closing package",
				sourceDraftId: undefined,
				sourceKind: "asset",
				status: "active",
				templateId: undefined,
				templateSnapshotMeta: undefined,
				templateVersion: undefined,
			});
		});

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);

		expect(result.status).toBe("ready");
		expect(packageSurface.package).toMatchObject({
			retryCount: 1,
			status: "ready",
		});
		expect(
			packageSurface.instances.map((instance) => instance.displayName)
		).toEqual([
			"Private static memo",
			"Counsel memo",
			"Borrower signature packet",
		]);
		expect(
			packageSurface.instances.some(
				(instance) => instance.displayName === "Late addendum"
			)
		).toBe(false);
	});

	it("maps legacy FairLend broker signatory roles to deal broker data", async () => {
		installMockDocumensoFetch({
			recipientEmail: "broker.phase7@test.fairlend.ca",
			recipientName: "Brooke Broker",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signableFieldPlatformRole: "broker_of_record",
			signablePlatformRole: "fairlend_broker",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);

		expect(result.status).toBe("ready");
		expect(packageSurface.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Borrower signature packet",
					signing: expect.objectContaining({
						recipients: [
							expect.objectContaining({
								email: "broker.phase7@test.fairlend.ca",
								name: "Brooke Broker",
								platformRole: "fairlend_broker",
							}),
						],
					}),
					status: "signature_sent",
				}),
			])
		);
	});

	it("keeps signable documents pending when recipient resolution is incomplete", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lawyer_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(result.status).toBe("partial_failure");
		expect(packageSurface.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Borrower signature packet",
					lastError: expect.stringContaining("lawyer_primary"),
					status: "signature_pending_recipient_resolution",
				}),
			])
		);
		expect(signatureEnvelopes).toHaveLength(0);
	});

	it("treats signable templates without Documenso recipients as deterministic configuration failures", async () => {
		const { fetchMock } = installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			omitSignableSignatories: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = packageSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		const generatedDocuments = await t.run((ctx) =>
			ctx.db.query("generatedDocuments").collect()
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(result.status).toBe("partial_failure");
		expect(signableInstance).toMatchObject({
			generatedDocumentId: expect.any(String),
			lastError: expect.stringContaining("no Documenso recipients"),
			status: "signature_pending_recipient_resolution",
		});
		expect(generatedDocuments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "Borrower signature packet",
					signingStatus: "draft",
				}),
			])
		);
		expect(signatureEnvelopes).toHaveLength(0);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("records provider failures when Documenso envelope creation fails", async () => {
		installMockDocumensoFetch({ failCreate: true });
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = packageSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		const generatedDocuments = await t.run((ctx) =>
			ctx.db.query("generatedDocuments").collect()
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(result.status).toBe("partial_failure");
		expect(signableInstance).toMatchObject({
			lastError: expect.stringContaining("/envelope/create"),
			status: "generation_failed",
		});
		expect(generatedDocuments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					signingStatus: "provider_error",
				}),
			])
		);
		expect(signatureEnvelopes).toHaveLength(0);
	});

	it("sends Documenso the expected payload shape for signable package documents", async () => {
		const { fetchMock } = installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const createCall = fetchMock.mock.calls.find(([input]) =>
			String(input).endsWith("/envelope/create")
		);
		expect(createCall).toBeDefined();
		const [, init] = createCall ?? [];
		expect(init?.method).toBe("POST");
		expect(init?.body).toBeInstanceOf(FormData);
		const formData = init?.body as FormData;
		const payload = JSON.parse(String(formData.get("payload"))) as {
			recipients: Array<{
				fields: Array<Record<string, unknown>>;
			}>;
		};
		expect(payload.recipients[0]?.fields.length).toBeGreaterThan(0);
		expect(payload.recipients[0]?.fields[0]).toMatchObject({
			type: "SIGNATURE",
			fieldMeta: {
				placeholder: "Sign here",
				required: true,
				type: "signature",
			},
			page: expect.any(Number),
			positionX: expect.any(Number),
			positionY: expect.any(Number),
			width: expect.any(Number),
			height: expect.any(Number),
			required: true,
		});
		expect(payload).toMatchObject({
			type: "DOCUMENT",
			title: "Borrower signature packet",
			externalId: expect.any(String),
			recipients: [
				expect.objectContaining({
					email: "lender.phase7@test.fairlend.ca",
					name: "Lena Lender",
					role: "SIGNER",
					signingOrder: 1,
				}),
			],
		});
		expect(formData.get("files")).toBeInstanceOf(Blob);
	});

	it("stores provider recipient ids when Documenso echoes a zero-based signing order", async () => {
		installMockDocumensoFetch({
			recipientEmail: "seller.phase7@test.fairlend.ca",
			recipientName: "Sam Seller",
			recipientSigningOrder: 0,
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);

		expect(packageSurface.instances).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					displayName: "Borrower signature packet",
					signing: expect.objectContaining({
						recipients: [
							expect.objectContaining({
								email: "seller.phase7@test.fairlend.ca",
								providerRecipientId: "doc_rcpt_1",
							}),
						],
					}),
					status: "signature_sent",
				}),
			])
		);
	});

	it("rejects Documenso signer recipients without a signature field before creating an envelope", async () => {
		const { fetchMock } = installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signableFieldPlatformRole: "borrower_primary",
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const packageSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = packageSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);
		const signingExceptions = await t.run((ctx) =>
			ctx.db.query("dealSigningExceptions").collect()
		);

		expect(result.status).toBe("partial_failure");
		expect(signableInstance).toMatchObject({
			lastError: expect.stringContaining("Documenso provider preflight"),
			status: "generation_failed",
		});
		expect(signatureEnvelopes).toHaveLength(0);
		expect(signingExceptions).toEqual([
			expect.objectContaining({
				dealId: fixture.dealId,
				kind: "pre_send_configuration_failure",
				message: "Documenso provider preflight or create failed.",
				severity: "blocking",
				status: "open",
				details: expect.objectContaining({
					provider: "documenso",
					error: expect.stringContaining(
						"DOCUMENSO_PROVIDER_PREFLIGHT_FAILED"
					),
				}),
			}),
		]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("resolves stale pre-send exceptions after a successful signing retry", async () => {
		const { fetchMock } = installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signableFieldPlatformRole: "borrower_primary",
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const firstResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const [openException] = await t.run((ctx) =>
			ctx.db
				.query("dealSigningExceptions")
				.withIndex("by_deal", (query) =>
					query.eq("dealId", fixture.dealId).eq("status", "open")
				)
				.collect()
		);

		expect(firstResult.status).toBe("partial_failure");
		expect(openException).toMatchObject({
			kind: "pre_send_configuration_failure",
			status: "open",
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await t.run(async (ctx) => {
			const template = await ctx.db
				.query("documentTemplates")
				.withIndex("by_name", (query) =>
					query.eq("name", "Borrower Signature Packet")
				)
				.unique();
			if (!template) {
				throw new Error("Expected signable template");
			}
			const version = await ctx.db
				.query("documentTemplateVersions")
				.withIndex("by_template", (query) =>
					query.eq("templateId", template._id).eq("version", 1)
				)
				.unique();
			if (!version) {
				throw new Error("Expected signable template version");
			}
			const fixedSnapshot = {
				...version.snapshot,
				fields: version.snapshot.fields.map((field) =>
					field.type === "signable"
						? {
								...field,
								signatoryPlatformRole: "lender_primary",
							}
						: field
				),
			};
			await ctx.db.patch(version._id, { snapshot: fixedSnapshot });
			await ctx.db.patch(template._id, { draft: fixedSnapshot });
		});

		const retryResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: true,
			}
		);
		const resolvedExceptions = await t.run((ctx) =>
			ctx.db
				.query("dealSigningExceptions")
				.withIndex("by_deal", (query) =>
					query.eq("dealId", fixture.dealId).eq("status", "resolved")
				)
				.collect()
		);
		const envelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(retryResult.status).toBe("ready");
		expect(resolvedExceptions).toEqual([
			expect.objectContaining({
				_id: openException?._id,
				kind: "pre_send_configuration_failure",
				resolvedBy: "system:document-package-signing-ready",
				status: "resolved",
			}),
		]);
		expect(envelopes).toEqual([
			expect.objectContaining({
				dealId: fixture.dealId,
				status: "sent",
			}),
		]);
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/envelope/create"),
			expect.anything()
		);
	});

	it("records interpolation inputs and maps the lender signer to the canonical user", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeFullVariableData: true,
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const variables = await t.query(
			internal.documents.dealPackages.resolveDealDocumentVariablesInternal,
			{ dealId: fixture.dealId }
		);
		const recipients = await t.run((ctx) =>
			ctx.db.query("signatureRecipients").collect()
		);

		expect(variables).toMatchObject({
			borrower_primary_full_name: "Sam Seller",
			lender_primary_email: "lender.phase7@test.fairlend.ca",
			lender_primary_full_name: "Lena Lender",
			lender_primary_system_id: String(fixture.lenderUserId),
		});
		expect(recipients).toEqual([
			expect.objectContaining({
				email: "lender.phase7@test.fairlend.ca",
				name: "Lena Lender",
				platformRole: "lender_primary",
				userId: fixture.lenderUserId,
			}),
		]);
	});

	it("retries distribution on the existing envelope instead of creating a new one", async () => {
		const initialDocumenso = installMockDocumensoFetch({ failDistribute: true });
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const initialResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const initialSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const initialSignable = initialSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!initialSignable?.generatedDocumentId) {
			throw new Error("Expected a signable package instance");
		}

		const initialEnvelope = await t.run((ctx) =>
			ctx.db
				.query("signatureEnvelopes")
				.withIndex("by_generated_document", (query) =>
					query.eq("generatedDocumentId", initialSignable.generatedDocumentId!)
				)
				.unique()
		);
		if (!initialEnvelope) {
			throw new Error("Expected a signature envelope after initial create");
		}

		expect(initialResult.status).toBe("partial_failure");
		expect(initialSignable).toMatchObject({
			lastError: expect.stringMatching(
				/\/envelope\/distribute[\s\S]*distribution failed/
			),
			status: "signature_draft",
		});

		const retriedDocumenso = installMockDocumensoFetch();
		const retryResult = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: true,
			}
		);
		const retriedSurface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const retriedSignable = retriedSurface.instances.find(
			(instance) => instance.instanceId === initialSignable.instanceId
		);
		const retriedEnvelope = await t.run((ctx) =>
			ctx.db
				.query("signatureEnvelopes")
				.withIndex("by_generated_document", (query) =>
					query.eq("generatedDocumentId", initialSignable.generatedDocumentId!)
				)
				.unique()
		);

		expect(retryResult.status).toBe("ready");
		expect(retriedSignable).toMatchObject({
			generatedDocumentId: initialSignable.generatedDocumentId,
			instanceId: initialSignable.instanceId,
			lastError: null,
			status: "signature_sent",
			signing: expect.objectContaining({
				lastError: null,
				status: "sent",
			}),
		});
		expect(retriedEnvelope?._id).toBe(initialEnvelope._id);
		expect(
			retriedDocumenso.fetchMock.mock.calls.filter(([input]) =>
				String(input).endsWith("/envelope/create")
			)
		).toHaveLength(0);
		expect(
			retriedDocumenso.fetchMock.mock.calls.filter(([input]) =>
				String(input).endsWith("/envelope/distribute")
			)
		).toHaveLength(1);
		expect(
			initialDocumenso.fetchMock.mock.calls.filter(([input]) =>
				String(input).endsWith("/envelope/create")
			)
		).toHaveLength(1);
	});

	it("accepts DOCUMENSO_API_KEY as a fallback credential name", async () => {
		const { fetchMock } = installMockDocumensoFetch();
		delete process.env.DOCUMENSO_API_TOKEN;
		process.env.DOCUMENSO_API_KEY = "documenso_test_key";

		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		const result = await t.action(
			internal.documents.dealPackages.runCreateDocumentPackageInternal,
			{
				dealId: fixture.dealId,
				retry: false,
			}
		);
		const signatureEnvelopes = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);

		expect(result.status).toBe("ready");
		expect(signatureEnvelopes).toHaveLength(1);
		expect(fetchMock).toHaveBeenCalled();
	});

	it("exposes Documenso envelope deletion for cleanup paths", async () => {
		const { envelopeId, fetchMock } = installMockDocumensoFetch();
		const provider = getSignatureProvider("documenso", {
			fetchFn: fetch,
			getStorageBlob: async () => null,
		});

		await provider.deleteEnvelope({
			providerEnvelopeId: envelopeId,
		});

		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("/envelope/delete"),
			expect.objectContaining({
				body: JSON.stringify({ envelopeId }),
				method: "POST",
			})
		);
	});

	it("issues embedded signing sessions only to canonical recipients and syncs envelope completion", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		await setDealStatus(t, fixture.dealId, "documentReview.signed");
		const packageSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = packageSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!signableInstance) {
			throw new Error("Expected a signable package instance");
		}
		expect(signableInstance.signing).toMatchObject({
			canLaunchEmbeddedSigning: true,
			status: "sent",
		});
		expect(signableInstance.url).toBeNull();

		const session = await t.withIdentity(fixture.lenderIdentity).action(
			api.documents.signature.sessions.createEmbeddedSigningSession,
			{
				dealId: fixture.dealId,
				instanceId: signableInstance.instanceId,
			}
		);

		expect(session).toMatchObject({
			expiresAt: expect.any(Number),
			url: "https://documenso.test/sign/session_1",
		});
		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.documents.signature.sessions.createEmbeddedSigningSession,
				{
					dealId: fixture.dealId,
					instanceId: signableInstance.instanceId,
				}
			)
		).rejects.toThrow(/no embedded signing recipient/i);

		installMockDocumensoFetch({
			envelopeStatus: "COMPLETED",
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
			recipientSigningStatus: "SIGNED",
		});
		await t.withIdentity(fixture.lenderIdentity).action(
			api.documents.signature.webhooks.syncSignableDocumentEnvelope,
			{
				dealId: fixture.dealId,
				instanceId: signableInstance.instanceId,
			}
		);

		const refreshedSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const refreshedSignable = refreshedSurface.instances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);
		const generatedDocuments = await t.run((ctx) =>
			ctx.db.query("generatedDocuments").collect()
		);

		expect(refreshedSignable).toMatchObject({
			status: "signed",
			signing: expect.objectContaining({
				generatedDocumentSigningStatus: "completed",
				status: "completed",
			}),
		});
		expect(generatedDocuments).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					signingStatus: "completed",
				}),
			])
		);
	});

	it("blocks embedded signing while the deal is locked for lawyer onboarding", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		await setDealStatus(t, fixture.dealId, "lawyerOnboarding.verified");

		const packageSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = packageSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!signableInstance) {
			throw new Error("Expected a signable package instance");
		}

		expect(signableInstance.signing).toMatchObject({
			canLaunchEmbeddedSigning: false,
			status: "sent",
		});
		await expect(
			t.withIdentity(fixture.lenderIdentity).action(
				api.documents.signature.sessions.createEmbeddedSigningSession,
				{
					dealId: fixture.dealId,
					instanceId: signableInstance.instanceId,
				}
			)
		).rejects.toThrow(/lawyer representation is confirmed/i);
	});

	it("hides embedded signing until lower signing orders are completed", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const [signatureEnvelope] = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);
		if (!signatureEnvelope) {
			throw new Error("Expected a signature envelope");
		}

		const [lenderRecipient] = await t.run((ctx) =>
			ctx.db.query("signatureRecipients").collect()
		);
		if (!lenderRecipient) {
			throw new Error("Expected a signature recipient");
		}

		await t.run(async (ctx) => {
			await ctx.db.patch(lenderRecipient._id, {
				signingOrder: 1,
			});
			await ctx.db.insert("signatureRecipients", {
				createdAt: Date.now(),
				declinedAt: undefined,
				email: fixture.borrowerIdentity.user_email,
				envelopeId: signatureEnvelope._id,
				name: `${fixture.borrowerIdentity.user_first_name} ${fixture.borrowerIdentity.user_last_name}`,
				openedAt: undefined,
				platformRole: "borrower_primary",
				providerRecipientId: "doc_rcpt_blocker",
				providerRole: "SIGNER",
				signedAt: undefined,
				signingOrder: 0,
				status: "pending",
				updatedAt: Date.now(),
				userId: fixture.borrowerUserId,
			});
		});

		const blockedSurface = await t
			.withIdentity(fixture.lenderIdentity)
			.query(api.documents.dealPackages.getPortalDocumentPackage, {
				dealId: fixture.dealId,
			});
		const blockedInstance = blockedSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);

		expect(blockedInstance?.signing).toMatchObject({
			canLaunchEmbeddedSigning: false,
		});

		await t.run(async (ctx) => {
			const blocker = await ctx.db
				.query("signatureRecipients")
				.withIndex("by_envelope", (query) =>
					query.eq("envelopeId", signatureEnvelope._id)
				)
				.filter((query) => query.eq(query.field("platformRole"), "borrower_primary"))
				.first();
			if (!blocker) {
				throw new Error("Expected a lower-order blocker recipient");
			}
			await ctx.db.patch(blocker._id, {
				signedAt: Date.now(),
				status: "signed",
			});
		});

		const unblockedSurface = await t
			.withIdentity(fixture.lenderIdentity)
			.query(api.documents.dealPackages.getPortalDocumentPackage, {
				dealId: fixture.dealId,
			});
		const unblockedInstance = unblockedSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);

		expect(unblockedInstance?.signing).toMatchObject({
			canLaunchEmbeddedSigning: true,
		});
	});

	it("preserves stored signing artifacts when patching signing state without new storage ids", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");
		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const generatedDocument = await t.run(async (ctx) => {
			return ctx.db
				.query("generatedDocuments")
				.filter((query) =>
					query.eq(query.field("documensoEnvelopeId"), "doc_env_1")
				)
				.first();
		});
		if (!generatedDocument) {
			throw new Error("Expected a signable generated document");
		}

		const completionCertificateStorageId = await storePdfStorageId(
			t,
			"Completion certificate"
		);
		const finalPdfStorageId = await storePdfStorageId(t, "Signed final PDF");

		await t.run(async (ctx) => {
			await ctx.db.patch(generatedDocument._id, {
				completionCertificateStorageId,
				finalPdfStorageId,
			});
		});

		await t.mutation(
			internal.documents.dealPackages.patchGeneratedDocumentSigningStateInternal,
			{
				generatedDocumentId: generatedDocument._id,
				now: Date.now(),
				signingStatus: "partially_signed",
			}
		);

		const refreshedGeneratedDocument = await t.run((ctx) =>
			ctx.db.get(generatedDocument._id)
		);

		expect(refreshedGeneratedDocument).toMatchObject({
			completionCertificateStorageId,
			finalPdfStorageId,
			signingStatus: "partially_signed",
		});
	});

	it("preserves stored signing artifacts when syncs omit replacement storage ids", async () => {
		installMockDocumensoFetch();
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");
		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});

		const [signatureEnvelope] = await t.run((ctx) =>
			ctx.db.query("signatureEnvelopes").collect()
		);
		if (!signatureEnvelope) {
			throw new Error("Expected a signature envelope");
		}

		const generatedDocument = await t.run((ctx) =>
			ctx.db.get(signatureEnvelope.generatedDocumentId)
		);
		if (!generatedDocument) {
			throw new Error("Expected a signable generated document");
		}

		const completionCertificateStorageId = await storePdfStorageId(
			t,
			"Existing completion certificate"
		);
		const finalPdfStorageId = await storePdfStorageId(
			t,
			"Existing final PDF"
		);

		await t.run(async (ctx) => {
			await ctx.db.patch(generatedDocument._id, {
				completionCertificateStorageId,
				finalPdfStorageId,
			});
		});

		await t.mutation(
			internal.documents.dealPackages.syncSignatureEnvelopeStateInternal,
			{
				envelopeId: signatureEnvelope._id,
				lastError: undefined,
				recipients: [],
				status: "sent",
			}
		);

		const refreshedGeneratedDocument = await t.run((ctx) =>
			ctx.db.get(generatedDocument._id)
		);

		expect(refreshedGeneratedDocument).toMatchObject({
			completionCertificateStorageId,
			finalPdfStorageId,
			signingStatus: "sent",
		});
	});

	it("preserves the last known signing state when envelope sync fails", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		const initialSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const initialSignable = initialSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!initialSignable?.generatedDocumentId) {
			throw new Error("Expected a signable package instance");
		}

		installMockDocumensoFetch({
			failEnvelopeFetch: true,
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		await expect(
			t.withIdentity(fixture.lenderIdentity).action(
				api.documents.signature.webhooks.syncSignableDocumentEnvelope,
				{
					dealId: fixture.dealId,
					instanceId: initialSignable.instanceId,
				}
			)
		).rejects.toThrow(/failed with status 500/i);

		const refreshedSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const refreshedSignable = refreshedSurface.instances.find(
			(instance) => instance.instanceId === initialSignable.instanceId
		);
		const generatedDocument = await t.run((ctx) =>
			ctx.db.get(initialSignable.generatedDocumentId!)
		);

		expect(refreshedSurface.package).toMatchObject({
			lastError: null,
			status: "ready",
		});
		expect(refreshedSignable).toMatchObject({
			lastError: null,
			status: "signature_sent",
			signing: expect.objectContaining({
				generatedDocumentSigningStatus: "sent",
				lastError: expect.stringContaining("failed with status 500"),
				status: "sent",
			}),
		});
		expect(generatedDocument).toMatchObject({
			signingStatus: "sent",
		});
	});

	it("archives completed signable artifacts into platform storage and stays idempotent on rerun", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		const initialSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = initialSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!signableInstance?.generatedDocumentId) {
			throw new Error("Expected a signable package instance");
		}

		const completedDocumenso = installMockDocumensoFetch({
			envelopeStatus: "COMPLETED",
			includeCompletionCertificate: true,
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
			recipientSigningStatus: "SIGNED",
		});
		await t.withIdentity(fixture.lenderIdentity).action(
			api.documents.signature.webhooks.syncSignableDocumentEnvelope,
			{
				dealId: fixture.dealId,
				instanceId: signableInstance.instanceId,
			}
		);

		await t.action(
			internal.engine.effects.dealClosingEffects.archiveSignedDocuments,
			buildArchiveEffectArgs(fixture.dealId)
		);

		const afterFirstArchive = await t
			.withIdentity(fixture.lenderIdentity)
			.query(api.documents.dealPackages.getPortalDocumentPackage, {
				dealId: fixture.dealId,
			});
		const portalDealDetail = await t
			.withIdentity(fixture.lenderIdentity)
			.query(api.deals.queries.getPortalDealDetail, {
				dealId: fixture.dealId,
			});
		const adminDealDetail = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(api.crm.detailContextQueries.getDealDetailContext, {
				dealId: fixture.dealId,
			});
		const archivedSignable = afterFirstArchive.instances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);
		const portalDealSignable = portalDealDetail.documentInstances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);
		const adminDealSignable = adminDealDetail.documentInstances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);
		const firstDocumentState = await t.run(async (ctx) => {
			const generatedDocument = await ctx.db.get(signableInstance.generatedDocumentId);
			if (!generatedDocument?.finalPdfStorageId) {
				throw new Error("Expected archived final PDF storage");
			}

			const finalPdf = await ctx.storage.get(generatedDocument.finalPdfStorageId);
			const certificate = generatedDocument.completionCertificateStorageId
				? await ctx.storage.get(generatedDocument.completionCertificateStorageId)
				: null;

			return {
				completionCertificateStorageId:
					generatedDocument.completionCertificateStorageId ?? null,
				finalPdfByteLength: finalPdf
					? (await finalPdf.arrayBuffer()).byteLength
					: 0,
				finalPdfStorageId: generatedDocument.finalPdfStorageId,
				signingStatus: generatedDocument.signingStatus,
				storedCertificateByteLength: certificate
					? (await certificate.arrayBuffer()).byteLength
					: 0,
			};
		});

		await t.action(
			internal.engine.effects.dealClosingEffects.archiveSignedDocuments,
			buildArchiveEffectArgs(fixture.dealId)
		);

		const secondDocumentState = await t.run(async (ctx) => {
			const generatedDocument = await ctx.db.get(signableInstance.generatedDocumentId);
			if (!generatedDocument) {
				throw new Error("Expected generated document after archive rerun");
			}

			return {
				completionCertificateStorageId:
					generatedDocument.completionCertificateStorageId ?? null,
				finalPdfStorageId: generatedDocument.finalPdfStorageId ?? null,
				signingStatus: generatedDocument.signingStatus,
			};
		});

		const signedDownloadCalls = completedDocumenso.fetchMock.mock.calls.filter(
			([input]) =>
				String(input).includes(
					`/envelope/item/${completedDocumenso.envelopeItemId}/download?version=signed`
				)
		);
		const certificateDownloadCalls =
			completedDocumenso.fetchMock.mock.calls.filter(([input]) =>
				String(input).includes(
					`/envelope/item/${completedDocumenso.completionCertificateItemId}/download`
				)
			);
		const archivedSignableFinalPdfUrl =
			archivedSignable?.archivedSigning?.finalPdfUrl;
		const portalDealSignableFinalPdfUrl =
			portalDealSignable?.archivedSigning?.finalPdfUrl;
		const adminDealSignableFinalPdfUrl =
			adminDealSignable?.archivedSigning?.finalPdfUrl;
		const archivedSignableUrl = archivedSignable?.url;
		const portalDealSignableUrl = portalDealSignable?.url;
		const adminDealSignableUrl = adminDealSignable?.url;
		const finalPdfByteLength = firstDocumentState.finalPdfByteLength;
		const storedCertificateByteLength =
			firstDocumentState.storedCertificateByteLength;

		expect(archivedSignable).toMatchObject({
			archivedSigning: {
				completionCertificateUrl: expect.any(String),
				finalPdfUrl: expect.any(String),
				signingCompletedAt: expect.any(Number),
			},
			archivedAt: expect.any(Number),
			status: "archived",
			url: expect.any(String),
		});
		expect(portalDealSignable).toMatchObject({
			archivedSigning: {
				completionCertificateUrl: expect.any(String),
				finalPdfUrl: expect.any(String),
				signingCompletedAt: expect.any(Number),
			},
			archivedAt: expect.any(Number),
			status: "archived",
			url: expect.any(String),
		});
		expect(adminDealSignable).toMatchObject({
			archivedSigning: {
				completionCertificateUrl: expect.any(String),
				finalPdfUrl: expect.any(String),
				signingCompletedAt: expect.any(Number),
			},
			archivedAt: expect.any(Number),
			status: "archived",
			url: expect.any(String),
		});
		expect(String(archivedSignableUrl)).toBe(String(archivedSignableFinalPdfUrl));
		expect(String(portalDealSignableUrl)).toBe(
			String(portalDealSignableFinalPdfUrl)
		);
		expect(String(adminDealSignableUrl)).toBe(String(adminDealSignableFinalPdfUrl));
		expect(afterFirstArchive.package).toMatchObject({
			archivedAt: expect.any(Number),
			status: "archived",
		});
		expect(firstDocumentState).toMatchObject({
			completionCertificateStorageId: expect.any(String),
			finalPdfByteLength: expect.any(Number),
			finalPdfStorageId: expect.any(String),
			signingStatus: "completed",
			storedCertificateByteLength: expect.any(Number),
		});
		expect(finalPdfByteLength).toBeGreaterThan(0);
		expect(storedCertificateByteLength).toBeGreaterThan(0);
		expect(secondDocumentState).toEqual({
			completionCertificateStorageId:
				firstDocumentState.completionCertificateStorageId,
			finalPdfStorageId: firstDocumentState.finalPdfStorageId,
			signingStatus: "completed",
		});
		expect(signedDownloadCalls).toHaveLength(1);
		expect(certificateDownloadCalls).toHaveLength(1);
	});

	it("records archive failures without corrupting signed state and can recover on retry", async () => {
		installMockDocumensoFetch({
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
		});
		const t = createTestConvex({ includeWorkflowComponents: false });
		const fixture = await seedDealPackageFixture(t, {
			includeListing: true,
			signablePlatformRole: "lender_primary",
			templatedVariableKey: "borrower_primary_full_name",
		});
		await setDealStatus(t, fixture.dealId, "documentReview.pending");

		await t.action(internal.documents.dealPackages.runCreateDocumentPackageInternal, {
			dealId: fixture.dealId,
			retry: false,
		});
		const initialSurface = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableInstance = initialSurface.instances.find(
			(instance) => instance.class === "private_templated_signable"
		);
		if (!signableInstance) {
			throw new Error("Expected a signable package instance");
		}

		installMockDocumensoFetch({
			envelopeStatus: "COMPLETED",
			failSignedDownload: true,
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
			recipientSigningStatus: "SIGNED",
		});
		await t.withIdentity(fixture.lenderIdentity).action(
			api.documents.signature.webhooks.syncSignableDocumentEnvelope,
			{
				dealId: fixture.dealId,
				instanceId: signableInstance.instanceId,
			}
		);

		await expect(
			t.action(
				internal.engine.effects.dealClosingEffects.archiveSignedDocuments,
				buildArchiveEffectArgs(fixture.dealId)
			)
		).rejects.toThrow(/failed with status 500/i);

		const afterFailure = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableAfterFailure = afterFailure.instances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);

		expect(afterFailure.package).toMatchObject({
			lastError: expect.stringContaining("failed with status 500"),
			status: "ready",
		});
		expect(signableAfterFailure).toMatchObject({
			archivedAt: null,
			status: "signed",
		});

		installMockDocumensoFetch({
			envelopeStatus: "COMPLETED",
			recipientEmail: "lender.phase7@test.fairlend.ca",
			recipientName: "Lena Lender",
			recipientSigningStatus: "SIGNED",
		});
		await t.action(
			internal.engine.effects.dealClosingEffects.archiveSignedDocuments,
			buildArchiveEffectArgs(fixture.dealId)
		);

		const afterRetry = await t.withIdentity(fixture.lenderIdentity).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const signableAfterRetry = afterRetry.instances.find(
			(instance) => instance.instanceId === signableInstance.instanceId
		);

		expect(afterRetry.package).toMatchObject({
			archivedAt: expect.any(Number),
			lastError: null,
			status: "archived",
		});
		expect(signableAfterRetry).toMatchObject({
			archivedAt: expect.any(Number),
			status: "archived",
		});
	});

	it("exposes remediation state for failed document rows", async () => {
		const { failedInstance, fixture, t } = await seedFailedCounselMemoPackage();

		const surface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const failedSurfaceRow = surface.instances.find(
			(instance) => instance.instanceId === failedInstance._id
		);

		expect(failedSurfaceRow).toMatchObject({
			instanceId: failedInstance._id,
			remediationAction: null,
			remediationReason: null,
			supersededByInstanceId: null,
			remediation: {
				eligibility: "remediable_failed_instance",
				primaryAction: "open_mapping",
				summary: expect.stringContaining("variable mapping"),
			},
			sourceBlueprintId: expect.any(String),
			templateId: expect.any(String),
		});
	});

	it("treats provider-error document rows as failed and remediable", async () => {
		const { failedInstance, fixture, t } = await seedFailedCounselMemoPackage();
		await t.run(async (ctx) => {
			await ctx.db.patch(failedInstance._id, {
				lastError: "Documenso POST /envelope/create failed with status 400",
				status: "provider_error",
			});
			await ctx.db.patch(failedInstance.packageId, {
				status: "pending",
			});
		});

		const surface = await t.withIdentity(FAIRLEND_ADMIN).query(
			api.documents.dealPackages.getPortalDocumentPackage,
			{
				dealId: fixture.dealId,
			}
		);
		const failedSurfaceRow = surface.instances.find(
			(instance) => instance.instanceId === failedInstance._id
		);

		expect(failedSurfaceRow).toMatchObject({
			remediation: {
				eligibility: "remediable_failed_instance",
				primaryAction: "open_authoring",
				summary: expect.stringContaining("provider"),
			},
			status: "provider_error",
		});

		await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.documents.dealPackages.waiveDealDocumentInstance,
			{
				instanceId: failedInstance._id,
				reason: "Provider failed row intentionally waived",
			}
		);
		const packageRecord = await t.run((ctx) =>
			ctx.db.get(failedInstance.packageId)
		);

		expect(packageRecord).toMatchObject({
			status: "ready",
		});
	});

	it("waives a failed document row for the current deal and journals the decision", async () => {
		const { failedInstance, fixture, t } = await seedFailedCounselMemoPackage();

		const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.documents.dealPackages.waiveDealDocumentInstance,
			{
				instanceId: failedInstance._id,
				reason: "Borrower counsel memo intentionally waived for this deal",
			}
		);
		const state = await t.run(async (ctx) => ({
			auditJournal: await ctx.db.query("auditJournal").collect(),
			instance: await ctx.db.get(failedInstance._id),
		}));

		expect(result).toEqual({ ok: true });
		expect(state.instance).toMatchObject({
			archivedAt: expect.any(Number),
			remediationAction: "waived_for_deal",
			remediationReason:
				"Borrower counsel memo intentionally waived for this deal",
			status: "archived",
		});
		expect(state.auditJournal).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					actorType: "system",
					entityId: String(fixture.dealId),
					entityType: "deal",
					eventType: "deal_document.waived_for_deal",
					afterState: expect.objectContaining({
						remediationAction: "waived_for_deal",
					}),
				}),
			])
		);
	});

	it("rejects invalid waive reasons", async () => {
		const { failedInstance, t } = await seedFailedCounselMemoPackage();

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).mutation(
				api.documents.dealPackages.waiveDealDocumentInstance,
				{
					instanceId: failedInstance._id,
					reason: "no",
				}
			)
		).rejects.toThrow(/reason must be between 3 and 280 characters/i);
	});

	it("archives a failed row source blueprint for future deals only after validating the row relationship", async () => {
		const { failedInstance, fixture, t } = await seedFailedCounselMemoPackage();
		if (!failedInstance.sourceBlueprintId) {
			throw new Error("Expected source blueprint id");
		}

		const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
			api.documents.dealPackages.archiveSourceBlueprintForFutureDeals,
			{
				instanceId: failedInstance._id,
				reason: "Do not include this failed memo in future deals",
				sourceBlueprintId: failedInstance.sourceBlueprintId,
			}
		);
		const state = await t.run(async (ctx) => ({
			auditJournal: await ctx.db.query("auditJournal").collect(),
			blueprint: failedInstance.sourceBlueprintId
				? await ctx.db.get(failedInstance.sourceBlueprintId)
				: null,
			instance: await ctx.db.get(failedInstance._id),
		}));

		expect(result).toEqual({ ok: true });
		expect(state.blueprint).toMatchObject({
			status: "archived",
		});
		expect(state.instance).toMatchObject({
			status: "generation_failed",
		});
		expect(state.auditJournal).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					entityId: String(fixture.dealId),
					eventType: "deal_document.archived_source_blueprint",
					linkedRecordIds: expect.objectContaining({
						dealDocumentInstanceId: String(failedInstance._id),
						packageId: String(failedInstance.packageId),
						sourceBlueprintId: String(failedInstance.sourceBlueprintId),
					}),
				}),
			])
		);
	});

	it("rejects source blueprint archival when the failed row does not own that source", async () => {
		const { failedInstance, t } = await seedFailedCounselMemoPackage();
		const otherSourceBlueprintId = await t.run(async (ctx) => {
			const blueprint = (
				await ctx.db.query("mortgageDocumentBlueprints").collect()
			).find(
				(candidate) =>
					candidate.mortgageId === failedInstance.mortgageId &&
					candidate._id !== failedInstance.sourceBlueprintId
			);
			if (!blueprint || blueprint._id === failedInstance.sourceBlueprintId) {
				throw new Error("Expected another blueprint");
			}
			return blueprint._id;
		});

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).mutation(
				api.documents.dealPackages.archiveSourceBlueprintForFutureDeals,
				{
					instanceId: failedInstance._id,
					sourceBlueprintId: otherSourceBlueprintId,
				}
			)
		).rejects.toThrow(/does not match/i);
	});

	it("row retry archives only the selected failed row and creates one replacement", async () => {
		const { failedInstance, fixture, t } = await seedFailedCounselMemoPackage();
		const secondFailedInstanceId = await t.run(async (ctx) => {
			return ctx.db.insert("dealDocumentInstances", {
				archivedAt: undefined,
				assetId: undefined,
				createdAt: Date.now(),
				dealId: failedInstance.dealId,
				generatedDocumentId: undefined,
				kind: "generated",
				lastError: "Missing variables: another_missing_variable",
				mortgageId: failedInstance.mortgageId,
				packageId: failedInstance.packageId,
				sourceBlueprintId: failedInstance.sourceBlueprintId,
				sourceBlueprintSnapshot: {
					...failedInstance.sourceBlueprintSnapshot,
					displayName: "Second failed memo",
					displayOrder: 10,
				},
				status: "generation_failed",
				updatedAt: Date.now(),
			});
		});

		const result = await t.withIdentity(FAIRLEND_ADMIN).action(
			api.documents.dealPackages.retryDealDocumentInstance,
			{
				instanceId: failedInstance._id,
			}
		);
		const state = await t.run(async (ctx) => ({
			instances: await ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_package", (query) =>
					query.eq("packageId", failedInstance.packageId)
				)
				.collect(),
			packageRecord: await ctx.db.get(failedInstance.packageId),
		}));

		const selectedAfter = state.instances.find(
			(instance) => instance._id === failedInstance._id
		);
		const untouchedAfter = state.instances.find(
			(instance) => instance._id === secondFailedInstanceId
		);
		const replacement = state.instances.find(
			(instance) => instance._id === result.replacementInstanceId
		);

		expect(result.replacementInstanceId).toEqual(expect.any(String));
		expect(selectedAfter).toMatchObject({
			remediationAction: "retried_instance",
			status: "archived",
			supersededByInstanceId: result.replacementInstanceId,
		});
		expect(untouchedAfter?.archivedAt).toBeUndefined();
		expect(untouchedAfter).toMatchObject({ status: "generation_failed" });
		expect(replacement).toMatchObject({
			dealId: fixture.dealId,
			status: "generation_failed",
		});
		expect(state.packageRecord?.status).toBe("partial_failure");
	});

	it("rejects a second row retry after the failed row has been claimed", async () => {
		const { failedInstance, t } = await seedFailedCounselMemoPackage();

		const firstResult = await t.withIdentity(FAIRLEND_ADMIN).action(
			api.documents.dealPackages.retryDealDocumentInstance,
			{
				instanceId: failedInstance._id,
			}
		);

		await expect(
			t.withIdentity(FAIRLEND_ADMIN).action(
				api.documents.dealPackages.retryDealDocumentInstance,
				{
					instanceId: failedInstance._id,
				}
			)
		).rejects.toThrow(/not remediable/i);

		const state = await t.run(async (ctx) => ({
			instances: await ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_package", (query) =>
					query.eq("packageId", failedInstance.packageId)
				)
				.collect(),
			original: await ctx.db.get(failedInstance._id),
		}));

		expect(firstResult.replacementInstanceId).toEqual(expect.any(String));
		expect(state.original).toMatchObject({
			remediationAction: "retried_instance",
			supersededByInstanceId: firstResult.replacementInstanceId,
		});
		expect(
			state.instances.filter(
				(instance) =>
					instance.sourceBlueprintId === failedInstance.sourceBlueprintId &&
					instance._id !== failedInstance._id
			)
		).toHaveLength(1);
	});

	it("refreshes a failed row from the latest active source blueprint snapshot", async () => {
		const { failedInstance, t } = await seedFailedCounselMemoPackage();
		if (!failedInstance.sourceBlueprintId) {
			throw new Error("Expected source blueprint id");
		}
		await t.run(async (ctx) => {
			await ctx.db.patch(failedInstance.sourceBlueprintId, {
				displayName: "Counsel memo refreshed",
			});
		});

		const result = await t.withIdentity(FAIRLEND_ADMIN).action(
			api.documents.dealPackages.refreshDealDocumentInstanceSnapshot,
			{
				instanceId: failedInstance._id,
			}
		);
		const state = await t.run(async (ctx) => ({
			instances: await ctx.db
				.query("dealDocumentInstances")
				.withIndex("by_package", (query) =>
					query.eq("packageId", failedInstance.packageId)
				)
				.collect(),
		}));
		const original = state.instances.find(
			(instance) => instance._id === failedInstance._id
		);
		const replacement = state.instances.find(
			(instance) => instance._id === result.replacementInstanceId
		);

		expect(original).toMatchObject({
			remediationAction: "refreshed_from_source_snapshot",
			status: "archived",
			supersededByInstanceId: result.replacementInstanceId,
		});
		expect(replacement).toMatchObject({
			sourceBlueprintSnapshot: expect.objectContaining({
				displayName: "Counsel memo refreshed",
			}),
			status: "generation_failed",
		});
	});
});
