import type { Doc, Id } from "../../_generated/dataModel";

export interface BrokerReassignmentPortalSummary {
	host: string;
	portalId: Id<"portals"> | null;
	portalType: Doc<"portals">["portalType"];
	willEnsure: boolean;
}

export interface BrokerReassignmentPartySummary {
	brokerId: Id<"brokers">;
	displayName: string;
	orgId: string;
	portal: BrokerReassignmentPortalSummary | null;
	status: string;
}

export interface BrokerReassignmentPreview {
	blockingReasons: string[];
	current: BrokerReassignmentPartySummary;
	portalHostWillChange: boolean;
	target: BrokerReassignmentPartySummary;
	workosOperations: {
		addTargetMembership: boolean;
		deactivateCurrentMembership: boolean;
		roleSlug: "lender";
	};
}
