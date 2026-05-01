import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
	MicLandingPageView,
	type MicLandingSubmitRequest,
} from "./MicLandingPageView";

interface MicLandingPageProps {
	portalId: string;
	portalSlug: string;
}

export type {
	MicLandingPageViewProps,
	MicLandingSubmitRequest,
} from "./MicLandingPageView";

export function MicLandingPage({ portalId, portalSlug }: MicLandingPageProps) {
	const submitRequest = useMutation(
		api.micInvestorAccessRequests.mutations.submitPublicRequest
	);
	return (
		<MicLandingPageView
			portalId={portalId}
			portalSlug={portalSlug}
			submitRequest={submitRequest as MicLandingSubmitRequest}
		/>
	);
}
