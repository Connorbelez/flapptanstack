export interface DealDocumentSigningRecipientPresentation {
	name: string;
	providerRole?: string | null;
	signingOrder: number;
	status: string;
}

export interface DealDocumentSigningSurfacePresentation {
	envelopeId?: string | null;
	generatedDocumentSigningStatus?: string | null;
	recipients?: readonly DealDocumentSigningRecipientPresentation[] | null;
	status?: string | null;
}

export interface SignableDealDocumentPresentation {
	archivedAt?: number | null;
	class: string;
	status: string;
}

export function groupSignableDealDocuments<
	TDocument extends SignableDealDocumentPresentation,
>(documents: readonly TDocument[]) {
	const signableDocuments = documents.filter(
		(document) => document.class === "private_templated_signable"
	);

	return {
		activeSignableDocuments: signableDocuments.filter(
			(document) => !isArchivedSignableDealDocument(document)
		),
		archivedSignableDocuments: signableDocuments.filter((document) =>
			isArchivedSignableDealDocument(document)
		),
	};
}

export function describeSigningProgress(
	signing: DealDocumentSigningSurfacePresentation | null | undefined
) {
	if (!signing) {
		return "Envelope has not been created yet.";
	}

	const status =
		signing.status ?? signing.generatedDocumentSigningStatus ?? null;
	const recipients = signing.recipients ?? [];

	switch (status) {
		case "draft":
			return "Envelope is still in draft.";
		case "provider_error":
			return "Provider error needs resolution before signing can continue.";
		case "voided":
			return "Envelope has been voided.";
		case "declined":
			return "Envelope has been declined.";
		case "completed":
			return "Envelope is completed.";
		case "sent":
		case "partially_signed":
			if (!signing.envelopeId) {
				return "Envelope has not been created yet.";
			}
			return describeActiveSigningRecipients(recipients);
		default:
			if (!signing.envelopeId) {
				return "Envelope has not been created yet.";
			}
			if (recipients.length === 0) {
				return "Recipient routing has not been resolved for this signable document yet.";
			}
			return describeActiveSigningRecipients(recipients);
	}
}

function isArchivedSignableDealDocument(
	document: SignableDealDocumentPresentation
) {
	return document.status === "archived" || document.archivedAt != null;
}

function describeActiveSigningRecipients(
	recipients: readonly DealDocumentSigningRecipientPresentation[]
) {
	if (recipients.length === 0) {
		return "Recipient routing has not been resolved for this signable document yet.";
	}

	const incompleteRecipients = recipients.filter(
		(recipient) => recipient.status !== "signed"
	);

	if (incompleteRecipients.length === 0) {
		return "All recipients complete; awaiting provider completion sync.";
	}

	const nextSigningOrder = Math.min(
		...incompleteRecipients.map((recipient) => recipient.signingOrder)
	);
	const waitingRecipients = incompleteRecipients.filter(
		(recipient) => recipient.signingOrder === nextSigningOrder
	);

	return `Waiting on: ${waitingRecipients.map(formatRecipientLabel).join(", ")}`;
}

function formatRecipientLabel(
	recipient: DealDocumentSigningRecipientPresentation
) {
	if (!recipient.providerRole) {
		return recipient.name;
	}

	return `${recipient.name} (${recipient.providerRole})`;
}
