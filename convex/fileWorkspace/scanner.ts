import {
	defaultFileWorkspaceScanPolicy,
	type FileWorkspacePolicyFailure,
	isOpenXmlOrOpenDocumentContentType,
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
			reasonCode: string;
			sha256?: string;
			state: "rejected";
	  }
	| {
			displayName?: string;
			message: string;
			reasonCode: string;
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
				reasonCode: "invalid_filename",
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
					reasonCode: "declared_size_mismatch",
					state: "rejected",
				};
			}

			sha256 = await this.hashBytes(input.bytes);
			const detected = this.detectContentType(input.bytes);
			if (!detected) {
				return {
					displayName,
					message: "Unknown binary file format is not allowed.",
					reasonCode: "unknown_binary_format",
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
			const declaredContentType = input.declaredContentType;
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
				!contentTypesCompatible({
					declaredContentType,
					detectedContentType: detected.contentType,
				})
			) {
				return {
					displayName,
					message: "Declared content type does not match file signature.",
					reasonCode: "content_type_mismatch",
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
				reasonCode: "scanner_exception",
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
