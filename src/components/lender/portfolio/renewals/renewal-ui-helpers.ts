import { formatPortfolioEnumLabel } from "../portfolio-formatters";
import type {
	PortfolioLenderRenewalIntentChoice,
	PortfolioLenderRenewalIntentRecord,
} from "../portfolio-types";

export function getRenewalChoiceLabel(
	choice: PortfolioLenderRenewalIntentChoice
) {
	switch (choice) {
		case "partial_exit":
			return "Partial Exit";
		default:
			return formatPortfolioEnumLabel(choice);
	}
}

export function getRenewalBlockedReasonDescription(
	reason: PortfolioLenderRenewalIntentRecord["actionBlockedReason"]
) {
	switch (reason) {
		case "position_sold":
			return "This lender no longer holds an actionable position for this mortgage.";
		case "matured":
			return "This mortgage has already matured. The recorded renewal intent stays visible for reference, but it can no longer be changed.";
		case "expired":
			return "The renewal signal deadline has passed. The recorded intent stays visible, but it is no longer actionable.";
		default:
			return null;
	}
}

export interface RenewalDraftState {
	activeChoice: PortfolioLenderRenewalIntentChoice | null;
	partialExitFractions: string;
	remoteStateKey: string | null;
	validationError?: string;
}

export function getRenewalRemoteStateKey(
	renewal: PortfolioLenderRenewalIntentRecord | null
) {
	if (!renewal) {
		return null;
	}

	return [
		renewal.intent ?? "none",
		renewal.status,
		String(renewal.signalledAt ?? renewal.recordedAt),
		String(renewal.partialExitFractions ?? "none"),
		renewal.actionBlockedReason ?? "none",
		renewal.availableChoices.join(","),
	].join("|");
}

export function reconcileRenewalDraftState(args: {
	draftState: RenewalDraftState;
	renewal: PortfolioLenderRenewalIntentRecord | null;
}): RenewalDraftState {
	if (!args.renewal) {
		return {
			activeChoice: null,
			partialExitFractions: "",
			remoteStateKey: null,
			validationError: undefined,
		};
	}

	const remoteStateKey = getRenewalRemoteStateKey(args.renewal);
	const hasRemoteStateChanged =
		args.draftState.remoteStateKey !== null &&
		args.draftState.remoteStateKey !== remoteStateKey;

	let activeChoice = args.draftState.activeChoice;
	let partialExitFractions = args.draftState.partialExitFractions;
	let validationError = args.draftState.validationError;

	if (activeChoice && !args.renewal.availableChoices.includes(activeChoice)) {
		activeChoice = null;
		validationError = undefined;
	}

	if (hasRemoteStateChanged) {
		activeChoice = null;
		validationError = undefined;
	}

	if (args.renewal.intent === "partial_exit") {
		partialExitFractions =
			typeof args.renewal.partialExitFractions === "number"
				? String(args.renewal.partialExitFractions)
				: "";
	} else if (hasRemoteStateChanged && partialExitFractions.length > 0) {
		partialExitFractions = "";
	}

	return {
		activeChoice,
		partialExitFractions,
		remoteStateKey,
		validationError,
	};
}

interface ValidateRenewalPartialExitArgs {
	currentHeldFractions: number;
	minimumFractions: number;
	value: string;
}

export function validateRenewalPartialExit(
	args: ValidateRenewalPartialExitArgs
) {
	if (!args.value.trim()) {
		return "Enter the number of fractions to exit.";
	}

	const parsed = Number(args.value);
	if (!Number.isInteger(parsed)) {
		return "Partial exit fractions must be a whole number.";
	}

	if (parsed < args.minimumFractions) {
		return `Partial exit must be at least ${args.minimumFractions} fractions.`;
	}

	if (parsed > args.currentHeldFractions) {
		return "Partial exit cannot exceed the lender's current held position.";
	}

	return null;
}
