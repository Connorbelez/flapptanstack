import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type {
	LenderPortfolioQueryMode,
	PortfolioLenderRenewalIntentChoice,
	PortfolioLenderRenewalIntentRecord,
} from "../portfolio-types";
import {
	adminLenderPortfolioRenewalIntentQueryOptions,
	lenderPortfolioRenewalIntentQueryOptions,
} from "../query-options";

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
	mode: LenderPortfolioQueryMode;
	mortgageId: string;
}): UsePortfolioRenewalActionsResult {
	const signalLenderRenewalIntent = useMutation(
		api.renewals.portal.signalLenderRenewalIntent
	);
	const signalAdminLenderRenewalIntent = useMutation(
		api.admin.portfolio.renewals.signalAdminLenderRenewalIntent
	);
	const renewalQueryOptions =
		args.mode.kind === "admin"
			? adminLenderPortfolioRenewalIntentQueryOptions(
					args.mode.targetLenderId,
					args.mortgageId
				)
			: lenderPortfolioRenewalIntentQueryOptions(
					args.mode.portalId,
					args.mortgageId
				);
	const renewalQuery = useQuery(
		renewalQueryOptions as unknown as Parameters<
			typeof useQuery<PortfolioLenderRenewalIntentRecord>
		>[0]
	);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitErrorMessage, setSubmitErrorMessage] = useState<
		string | undefined
	>(undefined);

	const submitIntent = useCallback(
		async ({ intent, partialExitFractions }: SubmitRenewalIntentArgs) => {
			setIsSubmitting(true);
			setSubmitErrorMessage(undefined);

			try {
				if (args.mode.kind === "admin") {
					await signalAdminLenderRenewalIntent({
						intent,
						mortgageId: args.mortgageId as Id<"mortgages">,
						partialExitFractions,
						reason:
							args.mode.actionReason ??
							"Admin submitted lender renewal decision from portfolio tab.",
						targetLenderId: args.mode.targetLenderId,
					});
				} else {
					await signalLenderRenewalIntent({
						intent,
						mortgageId: args.mortgageId as Id<"mortgages">,
						partialExitFractions,
						portalId: args.mode.portalId,
					});
				}
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
		[
			args.mortgageId,
			args.mode,
			signalAdminLenderRenewalIntent,
			signalLenderRenewalIntent,
		]
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
