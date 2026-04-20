import { ConvexError } from "convex/values";

export function assertOriginationCaseAccess(
	viewer: {
		isFairLendAdmin: boolean;
		orgId?: string;
	},
	record: {
		orgId?: string;
	}
) {
	if (viewer.isFairLendAdmin) {
		return;
	}

	if (!(viewer.orgId && record.orgId)) {
		throw new ConvexError(
			"Forbidden: origination case access requires org context"
		);
	}

	if (viewer.orgId !== record.orgId) {
		throw new ConvexError("Forbidden: origination case is outside your org");
	}
}
