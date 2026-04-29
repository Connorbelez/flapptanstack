import { v } from "convex/values";

export const micInvestorAccessStatusValidator = v.union(
	v.literal("pending_review"),
	v.literal("approved"),
	v.literal("rejected")
);

export const micInvestorProvisioningStateValidator = v.union(
	v.literal("pending"),
	v.literal("provisioned"),
	v.literal("failed")
);

export const micInvestorAccessListArgsValidator = {
	status: v.optional(micInvestorAccessStatusValidator),
};

export const micInvestorAccessSubmitArgsValidator = {
	email: v.string(),
	portalSlug: v.string(),
};

export const micInvestorAccessApproveArgsValidator = {
	requestId: v.id("micInvestorAccessRequests"),
};

export const micInvestorAccessRejectArgsValidator = {
	rejectionReason: v.string(),
	requestId: v.id("micInvestorAccessRequests"),
};
