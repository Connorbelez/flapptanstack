import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type {
	PortfolioLenderRenewalIntentChoice,
	PortfolioLenderRenewalIntentRecord,
} from "../portfolio-types";
import { lenderPortfolioRenewalIntentQueryOptions } from "../query-options";

function toErrorMessage(error: unknown, fallback: string) {
	return error instanceof Error ? error.message : fallback;
}

export interface SubmitRenewalIntentArgs {
	intent: PortfolioLenderRenewalIntentChoice;
	partialExitFractions?: number;
}

export interface UsePortfolioRenewalActionsResult {
	isLoading: boolean;
	isSubmitting: boolean;
	loadErrorMessage?: string;
	renewal: PortfolioLenderRenewalIntentRecord | null;
	submitErrorMessage?: string;
	submitIntent: (args: SubmitRenewalIntentArgs) => Promise<void>;
}

export function usePortfolioRenewalActions(args: {
	mortgageId: string;
	portalId: Id<"portals">;
}): UsePortfolioRenewalActionsResult {
	const signalLenderRenewalIntent = useMutation(
		api.renewals.portal.signalLenderRenewalIntent
	);
	const renewalQuery = useQuery({
		...lenderPortfolioRenewalIntentQueryOptions(args.portalId, args.mortgageId),
	});
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitErrorMessage, setSubmitErrorMessage] = useState<
		string | undefined
	>(undefined);

	const submitIntent = useCallback(
		async ({ intent, partialExitFractions }: SubmitRenewalIntentArgs) => {
			setIsSubmitting(true);
			setSubmitErrorMessage(undefined);

			try {
				await signalLenderRenewalIntent({
					intent,
					mortgageId: args.mortgageId as Id<"mortgages">,
					partialExitFractions,
					portalId: args.portalId,
				});
			} catch (error) {
				setSubmitErrorMessage(
					toErrorMessage(
						error,
						"Unable to save the renewal decision right now."
					)
				);
			} finally {
				setIsSubmitting(false);
			}
		},
		[args.mortgageId, args.portalId, signalLenderRenewalIntent]
	);

	return {
		isLoading: renewalQuery.isPending,
		isSubmitting,
		loadErrorMessage: renewalQuery.error
			? toErrorMessage(
					renewalQuery.error,
					"Unable to load the governed renewal state right now."
				)
			: undefined,
		renewal: renewalQuery.data ?? null,
		submitErrorMessage,
		submitIntent,
	};
}
