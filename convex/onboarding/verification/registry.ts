import {
	normalizeBrokerOnboardingProvince,
	type VerificationEvidenceReference,
} from "../../../shared/brokerOnboarding/contracts";
import {
	type BrokerOnboardingVerificationConfig,
	type BrokerOnboardingVerificationConfigOverrides,
	type EmailVerificationProviderMode,
	type IdentityVerificationProviderMode,
	type RegulatorDirectoryProviderMode,
	resolveBrokerOnboardingVerificationConfig,
} from "./config";
import type {
	BrokerOnboardingVerificationServices,
	EmailVerificationContract,
	IdentityVerificationProvider,
	RegulatorDirectoryProvider,
} from "./interface";
import { createImportedFsraRegulatorProvider } from "./providers/importedFsra";
import { createMockIdentityVerificationProvider } from "./providers/mockIdentity";
import { createMockRegulatorDirectoryProvider } from "./providers/mockRegulator";
import { createWorkosEmailVerificationContract } from "./workosEmailVerification";

function buildProviderEvidenceReference(
	provider: string,
	referenceId: string,
	capturedAt: number
): VerificationEvidenceReference {
	return {
		provider,
		referenceId,
		referenceType: "provider_snapshot",
		capturedAt,
		label: `${provider} provider availability`,
	};
}

function createUnavailableRegulatorDirectoryProvider(
	mode: RegulatorDirectoryProviderMode
): RegulatorDirectoryProvider {
	const providerKey = `${mode}_regulator`;

	return {
		mode,
		providerKey,
		async lookupLicense(request) {
			return {
				provider: providerKey,
				status: "provider_unavailable",
				freshness: "unknown",
				licenseNumber: request.licenseNumber,
				licenseProvince: normalizeBrokerOnboardingProvince(request.province),
				legalName: null,
				checkedAt: request.requestedAt,
				dataAsOf: null,
				evidenceReferences: [
					buildProviderEvidenceReference(
						providerKey,
						`${providerKey}:${request.licenseNumber}`,
						request.requestedAt
					),
				],
			};
		},
	};
}

function createUnavailableIdentityVerificationProvider(
	mode: IdentityVerificationProviderMode
): IdentityVerificationProvider {
	const providerKey = `${mode}_identity`;

	function buildUnavailableResult(sessionId: string, capturedAt: number) {
		return {
			provider: providerKey,
			status: "provider_unavailable" as const,
			legalName: null,
			checkedAt: capturedAt,
			completedAt: null,
			fraudSignal: false,
			evidenceReferences: [
				buildProviderEvidenceReference(providerKey, sessionId, capturedAt),
			],
		};
	}

	return {
		mode,
		providerKey,
		async getReview(request) {
			return buildUnavailableResult(request.sessionId, request.reviewedAt);
		},
		async handleCallback(request) {
			return buildUnavailableResult(
				request.sessionId ?? `${providerKey}:${request.applicationId}`,
				request.receivedAt
			);
		},
		async startVerification(request) {
			return {
				providerKey,
				sessionId: `${providerKey}:${request.applicationId}`,
				status: "provider_unavailable",
			};
		},
	};
}

export interface BrokerOnboardingVerificationRegistryOptions {
	config?: BrokerOnboardingVerificationConfig;
	configOverrides?: BrokerOnboardingVerificationConfigOverrides;
	emailContracts?: Partial<
		Record<EmailVerificationProviderMode, EmailVerificationContract>
	>;
	identityProviders?: Partial<
		Record<IdentityVerificationProviderMode, IdentityVerificationProvider>
	>;
	regulatorProviders?: Partial<
		Record<RegulatorDirectoryProviderMode, RegulatorDirectoryProvider>
	>;
}

export interface BrokerOnboardingVerificationRegistry
	extends BrokerOnboardingVerificationServices {
	resolveEmailVerificationContract(
		mode: EmailVerificationProviderMode
	): EmailVerificationContract;
	resolveIdentityVerificationProvider(
		mode: IdentityVerificationProviderMode
	): IdentityVerificationProvider;
	resolveRegulatorDirectoryProvider(
		mode: RegulatorDirectoryProviderMode
	): RegulatorDirectoryProvider;
}

export function createBrokerOnboardingVerificationRegistry(
	options: BrokerOnboardingVerificationRegistryOptions = {}
): BrokerOnboardingVerificationRegistry {
	const config =
		options.config ??
		resolveBrokerOnboardingVerificationConfig(options.configOverrides);

	const regulatorProviders: Record<
		RegulatorDirectoryProviderMode,
		RegulatorDirectoryProvider
	> = {
		mock: createMockRegulatorDirectoryProvider(),
		imported_fsra: createImportedFsraRegulatorProvider(),
		live: createUnavailableRegulatorDirectoryProvider("live"),
		...options.regulatorProviders,
	};

	const identityProviders: Record<
		IdentityVerificationProviderMode,
		IdentityVerificationProvider
	> = {
		mock: createMockIdentityVerificationProvider(),
		sandbox: createUnavailableIdentityVerificationProvider("sandbox"),
		live: createUnavailableIdentityVerificationProvider("live"),
		...options.identityProviders,
	};

	const emailContracts: Record<
		EmailVerificationProviderMode,
		EmailVerificationContract
	> = {
		workos: createWorkosEmailVerificationContract(),
		...options.emailContracts,
	};

	return {
		config,
		regulatorDirectory: regulatorProviders[config.providers.regulatorDirectory],
		identityVerification:
			identityProviders[config.providers.identityVerification],
		emailVerification: emailContracts[config.providers.emailVerification],
		resolveRegulatorDirectoryProvider(mode) {
			return regulatorProviders[mode];
		},
		resolveIdentityVerificationProvider(mode) {
			return identityProviders[mode];
		},
		resolveEmailVerificationContract(mode) {
			return emailContracts[mode];
		},
	};
}
