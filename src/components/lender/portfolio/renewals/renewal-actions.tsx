"use client";

import { AlertCircle, LoaderCircle } from "lucide-react";
import { Component } from "react";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { formatPortfolioDate } from "../portfolio-formatters";
import type { PortfolioLenderRenewalIntentChoice } from "../portfolio-types";
import { PartialExitForm } from "./partial-exit-form";
import { RenewalStatus, type RenewalSurfaceVariant } from "./renewal-status";
import {
	getRenewalBlockedReasonDescription,
	getRenewalChoiceLabel,
	reconcileRenewalDraftState,
	validateRenewalPartialExit,
} from "./renewal-ui-helpers";
import {
	type SubmitRenewalIntentArgs,
	type UsePortfolioRenewalActionsResult,
	usePortfolioRenewalActions,
} from "./use-renewal-actions";

interface RenewalActionSurfaceProps {
	mortgageId: string;
	portalId: Id<"portals">;
	variant?: RenewalSurfaceVariant;
}

interface RenewalActionSurfaceViewProps {
	mortgageId: string;
	renewalActions: UsePortfolioRenewalActionsResult;
	variant: RenewalSurfaceVariant;
}

interface RenewalActionSurfaceViewState {
	activeChoice: PortfolioLenderRenewalIntentChoice | null;
	partialExitFractions: string;
	remoteStateKey: string | null;
	submittingChoice: PortfolioLenderRenewalIntentChoice | null;
	validationError?: string;
}

export function RenewalActionSurface({
	mortgageId,
	portalId,
	variant = "full",
}: RenewalActionSurfaceProps) {
	const renewalActions = usePortfolioRenewalActions({
		mortgageId,
		portalId,
	});

	return (
		<RenewalActionSurfaceView
			mortgageId={mortgageId}
			renewalActions={renewalActions}
			variant={variant}
		/>
	);
}

// biome-ignore lint/style/useReactFunctionComponents: Local draft state must survive real component rerenders in Vitest without tripping the React 19 duplicate-dispatcher path.
class RenewalActionSurfaceView extends Component<
	RenewalActionSurfaceViewProps,
	RenewalActionSurfaceViewState
> {
	override state: RenewalActionSurfaceViewState = {
		activeChoice: null,
		partialExitFractions: "",
		remoteStateKey: null,
		submittingChoice: null,
		validationError: undefined,
	};

	override componentDidMount() {
		this.reconcileDraftState();
	}

	override componentDidUpdate(
		prevProps: RenewalActionSurfaceViewProps,
		prevState: RenewalActionSurfaceViewState
	) {
		if (
			prevProps.renewalActions.renewal !== this.props.renewalActions.renewal ||
			prevState.activeChoice !== this.state.activeChoice ||
			prevState.partialExitFractions !== this.state.partialExitFractions ||
			prevState.remoteStateKey !== this.state.remoteStateKey ||
			prevState.validationError !== this.state.validationError
		) {
			this.reconcileDraftState();
		}
	}

	private reconcileDraftState() {
		const { renewal } = this.props.renewalActions;
		const nextDraftState = reconcileRenewalDraftState({
			draftState: {
				activeChoice: this.state.activeChoice,
				partialExitFractions: this.state.partialExitFractions,
				remoteStateKey: this.state.remoteStateKey,
				validationError: this.state.validationError,
			},
			renewal,
		});

		if (
			nextDraftState.activeChoice === this.state.activeChoice &&
			nextDraftState.partialExitFractions === this.state.partialExitFractions &&
			nextDraftState.remoteStateKey === this.state.remoteStateKey &&
			nextDraftState.validationError === this.state.validationError
		) {
			return;
		}

		this.setState({
			activeChoice: nextDraftState.activeChoice,
			partialExitFractions: nextDraftState.partialExitFractions,
			remoteStateKey: nextDraftState.remoteStateKey,
			validationError: nextDraftState.validationError,
		});
	}

	private readonly handleChoiceClick = (
		choice: PortfolioLenderRenewalIntentChoice
	) => {
		if (choice === "partial_exit") {
			this.setState((state) => ({
				activeChoice:
					state.activeChoice === "partial_exit" ? null : "partial_exit",
				validationError: undefined,
			}));
			return;
		}

		void this.handleIntentSubmit({ intent: choice });
	};

	private readonly handleIntentSubmit = async (
		args: SubmitRenewalIntentArgs
	) => {
		this.setState({
			submittingChoice: args.intent,
			validationError: undefined,
		});

		try {
			await this.props.renewalActions.submitIntent(args);
			if (args.intent !== "partial_exit") {
				this.setState({ activeChoice: null });
			}
		} finally {
			this.setState((state) => ({
				submittingChoice:
					state.submittingChoice === args.intent
						? null
						: state.submittingChoice,
			}));
		}
	};

	private readonly handlePartialExitSubmit = () => {
		const { renewal } = this.props.renewalActions;
		if (!renewal) {
			return;
		}

		const nextError = validateRenewalPartialExit({
			currentHeldFractions: renewal.currentHeldFractions,
			minimumFractions: renewal.partialExitMinimumFractions,
			value: this.state.partialExitFractions,
		});
		this.setState({ validationError: nextError ?? undefined });
		if (nextError) {
			return;
		}

		void this.handleIntentSubmit({
			intent: "partial_exit",
			partialExitFractions: Number(this.state.partialExitFractions),
		});
	};

	override render() {
		const { mortgageId, renewalActions, variant } = this.props;
		const {
			isLoading,
			isSubmitting,
			loadErrorMessage,
			renewal,
			submitErrorMessage,
		} = renewalActions;
		const {
			activeChoice,
			partialExitFractions,
			submittingChoice,
			validationError,
		} = this.state;
		const isSubmitLocked = isSubmitting || submittingChoice !== null;

		if (isLoading) {
			return (
				<div
					className={
						variant === "compact"
							? "space-y-3 border-border/70 border-y py-3"
							: "space-y-4 border-border/70 border-y py-4"
					}
					data-testid={`renewal-loading-${mortgageId}`}
				>
					<Skeleton className="h-5 w-36" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-9 w-full" />
				</div>
			);
		}

		if (loadErrorMessage) {
			return (
				<Alert
					className="border-destructive/40"
					data-testid={`renewal-query-error-${mortgageId}`}
					variant="destructive"
				>
					<AlertCircle />
					<AlertTitle>Renewal state unavailable</AlertTitle>
					<AlertDescription>{loadErrorMessage}</AlertDescription>
				</Alert>
			);
		}

		if (!renewal) {
			return (
				<Alert data-testid={`renewal-empty-state-${mortgageId}`}>
					<AlertCircle />
					<AlertTitle>No current renewal prompt</AlertTitle>
					<AlertDescription>
						This mortgage does not currently have an active governed renewal
						intent to review.
					</AlertDescription>
				</Alert>
			);
		}

		const blockedReasonDescription = getRenewalBlockedReasonDescription(
			renewal.actionBlockedReason
		);
		let helperCopy = "No governed renewal actions are currently available.";
		if (blockedReasonDescription) {
			helperCopy = blockedReasonDescription;
		} else if (renewal.actionRequired) {
			helperCopy = `Action is required before ${formatPortfolioDate(renewal.signalDeadline)}.`;
		} else if (renewal.canChangeIntent) {
			helperCopy =
				"The runtime still allows the lender to change intent from this recorded state.";
		}

		return (
			<div
				className={
					variant === "compact"
						? "space-y-3 border-border/70 border-y bg-muted/10 py-3"
						: "space-y-4 border-border/70 border-y bg-muted/10 py-4"
				}
				data-testid={`renewal-action-surface-${variant}-${mortgageId}`}
			>
				<RenewalStatus
					mortgageId={mortgageId}
					renewal={renewal}
					variant={variant}
				/>

				{blockedReasonDescription ? (
					<Alert data-testid={`renewal-blocked-alert-${mortgageId}`}>
						<AlertCircle />
						<AlertTitle>Renewal is visible but not actionable</AlertTitle>
						<AlertDescription>{blockedReasonDescription}</AlertDescription>
					</Alert>
				) : null}

				{submitErrorMessage ? (
					<Alert
						className="border-destructive/40"
						data-testid={`renewal-submit-error-${mortgageId}`}
						variant="destructive"
					>
						<AlertCircle />
						<AlertTitle>Unable to save renewal intent</AlertTitle>
						<AlertDescription>{submitErrorMessage}</AlertDescription>
					</Alert>
				) : null}

				<div className="space-y-3">
					<div className="space-y-1">
						<p className="font-medium text-sm">
							{renewal.canChangeIntent ? "Change intent" : "Available actions"}
						</p>
						<p
							className="text-muted-foreground text-sm"
							data-testid={`renewal-helper-copy-${mortgageId}`}
						>
							{helperCopy}
						</p>
					</div>

					{renewal.availableChoices.length > 0 ? (
						<div className="flex flex-wrap gap-2">
							{renewal.availableChoices.map(
								(choice: PortfolioLenderRenewalIntentChoice) => (
									<Button
										data-testid={`renewal-choice-${choice}-${mortgageId}`}
										disabled={isSubmitLocked}
										key={choice}
										onClick={() => this.handleChoiceClick(choice)}
										size="sm"
										type="button"
										variant={
											activeChoice === choice || choice === renewal.intent
												? "default"
												: "outline"
										}
									>
										{submittingChoice === choice ? (
											<LoaderCircle
												className="size-4 animate-spin"
												data-testid={`renewal-choice-pending-${choice}-${mortgageId}`}
											/>
										) : null}
										{getRenewalChoiceLabel(choice)}
									</Button>
								)
							)}
						</div>
					) : (
						<p
							className="text-muted-foreground text-sm"
							data-testid={`renewal-no-actions-${mortgageId}`}
						>
							No governed renewal actions are currently available.
						</p>
					)}

					{activeChoice === "partial_exit" ? (
						<PartialExitForm
							currentHeldFractions={renewal.currentHeldFractions}
							isDisabled={isSubmitLocked}
							isSubmitting={submittingChoice === "partial_exit"}
							minimumFractions={renewal.partialExitMinimumFractions}
							mortgageId={mortgageId}
							onChange={(value) =>
								this.setState({ partialExitFractions: value })
							}
							onSubmit={this.handlePartialExitSubmit}
							validationError={validationError}
							value={partialExitFractions}
							variant={variant}
						/>
					) : null}
				</div>
			</div>
		);
	}
}
