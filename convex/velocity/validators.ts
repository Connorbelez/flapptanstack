import { type Infer, v } from "convex/values";

const optionalNullableString = v.optional(v.union(v.string(), v.null()));
const optionalNullableNumber = v.optional(v.union(v.number(), v.null()));
const optionalNullableBoolean = v.optional(v.union(v.boolean(), v.null()));

export const velocityProviderValidator = v.literal("velocity");
export const velocityCoreSourceVersionValidator = v.literal("velocity_core_v1");

export const velocityPackageWorkspaceStateValidator = v.union(
	v.literal("in_progress"),
	v.literal("needs_fairlend_data"),
	v.literal("ready_for_review"),
	v.literal("final_review_required"),
	v.literal("ready_to_activate"),
	v.literal("activating"),
	v.literal("activation_failed_remediation"),
	v.literal("activated")
);

export const velocityPackageExceptionKindValidator = v.union(
	v.literal("identity_exception"),
	v.literal("upstream_sync_exception"),
	v.literal("unsupported_mapping_exception"),
	v.literal("upstream_changed_after_review"),
	v.literal("activation_exception"),
	v.literal("live_drift_exception")
);

export const velocityPackageExceptionStatusValidator = v.union(
	v.literal("open"),
	v.literal("resolved"),
	v.literal("superseded")
);

export const velocityPackageExceptionSeverityValidator = v.union(
	v.literal("info"),
	v.literal("warning"),
	v.literal("blocking"),
	v.literal("critical")
);

export const velocitySyncTriggerValidator = v.union(
	v.literal("webhook"),
	v.literal("manual_sync_now"),
	v.literal("mock_scenario"),
	v.literal("retry")
);

export const velocitySyncResultValidator = v.union(
	v.literal("succeeded"),
	v.literal("failed"),
	v.literal("duplicate_noop"),
	v.literal("exception")
);

export const velocityWebhookEventStatusValidator = v.union(
	v.literal("pending"),
	v.literal("processed"),
	v.literal("failed"),
	v.literal("ignored_duplicate")
);

export const velocityActivationAttemptStatusValidator = v.union(
	v.literal("queued"),
	v.literal("validating"),
	v.literal("creating_rotessa_customer"),
	v.literal("creating_rotessa_schedule"),
	v.literal("creating_canonical_mortgage"),
	v.literal("succeeded"),
	v.literal("failed")
);

export const velocitySnapshotTypeValidator = v.union(
	v.literal("upstream_core"),
	v.literal("final_review"),
	v.literal("activation_input"),
	v.literal("post_live_drift")
);

export const velocitySnapshotCreatorValidator = v.union(
	v.literal("webhook"),
	v.literal("manual_sync_now"),
	v.literal("activation"),
	v.literal("system")
);

export const velocityPackageDocumentRoleValidator = v.union(
	v.literal("pad_evidence"),
	v.literal("supporting_document"),
	v.literal("valuation"),
	v.literal("property_image")
);

export const velocityDealStatusCodeValidator = v.union(
	v.literal(0),
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6),
	v.literal(7),
	v.literal(8),
	v.literal(9),
	v.literal(10)
);

export const velocityPaymentFrequencyCodeValidator = v.union(
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6)
);

export const fairlendPaymentFrequencyValidator = v.union(
	v.literal("monthly"),
	v.literal("bi_weekly"),
	v.literal("accelerated_bi_weekly"),
	v.literal("weekly")
);

export const velocityRateTypeCodeValidator = v.union(
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5)
);

export const fairlendRateTypeValidator = v.union(
	v.literal("fixed"),
	v.literal("variable")
);

export const velocityMortgageRequestPurposeCodeValidator = v.union(
	v.literal(10),
	v.literal(20),
	v.literal(30)
);

export const velocityDateTypeCodeValidator = v.union(
	v.literal(1),
	v.literal(2)
);

export const velocityPropertyIntendedUseCodeValidator = v.union(
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4)
);

export const velocityStreetDirectionCodeValidator = v.union(
	v.literal(1),
	v.literal(2),
	v.literal(3),
	v.literal(4),
	v.literal(5),
	v.literal(6),
	v.literal(7),
	v.literal(8)
);

export const velocityConnectorCredentialContextValidator = v.object({
	apiKeyFingerprint: v.optional(v.string()),
	credentialId: v.optional(v.string()),
	email: optionalNullableString,
	firmCode: optionalNullableString,
	provider: velocityProviderValidator,
	scope: v.optional(v.string()),
	tenantId: optionalNullableString,
	usedFor: v.union(
		v.literal("webhook_ingress"),
		v.literal("full_deal_fetch"),
		v.literal("search_deals")
	),
	username: optionalNullableString,
});

export const velocityWebhookAgentValidator = v.object({
	email: optionalNullableString,
	firmCode: optionalNullableString,
	firstName: optionalNullableString,
	lastName: optionalNullableString,
	tenantId: optionalNullableString,
	username: optionalNullableString,
});

export const velocityWebhookPayloadValidator = v.object({
	agent: v.optional(v.union(velocityWebhookAgentValidator, v.null())),
	events: v.optional(
		v.union(
			v.array(
				v.object({
					deal: v.optional(
						v.union(
							v.object({
								loanCode: optionalNullableString,
								status: optionalNullableNumber,
							}),
							v.null()
						)
					),
					eventType: optionalNullableNumber,
					links: v.optional(
						v.union(
							v.array(
								v.object({
									href: optionalNullableString,
									method: optionalNullableString,
									rel: optionalNullableString,
								})
							),
							v.null()
						)
					),
					timestamp: optionalNullableString,
				})
			),
			v.null()
		)
	),
	timestamp: v.string(),
});

export const velocityAddressValidator = v.object({
	city: optionalNullableString,
	country: optionalNullableNumber,
	postalCode: optionalNullableString,
	provinceOrState: optionalNullableNumber,
	streetDirection: optionalNullableNumber,
	streetName: optionalNullableString,
	streetNumber: optionalNullableString,
	streetType: optionalNullableNumber,
	unitNumber: optionalNullableString,
});

export const velocityRawDealPayloadValidator = v.record(v.string(), v.any());

export const velocityNormalizedBorrowerValidator = v.object({
	businessPhone: optionalNullableString,
	cellPhone: optionalNullableString,
	creditScore: optionalNullableNumber,
	dateOfBirth: optionalNullableString,
	email: optionalNullableString,
	firstName: optionalNullableString,
	fullName: v.string(),
	homePhone: optionalNullableString,
	lastName: optionalNullableString,
	mailingAddress: v.optional(v.union(velocityAddressValidator, v.null())),
	primaryAddress: v.optional(v.union(velocityAddressValidator, v.null())),
});

export const velocityNormalizedCoreValidator = v.object({
	borrowers: v.array(velocityNormalizedBorrowerValidator),
	conditions: v.array(
		v.object({
			isApproved: v.optional(v.boolean()),
			isSent: v.optional(v.boolean()),
			name: v.string(),
		})
	),
	identity: v.object({
		customSource: optionalNullableString,
		lenderReferenceNumber: optionalNullableString,
		linkApplicationId: v.string(),
		loanCode: v.string(),
	}),
	lenderConditions: v.array(v.string()),
	mortgageRequest: v.object({
		amortization: optionalNullableNumber,
		amortizationMonths: optionalNullableNumber,
		buyDownRate: optionalNullableNumber,
		discountRate: optionalNullableNumber,
		fairlendPaymentFrequency: v.optional(
			v.union(fairlendPaymentFrequencyValidator, v.null())
		),
		fairlendRateType: v.optional(v.union(fairlendRateTypeValidator, v.null())),
		firstPaymentDate: optionalNullableString,
		interestAdjustmentDate: optionalNullableString,
		lenderName: optionalNullableString,
		maturityDate: optionalNullableString,
		netRate: optionalNullableNumber,
		paymentAmount: optionalNullableNumber,
		paymentFrequencyCode: optionalNullableNumber,
		paymentFrequencyLabel: optionalNullableString,
		premiumRate: optionalNullableNumber,
		purposeCode: optionalNullableNumber,
		purposeLabel: optionalNullableString,
		rate: optionalNullableNumber,
		rateTypeCode: optionalNullableNumber,
		rateTypeLabel: optionalNullableString,
		requestedPrincipal: optionalNullableNumber,
		termInMonths: optionalNullableNumber,
	}),
	normalizedHash: v.string(),
	notes: v.array(
		v.object({
			dateCreated: optionalNullableString,
			text: v.string(),
		})
	),
	rawDealHash: v.string(),
	referral: v.optional(v.union(v.record(v.string(), v.any()), v.null())),
	solicitor: v.optional(v.union(v.record(v.string(), v.any()), v.null())),
	sourceVersion: velocityCoreSourceVersionValidator,
	subjectProperty: v.object({
		city: optionalNullableString,
		constructionType: optionalNullableString,
		intendedUseCode: optionalNullableNumber,
		intendedUseLabel: optionalNullableString,
		postalCode: optionalNullableString,
		propertyTypeRaw: optionalNullableString,
		province: optionalNullableString,
		provinceCode: optionalNullableNumber,
		purchasePrice: optionalNullableNumber,
		streetDirectionCode: optionalNullableNumber,
		streetName: optionalNullableString,
		streetNumber: optionalNullableString,
		streetTypeCode: optionalNullableNumber,
		tenure: optionalNullableString,
		unit: optionalNullableString,
	}),
	upstream: v.object({
		agent: optionalNullableString,
		closingDate: optionalNullableString,
		dateCreated: optionalNullableString,
		isConfirmedCompliant: optionalNullableBoolean,
		statusCode: v.union(v.number(), v.null()),
		statusLabel: v.union(v.string(), v.null()),
	}),
});

export const velocityLoanTypeValidator = v.union(
	v.literal("conventional"),
	v.literal("insured"),
	v.literal("high_ratio")
);

export const velocityActivationRemediationValidator = v.object({
	assignedBrokerId: v.optional(v.id("brokers")),
	borrowerRoleOverrides: v.optional(
		v.array(
			v.object({
				borrowerExternalKey: v.string(),
				role: v.union(
					v.literal("primary"),
					v.literal("co_borrower"),
					v.literal("guarantor")
				),
			})
		)
	),
	brokerOfRecordId: v.optional(v.id("brokers")),
	lienPosition: v.optional(v.number()),
	loanType: v.optional(velocityLoanTypeValidator),
	notes: v.optional(v.string()),
	policyInputs: v.optional(v.record(v.string(), v.any())),
});

export const velocityFairLendEnrichmentValidator = v.object({
	activationRemediation: v.optional(velocityActivationRemediationValidator),
	bankInput: v.optional(
		v.object({
			accountHolderName: v.optional(v.string()),
			accountLast4: v.optional(v.string()),
			accountNumber: v.optional(v.string()),
			country: v.literal("CA"),
			currency: v.literal("CAD"),
			institutionNumber: v.optional(v.string()),
			transitNumber: v.optional(v.string()),
		})
	),
	listingOverrides: v.optional(
		v.object({
			adminNotes: v.optional(v.string()),
			description: v.optional(v.string()),
			displayOrder: v.optional(v.number()),
			featured: v.optional(v.boolean()),
			heroImages: v.optional(
				v.array(
					v.object({
						caption: v.optional(v.string()),
						storageId: v.string(),
					})
				)
			),
			marketplaceCopy: v.optional(v.string()),
			seoSlug: v.optional(v.string()),
			title: v.optional(v.string()),
		})
	),
	padEvidence: v.optional(
		v.object({
			documentAssetId: v.id("documentAssets"),
			fileHash: v.string(),
			mimeType: v.literal("application/pdf"),
			originalFilename: v.string(),
			uploadedAt: v.number(),
			uploadedByUserId: v.id("users"),
		})
	),
	staffNotes: v.optional(v.string()),
	valuation: v.optional(
		v.object({
			comparables: v.optional(v.array(v.record(v.string(), v.any()))),
			relatedDocumentAssetId: v.optional(v.id("documentAssets")),
			valuationDate: v.optional(v.string()),
			valueAsIs: v.optional(v.number()),
		})
	),
});

export const velocityReadinessBlockerCodeValidator = v.union(
	v.literal("missing_link_application_id"),
	v.literal("identity_collision"),
	v.literal("velocity_not_funded"),
	v.literal("velocity_complete_before_activation"),
	v.literal("unsupported_velocity_status"),
	v.literal("unsupported_payment_frequency"),
	v.literal("missing_required_core_field"),
	v.literal("missing_fairlend_owned_field"),
	v.literal("missing_bank_data"),
	v.literal("missing_pad_pdf"),
	v.literal("upstream_changed_after_review"),
	v.literal("activation_in_progress"),
	v.literal("live_mortgage_exists")
);

export const velocityReadinessBlockerValidator = v.object({
	code: velocityReadinessBlockerCodeValidator,
	fieldPath: v.optional(v.string()),
	message: v.string(),
	severity: v.union(v.literal("blocking"), v.literal("warning")),
	source: v.union(
		v.literal("velocity"),
		v.literal("fairlend"),
		v.literal("system")
	),
});

export const velocityReadinessValidator = v.object({
	blockers: v.array(velocityReadinessBlockerValidator),
	canActivate: v.boolean(),
	canFinalReview: v.boolean(),
	warnings: v.array(
		v.object({
			code: v.string(),
			fieldPath: v.optional(v.string()),
			message: v.string(),
		})
	),
});

export const velocityFinalReviewValidator = v.object({
	reviewedAt: v.number(),
	reviewedByUserId: v.id("users"),
	reviewedSnapshotHash: v.string(),
	reviewedSnapshotId: v.id("velocityPackageSnapshots"),
});

export const velocityWorkspaceActivationSummaryValidator = v.object({
	activatedAt: v.optional(v.number()),
	activatedByUserId: v.optional(v.id("users")),
	activationAttemptId: v.optional(v.id("velocityActivationAttempts")),
	listingId: v.optional(v.id("listings")),
	mortgageId: v.optional(v.id("mortgages")),
});

export const velocityPackageAuditEventTypeValidator = v.union(
	v.literal("velocity_webhook_received"),
	v.literal("velocity_webhook_provenance_recorded"),
	v.literal("velocity_full_deal_fetch_attempted"),
	v.literal("velocity_full_deal_fetch_failed"),
	v.literal("velocity_normalized"),
	v.literal("velocity_identity_validated"),
	v.literal("velocity_identity_exception_opened"),
	v.literal("velocity_fairlend_enrichment_updated"),
	v.literal("velocity_document_linked"),
	v.literal("velocity_readiness_recomputed"),
	v.literal("velocity_final_review_confirmed"),
	v.literal("velocity_activation_attempt_started"),
	v.literal("velocity_activation_stage_changed"),
	v.literal("velocity_activation_failed"),
	v.literal("velocity_activation_succeeded"),
	v.literal("velocity_post_live_drift_detected")
);

export type VelocityNormalizedCoreValue = Infer<
	typeof velocityNormalizedCoreValidator
>;
export type VelocityFairLendEnrichmentValue = Infer<
	typeof velocityFairLendEnrichmentValidator
>;
export type VelocityReadinessValue = Infer<typeof velocityReadinessValidator>;
