import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/lawyer/deals/$dealId")({
	component: LawyerDealBootstrapRoute,
});

function LawyerDealBootstrapRoute() {
	const { dealId } = Route.useParams();
	const navigate = useNavigate();
	const startOrResumeForDeal = useMutation(
		api.legalRepresentation.onboarding.startOrResumeForDeal
	);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		void startOrResumeForDeal({ dealId: dealId as Id<"deals"> })
			.then(async (result) => {
				if (cancelled) {
					return;
				}
				await navigate({
					href:
						result.session.nextRoute ??
						`/lawyer/onboarding/${String(result.session._id)}`,
				});
			})
			.catch((unknownError: unknown) => {
				if (cancelled) {
					return;
				}
				setError(
					unknownError instanceof Error
						? unknownError.message
						: "Lawyer onboarding could not be opened."
				);
			});
		return () => {
			cancelled = true;
		};
	}, [dealId, navigate, startOrResumeForDeal]);

	if (error) {
		throw redirect({
			href: `/deals/${dealId}`,
		});
	}

	return <AppRoutePendingScreen />;
}
