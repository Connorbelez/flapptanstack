import type { Doc } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../../constants";
import {
	FAIRLEND_PORTAL_LOCAL_HOST,
	FAIRLEND_PORTAL_SLUG,
} from "../../portals/helpers";
import {
	getPortalByBrokerId,
	getPortalBySlug,
} from "../../portals/homePortalAssignment";
import type { BrokerReassignmentPortalSummary } from "./reassignmentTypes";

type ReassignmentReaderCtx = Pick<QueryCtx, "db">;

export function isFairLendOwnedBroker(broker: Doc<"brokers">) {
	return broker.orgId === FAIRLEND_BROKERAGE_ORG_ID;
}

export function getPrimaryPortalHost(portal: Doc<"portals">) {
	return portal.localHost ?? portal.productionHost ?? portal.slug;
}

function toPortalSummary(
	portal: Doc<"portals"> | null
): BrokerReassignmentPortalSummary | null {
	if (!portal || portal.status !== "active" || !portal.isPublished) {
		return null;
	}

	return {
		host: getPrimaryPortalHost(portal),
		portalId: portal._id,
		portalType: portal.portalType,
		willEnsure: false,
	};
}

function toFairLendPortalSummary(
	portal: Doc<"portals"> | null
): BrokerReassignmentPortalSummary {
	const activePublishedPortal =
		portal?.status === "active" && portal.isPublished ? portal : null;

	return {
		host: activePublishedPortal
			? getPrimaryPortalHost(activePublishedPortal)
			: FAIRLEND_PORTAL_LOCAL_HOST,
		portalId: activePublishedPortal?._id ?? null,
		portalType: "fairlend",
		willEnsure: !activePublishedPortal,
	};
}

export async function resolveBrokerReassignmentPortal(
	ctx: ReassignmentReaderCtx,
	broker: Doc<"brokers">
) {
	if (isFairLendOwnedBroker(broker)) {
		return toFairLendPortalSummary(
			await getPortalBySlug(ctx, FAIRLEND_PORTAL_SLUG)
		);
	}

	return toPortalSummary(await getPortalByBrokerId(ctx, broker._id));
}

export async function buildBrokerReassignmentPartySummary(
	ctx: ReassignmentReaderCtx,
	broker: Doc<"brokers">
) {
	const user = await ctx.db.get(broker.userId);
	const displayName = broker.brokerageName
		? broker.brokerageName
		: [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
			user?.email ||
			"Unknown broker";

	return {
		brokerId: broker._id,
		displayName,
		orgId: broker.orgId ?? "",
		portal: await resolveBrokerReassignmentPortal(ctx, broker),
		status: broker.status,
	};
}
