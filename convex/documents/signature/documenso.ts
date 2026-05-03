import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type {
	SignatureEnvelopeStatus,
	SignatureProviderRole,
	SignatureRecipientStatus,
} from "../contracts";
import type {
	SignatureProvider,
	SignatureProviderCreateEnvelopeInput,
	SignatureProviderCreateEnvelopeResult,
	SignatureProviderDownloadCompletedArtifactsInput,
	SignatureProviderDownloadCompletedArtifactsResult,
	SignatureProviderField,
	SignatureProviderPreflightError,
	SignatureProviderPreflightErrorCode,
	SignatureProviderPreflightResult,
	SignatureProviderRecipientInput,
	SignatureProviderSyncEnvelopeResult,
} from "./provider";

const DEFAULT_DOCUMENSO_API_BASE_URL = "https://app.documenso.com/api/v2";
const DEFAULT_DOCUMENSO_APP_BASE_URL = "https://app.documenso.com";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_SIGNING_URL_TTL_MS = 15 * 60 * 1000;
const DOCUMENSO_API_SUFFIX_RE = /\/api\/v2\/?$/;
const DOCUMENSO_API_PATH_RE = /\/api(?:\/.*)?$/;

export interface DocumensoSignatureProviderFactoryOptions {
	fetchFn?: typeof fetch;
	getStorageBlob: (storageId: Id<"_storage">) => Promise<Blob | null>;
	now?: () => number;
}

interface DocumensoConfig {
	apiBaseUrl: string;
	apiKey: string;
	appBaseUrl: string;
	fetchFn: typeof fetch;
	getStorageBlob: (storageId: Id<"_storage">) => Promise<Blob | null>;
	now: () => number;
	timeoutMs: number;
}

interface DocumensoEnvelopeResponse {
	completedAt?: string | null;
	envelopeItems?: DocumensoEnvelopeItemResponse[];
	id: string;
	recipients?: DocumensoRecipientResponse[];
	status: string;
	updatedAt?: string | null;
}

interface DocumensoEnvelopeItemResponse {
	id: string;
	name?: string | null;
	type?: string | null;
}

interface DocumensoRecipientResponse {
	email: string;
	id: number | string;
	name: string;
	readStatus?: string | null;
	role?: string | null;
	sendStatus?: string | null;
	signedAt?: string | null;
	signingOrder?: number | null;
	signingStatus?: string | null;
	signingUrl?: string | null;
	token?: string | null;
}

interface DocumensoDistributeEnvelopeResponse {
	id: string;
	recipients?: DocumensoRecipientResponse[];
	success: boolean;
}

interface DocumensoCreateEnvelopeResponse {
	id: string;
}

interface DocumensoDeleteEnvelopeResponse {
	success: boolean;
}

type DocumensoFieldMetaType =
	| "checkbox"
	| "date"
	| "dropdown"
	| "email"
	| "free_signature"
	| "initials"
	| "name"
	| "number"
	| "radio"
	| "signature"
	| "text";

const DOCUMENSO_SUPPORTED_FIELD_TYPES = new Set([
	"CHECKBOX",
	"DATE",
	"DROPDOWN",
	"EMAIL",
	"FREE_SIGNATURE",
	"INITIALS",
	"NAME",
	"NUMBER",
	"RADIO",
	"SIGNATURE",
	"TEXT",
]);

interface DocumensoFieldMeta {
	placeholder?: string;
	readOnly?: boolean;
	required: boolean;
	type: DocumensoFieldMetaType;
}

export class DocumensoConfigError extends Error {
	name = "DocumensoConfigError";
}

export class DocumensoApiError extends Error {
	name = "DocumensoApiError";
	method: string;
	path: string;
	responseText?: string;
	status: number;

	constructor(args: {
		message: string;
		method: string;
		path: string;
		responseText?: string;
		status: number;
	}) {
		super(args.message);
		this.method = args.method;
		this.path = args.path;
		this.responseText = args.responseText;
		this.status = args.status;
	}
}

export class DocumensoRequestError extends Error {
	name = "DocumensoRequestError";
	cause?: unknown;
	method: string;
	path: string;

	constructor(args: {
		cause?: unknown;
		message: string;
		method: string;
		path: string;
	}) {
		super(args.message);
		this.cause = args.cause;
		this.method = args.method;
		this.path = args.path;
	}
}

function resolveConfig(
	input: DocumensoSignatureProviderFactoryOptions
): DocumensoConfig {
	const apiKey =
		process.env.DOCUMENSO_API_TOKEN ?? process.env.DOCUMENSO_API_KEY;
	if (!apiKey) {
		throw new DocumensoConfigError(
			"Missing DOCUMENSO_API_TOKEN or DOCUMENSO_API_KEY. Configure the Documenso API credential before creating signature envelopes."
		);
	}

	const apiBaseUrl =
		process.env.DOCUMENSO_API_BASE_URL ?? DEFAULT_DOCUMENSO_API_BASE_URL;
	const derivedAppBaseUrl = apiBaseUrl
		.replace(DOCUMENSO_API_SUFFIX_RE, "")
		.replace(DOCUMENSO_API_PATH_RE, "");
	const appBaseUrl =
		process.env.DOCUMENSO_APP_BASE_URL ??
		(derivedAppBaseUrl !== apiBaseUrl
			? derivedAppBaseUrl
			: DEFAULT_DOCUMENSO_APP_BASE_URL);
	const timeoutMs =
		process.env.DOCUMENSO_TIMEOUT_MS &&
		Number.parseInt(process.env.DOCUMENSO_TIMEOUT_MS, 10) > 0
			? Number.parseInt(process.env.DOCUMENSO_TIMEOUT_MS, 10)
			: DEFAULT_TIMEOUT_MS;

	return {
		apiBaseUrl,
		apiKey,
		appBaseUrl,
		fetchFn: input.fetchFn ?? fetch,
		getStorageBlob: input.getStorageBlob,
		now: input.now ?? Date.now,
		timeoutMs,
	};
}

function buildApiUrl(config: DocumensoConfig, path: string) {
	const normalizedBase = config.apiBaseUrl.endsWith("/")
		? config.apiBaseUrl.slice(0, -1)
		: config.apiBaseUrl;
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	return `${normalizedBase}${normalizedPath}`;
}

function sanitizeFileName(value: string) {
	const cleaned = value.trim().replace(/[^a-z0-9._-]+/gi, "-");
	return cleaned.length > 0 ? cleaned : "document";
}

function parseTimestamp(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeSigningUrl(
	config: DocumensoConfig,
	recipient: DocumensoRecipientResponse | undefined
) {
	if (!recipient) {
		return undefined;
	}

	if (recipient.signingUrl) {
		return recipient.signingUrl;
	}

	if (!recipient.token) {
		return undefined;
	}

	return `${config.appBaseUrl}/sign/${recipient.token}`;
}

function mapDocumensoRecipientStatus(
	recipient: DocumensoRecipientResponse
): SignatureRecipientStatus {
	const signingStatus = recipient.signingStatus?.toUpperCase();
	if (signingStatus === "SIGNED") {
		return "signed";
	}
	if (signingStatus === "REJECTED") {
		return "declined";
	}

	return recipient.readStatus?.toUpperCase() === "OPENED"
		? "opened"
		: "pending";
}

function mapDocumensoEnvelopeStatus(
	envelopeStatus: string,
	recipients: DocumensoRecipientResponse[]
): SignatureEnvelopeStatus {
	switch (envelopeStatus.toUpperCase()) {
		case "DRAFT":
			return "draft";
		case "PENDING":
			return recipients.some(
				(recipient) => recipient.signingStatus?.toUpperCase() === "SIGNED"
			)
				? "partially_signed"
				: "sent";
		case "COMPLETED":
			return "completed";
		case "REJECTED":
			return "declined";
		case "CANCELLED":
		case "VOIDED":
			return "voided";
		default:
			return "provider_error";
	}
}

function mapDocumensoProviderRole(
	role: string | null | undefined
): SignatureProviderRole {
	const normalizedRole = role?.toUpperCase();
	if (normalizedRole === "APPROVER") {
		return "APPROVER";
	}
	if (normalizedRole === "VIEWER") {
		return "VIEWER";
	}
	return "SIGNER";
}

function toDocumensoFieldMetaType(type: string): DocumensoFieldMetaType {
	switch (type.toUpperCase()) {
		case "CHECKBOX":
			return "checkbox";
		case "DATE":
			return "date";
		case "DROPDOWN":
			return "dropdown";
		case "EMAIL":
			return "email";
		case "FREE_SIGNATURE":
			return "free_signature";
		case "INITIALS":
			return "initials";
		case "NAME":
			return "name";
		case "NUMBER":
			return "number";
		case "RADIO":
			return "radio";
		case "SIGNATURE":
			return "signature";
		case "TEXT":
			return "text";
		default:
			throw new DocumensoConfigError(
				`Unsupported Documenso field type "${type}"`
			);
	}
}

function toDocumensoFieldMeta(
	field: SignatureProviderField
): DocumensoFieldMeta {
	return {
		...(field.fieldMeta?.placeholder
			? { placeholder: field.fieldMeta.placeholder }
			: {}),
		...(field.fieldMeta?.readOnly !== undefined
			? { readOnly: field.fieldMeta.readOnly }
			: {}),
		required: field.required,
		type: toDocumensoFieldMetaType(field.type),
	};
}

function fieldPath(args: {
	fieldIndex: number;
	recipientIndex: number;
	property?: string;
}) {
	return `recipients.${args.recipientIndex}.fields.${args.fieldIndex}${
		args.property ? `.${args.property}` : ""
	}`;
}

function addPreflightError(
	errors: SignatureProviderPreflightError[],
	args: {
		code: SignatureProviderPreflightErrorCode;
		fieldIdentifier?: number | string;
		message: string;
		path: string;
		platformRole?: string;
	}
) {
	errors.push({
		code: args.code,
		...(args.fieldIdentifier !== undefined
			? { fieldIdentifier: args.fieldIdentifier }
			: {}),
		message: args.message,
		path: args.path,
		...(args.platformRole ? { platformRole: args.platformRole } : {}),
	});
}

function isPercentValue(value: number) {
	return Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasValidSizePercent(value: number) {
	return Number.isFinite(value) && value > 0 && value <= 100;
}

function validateFieldMeta(
	errors: SignatureProviderPreflightError[],
	recipient: SignatureProviderRecipientInput,
	field: SignatureProviderField,
	recipientIndex: number,
	fieldIndex: number
) {
	if (!field.fieldMeta) {
		return;
	}

	const meta = field.fieldMeta;
	if (
		(meta.placeholder !== undefined && typeof meta.placeholder !== "string") ||
		(meta.helpText !== undefined && typeof meta.helpText !== "string") ||
		(meta.readOnly !== undefined && typeof meta.readOnly !== "boolean")
	) {
		addPreflightError(errors, {
			code: "invalid_field_meta",
			fieldIdentifier: field.identifier,
			message: `Documenso field metadata is invalid for ${recipient.platformRole}.`,
			path: fieldPath({
				fieldIndex,
				property: "fieldMeta",
				recipientIndex,
			}),
			platformRole: recipient.platformRole,
		});
	}
}

function validateDocumensoEnvelopePreflight(
	input: SignatureProviderCreateEnvelopeInput
): SignatureProviderPreflightResult {
	const errors: SignatureProviderPreflightError[] = [];

	input.recipients.forEach((recipient, recipientIndex) => {
		if (!(recipient.name.trim() && recipient.email.trim())) {
			addPreflightError(errors, {
				code: "recipient_missing_identity",
				message: `Documenso recipient ${recipient.platformRole} is missing a name or email.`,
				path: `recipients.${recipientIndex}`,
				platformRole: recipient.platformRole,
			});
		}

		let hasSignatureField = false;
		recipient.fields.forEach((field, fieldIndex) => {
			const normalizedType = field.type.trim().toUpperCase();
			const currentFieldPath = fieldPath({ fieldIndex, recipientIndex });
			if (!DOCUMENSO_SUPPORTED_FIELD_TYPES.has(normalizedType)) {
				addPreflightError(errors, {
					code: "invalid_field_type",
					fieldIdentifier: field.identifier,
					message: `Unsupported Documenso field type "${field.type}" for ${recipient.platformRole}.`,
					path: `${currentFieldPath}.type`,
					platformRole: recipient.platformRole,
				});
			}

			if (
				normalizedType === "SIGNATURE" ||
				normalizedType === "FREE_SIGNATURE"
			) {
				hasSignatureField = true;
			}

			if (!Number.isInteger(field.pageNumber) || field.pageNumber < 1) {
				addPreflightError(errors, {
					code: "invalid_page",
					fieldIdentifier: field.identifier,
					message: `Documenso field page must be a 1-based integer for ${recipient.platformRole}.`,
					path: `${currentFieldPath}.pageNumber`,
					platformRole: recipient.platformRole,
				});
			}

			const hasValidPosition =
				isPercentValue(field.positionX) &&
				isPercentValue(field.positionY) &&
				hasValidSizePercent(field.width) &&
				hasValidSizePercent(field.height);
			if (!hasValidPosition) {
				addPreflightError(errors, {
					code: "invalid_position",
					fieldIdentifier: field.identifier,
					message: `Documenso field position must use percentage coordinates and positive percentage size for ${recipient.platformRole}.`,
					path: currentFieldPath,
					platformRole: recipient.platformRole,
				});
			}

			validateFieldMeta(errors, recipient, field, recipientIndex, fieldIndex);
		});

		if (recipient.providerRole === "SIGNER" && !hasSignatureField) {
			addPreflightError(errors, {
				code: "signer_missing_signature_field",
				message: `Documenso signer recipient ${recipient.name} <${recipient.email}> (${recipient.platformRole}) must have at least one SIGNATURE or FREE_SIGNATURE field.`,
				path: `recipients.${recipientIndex}.fields`,
				platformRole: recipient.platformRole,
			});
		}
	});

	return {
		errors,
		ok: errors.length === 0,
	};
}

function assertDocumensoEnvelopePreflight(
	input: SignatureProviderCreateEnvelopeInput
) {
	const result = validateDocumensoEnvelopePreflight(input);
	if (!result.ok) {
		throw new ConvexError({
			code: "DOCUMENSO_PROVIDER_PREFLIGHT_FAILED",
			errors: result.errors.map((error) => ({
				code: error.code,
				...(error.fieldIdentifier !== undefined
					? { fieldIdentifier: String(error.fieldIdentifier) }
					: {}),
				message: error.message,
				path: error.path,
				...(error.platformRole ? { platformRole: error.platformRole } : {}),
			})),
		});
	}
}

function toDocumensoField(field: SignatureProviderField) {
	return {
		identifier: field.identifier ?? 0,
		type: field.type,
		page: field.pageNumber,
		positionX: field.positionX,
		positionY: field.positionY,
		width: field.width,
		height: field.height,
		required: field.required,
		fieldMeta: toDocumensoFieldMeta(field),
	};
}

function toCreateRecipientPayload(recipient: SignatureProviderRecipientInput) {
	return {
		email: recipient.email,
		name: recipient.name,
		role: recipient.providerRole,
		signingOrder: recipient.signingOrder,
		fields: recipient.fields.map(toDocumensoField),
	};
}

function matchProviderRecipient(
	input: SignatureProviderRecipientInput,
	providerRecipients: DocumensoRecipientResponse[]
) {
	const sameEmailAndRole = (recipient: DocumensoRecipientResponse) =>
		recipient.email.toLowerCase() === input.email.toLowerCase() &&
		recipient.role?.toUpperCase() === input.providerRole;

	return (
		providerRecipients.find(
			(recipient) =>
				sameEmailAndRole(recipient) &&
				(recipient.signingOrder === undefined ||
					recipient.signingOrder === null ||
					recipient.signingOrder === input.signingOrder)
		) ?? providerRecipients.find(sameEmailAndRole)
	);
}

async function readResponseText(response: Response) {
	try {
		return await response.text();
	} catch {
		return "";
	}
}

function summarizeResponseText(responseText: string) {
	const trimmed = responseText.trim();
	if (trimmed.length === 0) {
		return "";
	}
	return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
}

function buildDocumensoApiErrorMessage(args: {
	method: string;
	path: string;
	responseText: string;
	status: number;
}) {
	const responseSummary = summarizeResponseText(args.responseText);
	return `Documenso ${args.method} ${args.path} failed with status ${args.status}${
		responseSummary ? `: ${responseSummary}` : ""
	}`;
}

async function requestJson<T>(
	config: DocumensoConfig,
	path: string,
	init: RequestInit
): Promise<T> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
	const method = init.method ?? "GET";

	try {
		const response = await config.fetchFn(buildApiUrl(config, path), {
			...init,
			headers: {
				Authorization: config.apiKey,
				...(init.headers ?? {}),
			},
			signal: controller.signal,
		});
		const responseText = await readResponseText(response);

		if (!response.ok) {
			throw new DocumensoApiError({
				message: buildDocumensoApiErrorMessage({
					method,
					path,
					responseText,
					status: response.status,
				}),
				method,
				path,
				responseText,
				status: response.status,
			});
		}

		return JSON.parse(responseText) as T;
	} catch (error) {
		if (error instanceof DocumensoApiError) {
			throw error;
		}

		throw new DocumensoRequestError({
			cause: error,
			message: `Documenso ${method} ${path} request failed`,
			method,
			path,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function requestBytes(
	config: DocumensoConfig,
	path: string,
	init: RequestInit
): Promise<ArrayBuffer> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
	const method = init.method ?? "GET";

	try {
		const response = await config.fetchFn(buildApiUrl(config, path), {
			...init,
			headers: {
				Authorization: config.apiKey,
				...(init.headers ?? {}),
			},
			signal: controller.signal,
		});

		if (!response.ok) {
			const responseText = await readResponseText(response);
			throw new DocumensoApiError({
				message: buildDocumensoApiErrorMessage({
					method,
					path,
					responseText,
					status: response.status,
				}),
				method,
				path,
				responseText,
				status: response.status,
			});
		}

		return response.arrayBuffer();
	} catch (error) {
		if (error instanceof DocumensoApiError) {
			throw error;
		}

		throw new DocumensoRequestError({
			cause: error,
			message: `Documenso ${method} ${path} request failed`,
			method,
			path,
		});
	} finally {
		clearTimeout(timeout);
	}
}

async function getEnvelope(
	config: DocumensoConfig,
	providerEnvelopeId: string
) {
	return requestJson<DocumensoEnvelopeResponse>(
		config,
		`/envelope/${encodeURIComponent(providerEnvelopeId)}`,
		{ method: "GET" }
	);
}

async function getRecipient(
	config: DocumensoConfig,
	providerRecipientId: string
) {
	return requestJson<DocumensoRecipientResponse>(
		config,
		`/envelope/recipient/${encodeURIComponent(providerRecipientId)}`,
		{ method: "GET" }
	);
}

function buildCreateEnvelopePayload(
	input: SignatureProviderCreateEnvelopeInput
) {
	return {
		type: "DOCUMENT",
		title: input.title,
		externalId: String(input.generatedDocumentId),
		recipients: input.recipients.map(toCreateRecipientPayload),
	};
}

async function createAndOptionallyDistributeEnvelope(
	config: DocumensoConfig,
	input: SignatureProviderCreateEnvelopeInput
): Promise<{
	distributionError?: string;
	envelopeId: string;
	recipients: DocumensoRecipientResponse[];
	status: "draft" | "sent";
}> {
	assertDocumensoEnvelopePreflight(input);

	const pdfBlob = await config.getStorageBlob(input.pdfStorageId);
	if (!pdfBlob) {
		throw new DocumensoRequestError({
			message: `Stored PDF ${input.pdfStorageId} could not be loaded for Documenso envelope creation`,
			method: "POST",
			path: "/envelope/create",
		});
	}

	const formData = new FormData();
	formData.append("payload", JSON.stringify(buildCreateEnvelopePayload(input)));
	formData.append("files", pdfBlob, `${sanitizeFileName(input.title)}.pdf`);

	const createResponse = await requestJson<DocumensoCreateEnvelopeResponse>(
		config,
		"/envelope/create",
		{
			method: "POST",
			body: formData,
		}
	);

	const createdEnvelope = await getEnvelope(config, createResponse.id);

	try {
		const distributeResponse = await distributeEnvelope(
			config,
			createResponse.id
		);

		return {
			envelopeId: createResponse.id,
			recipients:
				distributeResponse.recipients ?? createdEnvelope.recipients ?? [],
			status: "sent",
		};
	} catch (error) {
		return {
			distributionError: error instanceof Error ? error.message : String(error),
			envelopeId: createResponse.id,
			recipients: createdEnvelope.recipients ?? [],
			status: "draft",
		};
	}
}

async function deleteEnvelope(
	config: DocumensoConfig,
	providerEnvelopeId: string
) {
	await requestJson<DocumensoDeleteEnvelopeResponse>(
		config,
		"/envelope/delete",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				envelopeId: providerEnvelopeId,
			}),
		}
	);
}

async function distributeEnvelope(
	config: DocumensoConfig,
	providerEnvelopeId: string
) {
	return requestJson<DocumensoDistributeEnvelopeResponse>(
		config,
		"/envelope/distribute",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				envelopeId: providerEnvelopeId,
			}),
		}
	);
}

function isCertificateEnvelopeItem(item: DocumensoEnvelopeItemResponse) {
	const haystack = `${item.name ?? ""} ${item.type ?? ""}`.toLowerCase();
	return haystack.includes("certificate");
}

function getPrimaryEnvelopeItem(items: DocumensoEnvelopeItemResponse[]) {
	return items.find((item) => !isCertificateEnvelopeItem(item)) ?? items[0];
}

async function tryDownloadOptionalArtifact(
	config: DocumensoConfig,
	path: string
) {
	try {
		return await requestBytes(config, path, { method: "GET" });
	} catch (error) {
		if (
			error instanceof DocumensoApiError &&
			(error.status === 400 || error.status === 404)
		) {
			return undefined;
		}

		throw error;
	}
}

export function createDocumensoSignatureProvider(
	input: DocumensoSignatureProviderFactoryOptions
): SignatureProvider {
	const config = resolveConfig(input);

	return {
		async createEnvelope(
			args: SignatureProviderCreateEnvelopeInput
		): Promise<SignatureProviderCreateEnvelopeResult> {
			const created = await createAndOptionallyDistributeEnvelope(config, args);

			return {
				lastError: created.distributionError,
				providerEnvelopeId: created.envelopeId,
				recipients: args.recipients.map((recipient) => {
					const providerRecipient = matchProviderRecipient(
						recipient,
						created.recipients
					);

					return {
						platformRole: recipient.platformRole,
						providerRecipientId: providerRecipient
							? String(providerRecipient.id)
							: undefined,
						signingUrl: normalizeSigningUrl(config, providerRecipient),
						token: providerRecipient?.token ?? undefined,
					};
				}),
				status: created.status,
			};
		},

		async deleteEnvelope(input) {
			await deleteEnvelope(config, input.providerEnvelopeId);
		},

		async distributeEnvelope(input) {
			await distributeEnvelope(config, input.providerEnvelopeId);
		},

		async createEmbeddedSigningSession(input) {
			const recipient = await getRecipient(config, input.providerRecipientId);
			const url = normalizeSigningUrl(config, recipient);
			if (!url) {
				throw new DocumensoRequestError({
					message: `Documenso recipient ${input.providerRecipientId} does not have a signing token or signing URL`,
					method: "GET",
					path: `/envelope/recipient/${input.providerRecipientId}`,
				});
			}

			return {
				// Documenso's v2 docs expose a signing token, not an explicit expiry.
				// Treat this as a refresh window for the portal and allow the backend
				// to mint a fresh URL on demand.
				expiresAt: config.now() + DEFAULT_SIGNING_URL_TTL_MS,
				url,
			};
		},

		async syncEnvelope(input): Promise<SignatureProviderSyncEnvelopeResult> {
			const envelope = await getEnvelope(config, input.providerEnvelopeId);
			const recipients = envelope.recipients ?? [];

			return {
				envelopeStatus: mapDocumensoEnvelopeStatus(envelope.status, recipients),
				recipients: recipients.map((recipient) => ({
					email: recipient.email,
					declinedAt:
						recipient.signingStatus?.toUpperCase() === "REJECTED"
							? parseTimestamp(envelope.updatedAt)
							: undefined,
					name: recipient.name,
					openedAt:
						recipient.readStatus?.toUpperCase() === "OPENED"
							? parseTimestamp(envelope.updatedAt)
							: undefined,
					providerRecipientId: String(recipient.id),
					providerRole: mapDocumensoProviderRole(recipient.role),
					signingOrder: recipient.signingOrder ?? 0,
					signedAt: parseTimestamp(recipient.signedAt),
					status: mapDocumensoRecipientStatus(recipient),
				})),
			};
		},

		async downloadCompletedArtifacts(
			input: SignatureProviderDownloadCompletedArtifactsInput
		): Promise<SignatureProviderDownloadCompletedArtifactsResult> {
			const envelope = await getEnvelope(config, input.providerEnvelopeId);
			if (envelope.status.toUpperCase() !== "COMPLETED") {
				throw new DocumensoRequestError({
					message: `Documenso envelope ${input.providerEnvelopeId} is ${envelope.status}, expected COMPLETED before downloading signed artifacts`,
					method: "GET",
					path: `/envelope/${encodeURIComponent(input.providerEnvelopeId)}`,
				});
			}

			const envelopeItems = envelope.envelopeItems ?? [];
			const primaryEnvelopeItem = getPrimaryEnvelopeItem(envelopeItems);
			if (!primaryEnvelopeItem) {
				throw new DocumensoRequestError({
					message: `Documenso envelope ${input.providerEnvelopeId} did not include any envelope items for completed artifact download`,
					method: "GET",
					path: `/envelope/${encodeURIComponent(input.providerEnvelopeId)}`,
				});
			}

			const finalPdfBytes = await requestBytes(
				config,
				`/envelope/item/${encodeURIComponent(primaryEnvelopeItem.id)}/download?version=signed`,
				{ method: "GET" }
			);

			const certificateEnvelopeItem = envelopeItems.find(
				isCertificateEnvelopeItem
			);
			const completionCertificateBytes = certificateEnvelopeItem
				? await tryDownloadOptionalArtifact(
						config,
						`/envelope/item/${encodeURIComponent(certificateEnvelopeItem.id)}/download`
					)
				: await tryDownloadOptionalArtifact(
						config,
						`/envelope/item/${encodeURIComponent(primaryEnvelopeItem.id)}/download?version=certificate`
					);

			return {
				completionCertificateBytes,
				finalPdfBytes,
			};
		},
	};
}
