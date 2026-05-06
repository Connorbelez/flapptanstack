import {
	defaultFileWorkspaceScanPolicy,
	type FileWorkspacePolicyFailure,
	type FileWorkspacePolicyReasonCode,
	isOpenXmlOrOpenDocumentContentType,
	normalizeFileWorkspaceContentType,
	validateFileWorkspaceBoxQuota,
	validateFileWorkspaceContentType,
	validateFileWorkspaceExtension,
	validateFileWorkspaceFileSize,
} from "./policy";
import type { FileWorkspaceScanPolicy } from "./types";
import { normalizeFileWorkspaceName } from "./validators";

export interface FileScanner {
	scan(input: FileScannerInput): Promise<FileScanResult>;
}

export interface FileScannerInput {
	boxQuota?: {
		currentBoxBytes: number;
		maxBoxBytes: number;
	};
	bytes: Uint8Array;
	declaredContentType: string | undefined;
	declaredFilename: string;
	declaredSizeBytes: number;
	policy: FileWorkspaceScanPolicy;
	storageId: string;
}

export const FILE_WORKSPACE_SCAN_REASON_CODES = {
	contentTypeMismatch: "content_type_mismatch",
	declaredSizeMismatch: "declared_size_mismatch",
	invalidFilename: "invalid_filename",
	officeContainerInvalid: "office_container_invalid",
	scannerException: "scanner_exception",
	storageBlobMissing: "storage_blob_missing",
	unknownBinaryFormat: "unknown_binary_format",
} as const;

type ValueOf<T> = T[keyof T];

export type FileWorkspaceScanReasonCode = ValueOf<
	typeof FILE_WORKSPACE_SCAN_REASON_CODES
>;

export type FileScanResult =
	| {
			detectedContentType: string;
			displayName: string;
			normalizedExtension: string | undefined;
			sha256: string;
			sizeBytes: number;
			state: "clean";
	  }
	| {
			displayName?: string;
			message: string;
			reasonCode: FileWorkspacePolicyReasonCode | FileWorkspaceScanReasonCode;
			sha256?: string;
			state: "rejected";
	  }
	| {
			displayName?: string;
			message: string;
			reasonCode: FileWorkspacePolicyReasonCode | FileWorkspaceScanReasonCode;
			sha256?: string;
			state: "scan_error";
	  };

export interface FileSignatureDetection {
	confidence: "magic" | "text";
	contentType: string;
}

interface StructuralFileScannerDependencies {
	detectContentType?: (bytes: Uint8Array) => FileSignatureDetection | undefined;
	hashBytes?: (bytes: Uint8Array) => Promise<string>;
}

const BINARY_SAMPLE_BYTES = 512;

const OFFICE_LEGACY_CONTENT_TYPES = new Set([
	"application/msword",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
]);

const OFFICE_CONTAINER_REQUIRED_ENTRIES = new Map<string, readonly string[]>([
	[
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		["[Content_Types].xml", "_rels/.rels", "word/document.xml"],
	],
	[
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"],
	],
	[
		"application/vnd.openxmlformats-officedocument.presentationml.presentation",
		["[Content_Types].xml", "_rels/.rels", "ppt/presentation.xml"],
	],
	[
		"application/vnd.oasis.opendocument.text",
		["mimetype", "content.xml", "META-INF/manifest.xml"],
	],
	[
		"application/vnd.oasis.opendocument.spreadsheet",
		["mimetype", "content.xml", "META-INF/manifest.xml"],
	],
	[
		"application/vnd.oasis.opendocument.presentation",
		["mimetype", "content.xml", "META-INF/manifest.xml"],
	],
]);

function bytesStartWith(bytes: Uint8Array, signature: readonly number[]) {
	if (bytes.length < signature.length) {
		return false;
	}
	return signature.every((value, index) => bytes[index] === value);
}

function bytesEqualAt(
	bytes: Uint8Array,
	offset: number,
	signature: readonly number[]
) {
	if (bytes.length < offset + signature.length) {
		return false;
	}
	return signature.every((value, index) => bytes[offset + index] === value);
}

function readUInt16LE(bytes: Uint8Array, offset: number): number {
	return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32LE(bytes: Uint8Array, offset: number): number {
	return (
		bytes[offset] |
		(bytes[offset + 1] << 8) |
		(bytes[offset + 2] << 16) |
		(bytes[offset + 3] << 24)
	);
}

function isLikelyUtf8Text(bytes: Uint8Array): boolean {
	const sample = bytes.slice(0, BINARY_SAMPLE_BYTES);
	if (sample.some((value) => value === 0)) {
		return false;
	}
	const decoder = new TextDecoder("utf-8", { fatal: true });
	try {
		decoder.decode(sample);
		return true;
	} catch {
		return false;
	}
}

export function detectFileWorkspaceContentType(
	bytes: Uint8Array
): FileSignatureDetection | undefined {
	if (bytesStartWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
		return { contentType: "application/pdf", confidence: "magic" };
	}
	if (bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
		return { contentType: "image/png", confidence: "magic" };
	}
	if (bytesStartWith(bytes, [0xff, 0xd8, 0xff])) {
		return { contentType: "image/jpeg", confidence: "magic" };
	}
	if (
		bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
		bytesStartWith(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
	) {
		return { contentType: "image/gif", confidence: "magic" };
	}
	if (bytesStartWith(bytes, [0x42, 0x4d])) {
		return { contentType: "image/bmp", confidence: "magic" };
	}
	if (
		bytesStartWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
		bytesStartWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
	) {
		return { contentType: "image/tiff", confidence: "magic" };
	}
	if (
		bytesStartWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
		bytesEqualAt(bytes, 8, [0x57, 0x45, 0x42, 0x50])
	) {
		return { contentType: "image/webp", confidence: "magic" };
	}
	if (bytesStartWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
		return { contentType: "application/msword", confidence: "magic" };
	}
	if (bytesStartWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
		return { contentType: "application/zip", confidence: "magic" };
	}
	if (isLikelyUtf8Text(bytes)) {
		return { contentType: "text/plain", confidence: "text" };
	}
	return undefined;
}

function getZipLocalFileNames(bytes: Uint8Array): Set<string> {
	const decoder = new TextDecoder("utf-8", { fatal: false });
	const fileNames = new Set<string>();
	let offset = 0;
	while (offset + 30 <= bytes.byteLength) {
		if (!bytesEqualAt(bytes, offset, [0x50, 0x4b, 0x03, 0x04])) {
			break;
		}
		const compressedSize = readUInt32LE(bytes, offset + 18);
		const fileNameLength = readUInt16LE(bytes, offset + 26);
		const extraFieldLength = readUInt16LE(bytes, offset + 28);
		const fileNameStart = offset + 30;
		const fileNameEnd = fileNameStart + fileNameLength;
		const dataStart = fileNameEnd + extraFieldLength;
		const nextOffset = dataStart + compressedSize;
		if (
			fileNameLength === 0 ||
			fileNameEnd > bytes.byteLength ||
			dataStart > bytes.byteLength ||
			nextOffset <= offset
		) {
			break;
		}
		fileNames.add(decoder.decode(bytes.slice(fileNameStart, fileNameEnd)));
		offset = nextOffset;
	}
	return fileNames;
}

function isValidZipBackedOfficeContainer(args: {
	bytes: Uint8Array;
	declaredContentType: string;
}): boolean {
	const requiredEntries = OFFICE_CONTAINER_REQUIRED_ENTRIES.get(
		args.declaredContentType
	);
	if (!requiredEntries) {
		return false;
	}
	const fileNames = getZipLocalFileNames(args.bytes);
	return requiredEntries.every((entryName) => fileNames.has(entryName));
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digestBytes = new Uint8Array(bytes.byteLength);
	digestBytes.set(bytes);
	const hashBuffer = await crypto.subtle.digest("SHA-256", digestBytes);
	return Array.from(new Uint8Array(hashBuffer))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
}

function rejection(
	failure: FileWorkspacePolicyFailure,
	args: { displayName?: string; sha256?: string }
): FileScanResult {
	return {
		displayName: args.displayName,
		message: failure.message,
		reasonCode: failure.reasonCode,
		sha256: args.sha256,
		state: "rejected",
	};
}

function contentTypesCompatible(args: {
	declaredContentType: string;
	detectedContentType: string;
}): boolean {
	if (args.declaredContentType === args.detectedContentType) {
		return true;
	}
	if (
		args.detectedContentType === "application/zip" &&
		isOpenXmlOrOpenDocumentContentType(args.declaredContentType)
	) {
		return true;
	}
	if (
		args.detectedContentType === "application/msword" &&
		OFFICE_LEGACY_CONTENT_TYPES.has(args.declaredContentType)
	) {
		return true;
	}
	if (
		args.detectedContentType === "text/plain" &&
		(args.declaredContentType === "text/csv" ||
			args.declaredContentType === "text/markdown")
	) {
		return true;
	}
	return false;
}

export class StructuralFileScanner implements FileScanner {
	private readonly detectContentType: NonNullable<
		StructuralFileScannerDependencies["detectContentType"]
	>;
	private readonly hashBytes: NonNullable<
		StructuralFileScannerDependencies["hashBytes"]
	>;

	constructor(dependencies: StructuralFileScannerDependencies = {}) {
		this.detectContentType =
			dependencies.detectContentType ?? detectFileWorkspaceContentType;
		this.hashBytes = dependencies.hashBytes ?? sha256Hex;
	}

	async scan(input: FileScannerInput): Promise<FileScanResult> {
		let displayName: string;
		try {
			displayName = normalizeFileWorkspaceName(input.declaredFilename);
		} catch (error) {
			return {
				message:
					error instanceof Error ? error.message : "File name is not allowed.",
				reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.invalidFilename,
				state: "rejected",
			};
		}

		let sha256: string | undefined;
		try {
			const sizeResult = validateFileWorkspaceFileSize({
				policy: input.policy,
				sizeBytes: input.bytes.byteLength,
			});
			if (!sizeResult.allowed) {
				return rejection(sizeResult, { displayName });
			}
			if (input.boxQuota) {
				const quotaResult = validateFileWorkspaceBoxQuota({
					currentBoxBytes: input.boxQuota.currentBoxBytes,
					incomingSizeBytes: input.bytes.byteLength,
					storageLimits: { maxBoxBytes: input.boxQuota.maxBoxBytes },
				});
				if (!quotaResult.allowed) {
					return rejection(quotaResult, { displayName });
				}
			}
			if (input.declaredSizeBytes !== input.bytes.byteLength) {
				return {
					displayName,
					message: "Declared file size does not match stored blob size.",
					reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.declaredSizeMismatch,
					state: "rejected",
				};
			}

			sha256 = await this.hashBytes(input.bytes);
			const detected = this.detectContentType(input.bytes);
			if (!detected) {
				return {
					displayName,
					message: "Unknown binary file format is not allowed.",
					reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.unknownBinaryFormat,
					sha256,
					state: "rejected",
				};
			}

			const declaredPolicyResult = validateFileWorkspaceContentType({
				contentType: input.declaredContentType,
				policy: input.policy,
			});
			if (!declaredPolicyResult.allowed) {
				return rejection(declaredPolicyResult, { displayName, sha256 });
			}
			const declaredContentType = normalizeFileWorkspaceContentType(
				input.declaredContentType
			);
			if (!declaredContentType) {
				return rejection(
					{
						message: "File content type is required.",
						reasonCode: "missing_content_type",
					},
					{ displayName, sha256 }
				);
			}

			if (
				detected.contentType === "application/zip" &&
				isOpenXmlOrOpenDocumentContentType(declaredContentType) &&
				!isValidZipBackedOfficeContainer({
					bytes: input.bytes,
					declaredContentType,
				})
			) {
				return {
					displayName,
					message:
						"ZIP-backed Office documents must contain the required document structure.",
					reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.officeContainerInvalid,
					sha256,
					state: "rejected",
				};
			}

			if (
				!contentTypesCompatible({
					declaredContentType,
					detectedContentType: detected.contentType,
				})
			) {
				return {
					displayName,
					message: "Declared content type does not match file signature.",
					reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.contentTypeMismatch,
					sha256,
					state: "rejected",
				};
			}

			const extensionResult = validateFileWorkspaceExtension({
				contentType: declaredContentType,
				displayName,
				policy: input.policy,
			});
			if (!extensionResult.allowed) {
				return rejection(extensionResult, { displayName, sha256 });
			}

			return {
				detectedContentType:
					declaredContentType === "text/csv" ||
					declaredContentType === "text/markdown" ||
					isOpenXmlOrOpenDocumentContentType(declaredContentType)
						? declaredContentType
						: detected.contentType,
				displayName,
				normalizedExtension: extensionResult.normalizedExtension,
				sha256,
				sizeBytes: input.bytes.byteLength,
				state: "clean",
			};
		} catch (error) {
			return {
				displayName,
				message:
					error instanceof Error
						? error.message
						: "File scan failed unexpectedly.",
				reasonCode: FILE_WORKSPACE_SCAN_REASON_CODES.scannerException,
				sha256,
				state: "scan_error",
			};
		}
	}
}

export const defaultFileWorkspaceScanner = new StructuralFileScanner();

export function createDefaultFileScannerInput(
	input: Omit<FileScannerInput, "policy"> & {
		policy?: FileWorkspaceScanPolicy;
	}
): FileScannerInput {
	return {
		...input,
		policy: input.policy ?? defaultFileWorkspaceScanPolicy,
	};
}
