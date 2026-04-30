import type {
	FileScanState,
	FileWorkspaceScanPolicy,
	FileWorkspaceStorageLimits,
} from "./types";

export const FILE_WORKSPACE_VISIBLE_SCAN_STATES = [
	"clean",
	"released_by_admin",
] as const satisfies readonly FileScanState[];

export const FILE_WORKSPACE_ARCHIVE_EXTENSIONS = [
	".7z",
	".gz",
	".rar",
	".tar",
	".tgz",
	".zip",
] as const;

export const FILE_WORKSPACE_BLOCKED_EXTENSIONS = [
	".app",
	".bat",
	".cmd",
	".com",
	".cpl",
	".dll",
	".dmg",
	".exe",
	".hta",
	".html",
	".iso",
	".jar",
	".js",
	".jse",
	".msi",
	".msp",
	".ps1",
	".scr",
	".sh",
	".svg",
	".vb",
	".vbe",
	".vbs",
	".wsf",
] as const;

export const FILE_WORKSPACE_DEFAULT_ALLOWED_CONTENT_TYPES = [
	"application/msword",
	"application/pdf",
	"application/rtf",
	"application/vnd.ms-excel",
	"application/vnd.ms-powerpoint",
	"application/vnd.oasis.opendocument.presentation",
	"application/vnd.oasis.opendocument.spreadsheet",
	"application/vnd.oasis.opendocument.text",
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"image/bmp",
	"image/gif",
	"image/jpeg",
	"image/png",
	"image/tiff",
	"image/webp",
	"text/csv",
	"text/markdown",
	"text/plain",
] as const;

export const DEFAULT_FILE_WORKSPACE_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

export const defaultFileWorkspaceScanPolicy = {
	allowedContentTypes: FILE_WORKSPACE_DEFAULT_ALLOWED_CONTENT_TYPES,
	archivesEnabled: false,
	blockedExtensions: FILE_WORKSPACE_BLOCKED_EXTENSIONS,
	maxFileSizeBytes: DEFAULT_FILE_WORKSPACE_MAX_FILE_SIZE_BYTES,
} as const satisfies FileWorkspaceScanPolicy;

export const defaultFileWorkspaceStorageLimits = {
	maxBoxBytes: 1024 * 1024 * 1024,
	maxFileBytes: DEFAULT_FILE_WORKSPACE_MAX_FILE_SIZE_BYTES,
} as const satisfies FileWorkspaceStorageLimits;

export interface FileWorkspacePolicyFailure {
	message: string;
	normalizedExtension?: string;
	reasonCode: string;
}

export interface FileWorkspacePolicySuccess {
	normalizedExtension: string | undefined;
}

export type FileWorkspacePolicyResult =
	| ({ allowed: true } & FileWorkspacePolicySuccess)
	| ({ allowed: false } & FileWorkspacePolicyFailure);

const OPENXML_CONTENT_TYPES = new Set([
	"application/vnd.openxmlformats-officedocument.presentationml.presentation",
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ODF_CONTENT_TYPES = new Set([
	"application/vnd.oasis.opendocument.presentation",
	"application/vnd.oasis.opendocument.spreadsheet",
	"application/vnd.oasis.opendocument.text",
]);

export function normalizeFileWorkspaceExtension(
	displayName: string
): string | undefined {
	const lastSegment = displayName.split("/").pop() ?? displayName;
	const dotIndex = lastSegment.lastIndexOf(".");
	if (dotIndex <= 0 || dotIndex === lastSegment.length - 1) {
		return undefined;
	}
	return lastSegment.slice(dotIndex).toLocaleLowerCase("en-CA");
}

export function isFileWorkspaceArchiveExtension(
	extension: string | undefined
): boolean {
	if (!extension) {
		return false;
	}
	return FILE_WORKSPACE_ARCHIVE_EXTENSIONS.includes(
		extension as (typeof FILE_WORKSPACE_ARCHIVE_EXTENSIONS)[number]
	);
}

export function isOpenXmlOrOpenDocumentContentType(
	contentType: string | undefined
): boolean {
	return (
		contentType !== undefined &&
		(OPENXML_CONTENT_TYPES.has(contentType) ||
			ODF_CONTENT_TYPES.has(contentType))
	);
}

export function isFileWorkspaceScanStateVisible(
	scanState: FileScanState
): boolean {
	return FILE_WORKSPACE_VISIBLE_SCAN_STATES.includes(
		scanState as (typeof FILE_WORKSPACE_VISIBLE_SCAN_STATES)[number]
	);
}

export function validateFileWorkspaceFileSize(args: {
	policy: Pick<FileWorkspaceScanPolicy, "maxFileSizeBytes">;
	sizeBytes: number;
	storageLimits?: Pick<FileWorkspaceStorageLimits, "maxFileBytes">;
}): FileWorkspacePolicyResult {
	if (!Number.isSafeInteger(args.sizeBytes) || args.sizeBytes < 0) {
		return {
			allowed: false,
			message: "File size metadata is invalid.",
			reasonCode: "invalid_size",
		};
	}
	const maxFileSizeBytes = Math.min(
		args.policy.maxFileSizeBytes,
		args.storageLimits?.maxFileBytes ?? args.policy.maxFileSizeBytes
	);
	if (args.sizeBytes > maxFileSizeBytes) {
		return {
			allowed: false,
			message: "File exceeds the workspace file size limit.",
			reasonCode: "file_too_large",
		};
	}
	return { allowed: true, normalizedExtension: undefined };
}

export function validateFileWorkspaceBoxQuota(args: {
	currentBoxBytes: number;
	incomingSizeBytes: number;
	storageLimits: Pick<FileWorkspaceStorageLimits, "maxBoxBytes">;
}): FileWorkspacePolicyResult {
	const nextSize = args.currentBoxBytes + args.incomingSizeBytes;
	if (
		!(
			Number.isSafeInteger(args.currentBoxBytes) &&
			Number.isSafeInteger(args.incomingSizeBytes)
		) ||
		args.currentBoxBytes < 0 ||
		args.incomingSizeBytes < 0 ||
		nextSize > args.storageLimits.maxBoxBytes
	) {
		return {
			allowed: false,
			message: "File would exceed the box storage quota.",
			reasonCode: "box_quota_exceeded",
		};
	}
	return { allowed: true, normalizedExtension: undefined };
}

export function validateFileWorkspaceExtension(args: {
	contentType?: string;
	displayName: string;
	policy: Pick<
		FileWorkspaceScanPolicy,
		"archivesEnabled" | "blockedExtensions"
	>;
}): FileWorkspacePolicyResult {
	const normalizedExtension = normalizeFileWorkspaceExtension(args.displayName);
	if (
		normalizedExtension &&
		args.policy.blockedExtensions
			.map((extension) => extension.toLocaleLowerCase("en-CA"))
			.includes(normalizedExtension)
	) {
		return {
			allowed: false,
			message: "This file type is blocked by workspace policy.",
			normalizedExtension,
			reasonCode: "blocked_extension",
		};
	}
	if (
		isFileWorkspaceArchiveExtension(normalizedExtension) &&
		!args.policy.archivesEnabled &&
		!isOpenXmlOrOpenDocumentContentType(args.contentType)
	) {
		return {
			allowed: false,
			message: "Archive uploads are disabled by workspace policy.",
			normalizedExtension,
			reasonCode: "archives_disabled",
		};
	}
	return { allowed: true, normalizedExtension };
}

export function validateFileWorkspaceContentType(args: {
	contentType: string | undefined;
	policy: Pick<FileWorkspaceScanPolicy, "allowedContentTypes">;
}): FileWorkspacePolicyResult {
	if (!args.contentType) {
		return {
			allowed: false,
			message: "File content type is required.",
			reasonCode: "missing_content_type",
		};
	}
	if (!args.policy.allowedContentTypes.includes(args.contentType)) {
		return {
			allowed: false,
			message: "This file type is not allowed by workspace policy.",
			reasonCode: "content_type_not_allowed",
		};
	}
	return { allowed: true, normalizedExtension: undefined };
}
