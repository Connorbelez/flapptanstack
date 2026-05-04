import { v } from "convex/values";

export const micInvestorAccessRequestStatusValidator = v.union(
	v.literal("pending_review"),
	v.literal("approved"),
	v.literal("rejected")
);

export const micInvestorAccessRequestProvisioningStateValidator = v.union(
	v.literal("pending"),
	v.literal("not_started"),
	v.literal("in_progress"),
	v.literal("completed"),
	v.literal("failed")
);

export const micInvestorAccessRequestMachineContextValidator = v.object({});

export const micInvestorAccessRequestSubmitResultValidator = v.object({
	ok: v.literal(true),
	status: v.literal("received"),
});

export const MIC_INVESTOR_ACCESS_REQUEST_RECEIVED = {
	ok: true,
	status: "received",
} as const;
