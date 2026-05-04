import { useQuery } from "@tanstack/react-query";
import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type {
	PortfolioLenderRenewalIntentChoice,
	PortfolioLenderRenewalIntentRecord,
} from "../portfolio-types";
import {
	adminLenderPortfolioRenewalIntentQueryOptions,
	lenderPortfolioRenewalIntentQueryOptions,
	type PortfolioQueryAccess,
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

export function usePortalPortfolioRenewalActions(args: {
	mortgageId: string;
	portalId: Id<"portals">;
}): UsePortfolioRenewalActionsResult {
	const renewalQuery = useQuery({
		...lenderPortfolioRenewalIntentQueryOptions(args.portalId, args.mortgageId),
	});
	const submission = useRenewalIntentSubmission({
		access: { mode: "portal", portalId: args.portalId },
		mortgageId: args.mortgageId,
	});

	return {
		isLoading: renewalQuery.isPending,
		isSubmitting: submission.isSubmitting,
		loadErrorMessage: renewalQuery.error
			? toErrorMessage(
					renewalQuery.error,
					"Unable to load the governed renewal state right now."
				)
			: undefined,
		renewal: renewalQuery.data ?? null,
		submitErrorMessage: submission.submitErrorMessage,
		submitIntent: submission.submitIntent,
	};
}

export function useAdminPortfolioRenewalActions(args: {
	mortgageId: string;
	renewalActionReason: string;
	targetLenderId: Id<"lenders">;
}): UsePortfolioRenewalActionsResult {
	const renewalQuery = useQuery({
		...adminLenderPortfolioRenewalIntentQueryOptions(
			args.targetLenderId,
			args.mortgageId
		),
	});
	const submission = useRenewalIntentSubmission({
		access: {
			mode: "admin",
			renewalActionReason: args.renewalActionReason,
			targetLenderId: args.targetLenderId,
		},
		mortgageId: args.mortgageId,
	});

	return {
		isLoading: renewalQuery.isPending,
		isSubmitting: submission.isSubmitting,
		loadErrorMessage: renewalQuery.error
			? toErrorMessage(
					renewalQuery.error,
					"Unable to load the governed renewal state right now."
				)
			: undefined,
		renewal: renewalQuery.data ?? null,
		submitErrorMessage: submission.submitErrorMessage,
		submitIntent: submission.submitIntent,
	};
}

function useRenewalIntentSubmission(args: {
	access: PortfolioQueryAccess;
	mortgageId: string;
}): Pick<
	UsePortfolioRenewalActionsResult,
	"isSubmitting" | "submitErrorMessage" | "submitIntent"
> {
	const signalLenderRenewalIntent = useMutation(
		api.renewals.portal.signalLenderRenewalIntent
	);
	const signalAdminLenderRenewalIntent = useMutation(
		api.admin.portfolio.mutations.signalAdminLenderRenewalIntent
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
				if (args.access.mode === "admin") {
					const reason = args.access.renewalActionReason.trim();
					if (!reason) {
						setSubmitErrorMessage(
							"Enter an admin action reason before saving the renewal decision."
						);
						return;
					}
					await signalAdminLenderRenewalIntent({
						intent,
						mortgageId: args.mortgageId as Id<"mortgages">,
						partialExitFractions,
						reason,
						targetLenderId: args.access.targetLenderId,
					});
				} else {
					await signalLenderRenewalIntent({
						intent,
						mortgageId: args.mortgageId as Id<"mortgages">,
						partialExitFractions,
						portalId: args.access.portalId,
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
			args.access,
			args.mortgageId,
			signalAdminLenderRenewalIntent,
			signalLenderRenewalIntent,
		]
	);

	return {
		isSubmitting,
		submitErrorMessage,
		submitIntent,
	};
}
