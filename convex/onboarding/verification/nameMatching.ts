import type {
	BrokerOnboardingPersonNameInput,
	VerificationNameSimilarityScores,
} from "../../../shared/brokerOnboarding/contracts";
import {
	calculateEffectiveSimilarityScore,
	normalizeBrokerOnboardingPersonName,
} from "../../../shared/brokerOnboarding/contracts";

function jaroSimilarity(left: string, right: string) {
	if (left === right) {
		return 1;
	}
	if (left.length === 0 || right.length === 0) {
		return 0;
	}

	const matchDistance = Math.max(
		Math.floor(Math.max(left.length, right.length) / 2) - 1,
		0
	);
	const leftMatches = new Array<boolean>(left.length).fill(false);
	const rightMatches = new Array<boolean>(right.length).fill(false);
	let matches = 0;

	for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
		const start = Math.max(0, leftIndex - matchDistance);
		const end = Math.min(leftIndex + matchDistance + 1, right.length);

		for (let rightIndex = start; rightIndex < end; rightIndex += 1) {
			if (rightMatches[rightIndex] || left[leftIndex] !== right[rightIndex]) {
				continue;
			}

			leftMatches[leftIndex] = true;
			rightMatches[rightIndex] = true;
			matches += 1;
			break;
		}
	}

	if (matches === 0) {
		return 0;
	}

	let transpositions = 0;
	let rightCursor = 0;
	for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
		if (!leftMatches[leftIndex]) {
			continue;
		}

		while (!rightMatches[rightCursor]) {
			rightCursor += 1;
		}

		if (left[leftIndex] !== right[rightCursor]) {
			transpositions += 1;
		}
		rightCursor += 1;
	}

	return (
		(matches / left.length +
			matches / right.length +
			(matches - transpositions / 2) / matches) /
		3
	);
}

export function jaroWinklerSimilarity(
	left: string,
	right: string,
	options: {
		maxPrefixLength?: number;
		prefixScale?: number;
	} = {}
) {
	const prefixScale = options.prefixScale ?? 0.1;
	const maxPrefixLength = options.maxPrefixLength ?? 4;
	const jaro = jaroSimilarity(left, right);

	if (jaro === 0) {
		return 0;
	}

	let prefixLength = 0;
	for (
		let index = 0;
		index < Math.min(maxPrefixLength, left.length, right.length);
		index += 1
	) {
		if (left[index] !== right[index]) {
			break;
		}
		prefixLength += 1;
	}

	return jaro + prefixLength * prefixScale * (1 - jaro);
}

export function compareNormalizedBrokerOnboardingNames(
	left: BrokerOnboardingPersonNameInput | null | undefined,
	right: BrokerOnboardingPersonNameInput | null | undefined
) {
	const normalizedLeft = normalizeBrokerOnboardingPersonName(left);
	const normalizedRight = normalizeBrokerOnboardingPersonName(right);

	if (
		!(
			normalizedLeft.firstName &&
			normalizedLeft.lastName &&
			normalizedRight.firstName &&
			normalizedRight.lastName
		)
	) {
		return null;
	}

	return Math.min(
		jaroWinklerSimilarity(normalizedLeft.firstName, normalizedRight.firstName),
		jaroWinklerSimilarity(normalizedLeft.lastName, normalizedRight.lastName)
	);
}

export function computeBrokerOnboardingNameSimilarityScores(args: {
	identityName: BrokerOnboardingPersonNameInput | null | undefined;
	regulatorName: BrokerOnboardingPersonNameInput | null | undefined;
	selfReportedName: BrokerOnboardingPersonNameInput | null | undefined;
}): VerificationNameSimilarityScores {
	const similarityScores: VerificationNameSimilarityScores = {
		selfReportedVsRegulator: compareNormalizedBrokerOnboardingNames(
			args.selfReportedName,
			args.regulatorName
		),
		selfReportedVsIdentity: compareNormalizedBrokerOnboardingNames(
			args.selfReportedName,
			args.identityName
		),
		regulatorVsIdentity: compareNormalizedBrokerOnboardingNames(
			args.regulatorName,
			args.identityName
		),
		effectiveScore: null,
	};

	return {
		...similarityScores,
		effectiveScore: calculateEffectiveSimilarityScore(similarityScores),
	};
}
