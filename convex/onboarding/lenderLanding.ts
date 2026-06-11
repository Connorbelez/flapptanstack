import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { authedMutation } from "../fluent";

const STARTED_STATUS = "started";
const HANDOFF_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ACTIVE_RESUME_STATUSES = new Set([
	"started",
	"pending_review",
	"approved",
]);
const ALLOWED_ENTRY_SOURCES = new Set([
	"featured-listing",
	"switchboard",
	"view-all",
]);
const ALLOWED_ENTRY_QUERY_PARAMS = new Set(["listingId", "source"]);

function normalizeEmail(email: string | undefined) {
	const normalized = email?.trim().toLowerCase();
	if (!normalized) {
		throw new ConvexError("A lender email is required to start onboarding.");
	}
	return normalized;
}

function normalizeEntryPath(args: {
	entryPath: string;
	listingId?: string | undefined;
}) {
	const entryPath = args.entryPath.trim();
	if (
		!entryPath.startsWith("/") ||
		entryPath.startsWith("//") ||
		entryPath.includes("\\")
	) {
		throw new ConvexError(
			"Lender handoff entryPath must be a relative portal path."
		);
	}
	const entryUrl = new URL(entryPath, "https://portal.local");
	if (entryUrl.pathname !== "/start-lending") {
		throw new ConvexError(
			"Lender handoff entryPath must use the canonical /start-lending path."
		);
	}
	if (entryPath.length > 512) {
		throw new ConvexError("Lender handoff entryPath is too long.");
	}
	const source = entryUrl.searchParams.get("source");
	if (!(source && ALLOWED_ENTRY_SOURCES.has(source))) {
		throw new ConvexError("Lender handoff entryPath source is invalid.");
	}
	for (const key of entryUrl.searchParams.keys()) {
		if (!ALLOWED_ENTRY_QUERY_PARAMS.has(key)) {
			throw new ConvexError(
				`Lender handoff entryPath query parameter is unsupported: ${key}`
			);
		}
	}
	const entryListingId = entryUrl.searchParams.get("listingId");
	if (entryListingId !== (args.listingId ?? null)) {
		throw new ConvexError("Lender handoff listingId must match the entryPath.");
	}
	return entryPath;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

type BrokerAttributedPortal = Doc<"portals"> & { brokerId: Id<"brokers"> };

function assertBrokerAttributedPortal(
	portal: Doc<"portals"> | null
): BrokerAttributedPortal {
	if (!portal) {
		throw new ConvexError("Portal not found.");
	}
	if (!(portal.status === "active" && portal.isPublished)) {
		throw new ConvexError("Cannot start lender onboarding from this portal.");
	}
	if (!portal.brokerId) {
		throw new ConvexError("Lender onboarding requires a broker portal.");
	}
	return portal as BrokerAttributedPortal;
}

async function findExistingLenderOnboarding(
	ctx: Pick<MutationCtx, "db">,
	args: {
		brokerId: Doc<"portals">["brokerId"];
		email: string;
		subdomain: string;
	}
) {
	const candidates = await ctx.db
		.query("lenderOnboardings")
		.withIndex("by_email", (query) => query.eq("email", args.email))
		.collect();

	return (
		candidates.find(
			(candidate) =>
				candidate.brokerId === args.brokerId &&
				candidate.subdomain === args.subdomain &&
				ACTIVE_RESUME_STATUSES.has(candidate.status)
		) ?? null
	);
}

function buildLandingMachineContext(args: {
	existingMachineContext?: unknown;
	listingId?: string | undefined;
	portalId: Id<"portals">;
}) {
	return {
		...(isRecord(args.existingMachineContext)
			? args.existingMachineContext
			: {}),
		landingSource: args.listingId
			? {
					listingId: args.listingId,
					portalId: String(args.portalId),
				}
			: {
					portalId: String(args.portalId),
				},
	};
}

export const completeLandingStart = authedMutation
	.input({
		entryPath: v.string(),
		listingId: v.optional(v.string()),
		portalId: v.id("portals"),
	})
	.handler(async (ctx, args) => {
		const email = normalizeEmail(ctx.viewer.email);
		const entryPath = normalizeEntryPath({
			entryPath: args.entryPath,
			listingId: args.listingId,
		});
		const portal = assertBrokerAttributedPortal(
			await ctx.db.get(args.portalId)
		);
		const brokerId = portal.brokerId;
		const subdomain = portal.slug;
		const now = Date.now();
		const existing = await findExistingLenderOnboarding(ctx, {
			brokerId: portal.brokerId,
			email,
			subdomain,
		});

		if (existing) {
			await ctx.db.patch(existing._id, {
				entryPath,
				lastActivityAt: now,
				machineContext: buildLandingMachineContext({
					existingMachineContext: existing.machineContext,
					listingId: args.listingId,
					portalId: portal._id,
				}),
			});
			return {
				onboardingId: existing._id,
				status: existing.status,
				wasCreated: false,
			};
		}

		const onboardingId = await ctx.db.insert("lenderOnboardings", {
			accreditationStatus: undefined,
			address: undefined,
			adminInviteToken: undefined,
			brokerId,
			createdAt: now,
			email,
			entryPath,
			expiresAt: now + HANDOFF_TTL_MS,
			fullName:
				[ctx.viewer.firstName, ctx.viewer.lastName].filter(Boolean).join(" ") ||
				undefined,
			idvResult: undefined,
			inviteToken: undefined,
			invitedByAdminId: undefined,
			kycDocumentIds: undefined,
			kycResult: undefined,
			lastActivityAt: now,
			lastTransitionAt: now,
			lenderId: undefined,
			machineContext: buildLandingMachineContext({
				listingId: args.listingId,
				portalId: portal._id,
			}),
			personaInquiryId: undefined,
			phone: undefined,
			startedAt: now,
			status: STARTED_STATUS,
			subdomain,
			verificationScore: undefined,
		});

		return {
			onboardingId,
			status: STARTED_STATUS,
			wasCreated: true,
		};
	})
	.public();
