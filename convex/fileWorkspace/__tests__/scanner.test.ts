import { describe, expect, it } from "vitest";
import {
	defaultFileWorkspaceScanPolicy,
	type FileWorkspacePolicyFailure,
} from "../policy";
import {
	detectFileWorkspaceContentType,
	StructuralFileScanner,
	sha256Hex,
} from "../scanner";

const textBytes = new TextEncoder().encode("closing,amount\nA,100\n");
const pdfBytes = new Uint8Array([
	0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a,
]);
const pngBytes = new Uint8Array([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const binaryBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
const docxBytes = zipWithEntries([
	"[Content_Types].xml",
	"_rels/.rels",
	"word/document.xml",
]);

function scan(args: {
	bytes: Uint8Array;
	contentType: string | undefined;
	filename: string;
}) {
	const scanner = new StructuralFileScanner();
	return scanner.scan({
		bytes: args.bytes,
		declaredContentType: args.contentType,
		declaredFilename: args.filename,
		declaredSizeBytes: args.bytes.byteLength,
		policy: defaultFileWorkspaceScanPolicy,
		storageId: "storage_test",
	});
}

function zipWithEntries(entryNames: string[]) {
	const encoder = new TextEncoder();
	const chunks = entryNames.map((entryName) => {
		const nameBytes = encoder.encode(entryName);
		const header = new Uint8Array(30 + nameBytes.byteLength);
		header.set([0x50, 0x4b, 0x03, 0x04], 0);
		header[4] = 20;
		header[26] = nameBytes.byteLength & 0xff;
		header[27] = (nameBytes.byteLength >> 8) & 0xff;
		header.set(nameBytes, 30);
		return header;
	});
	const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const bytes = new Uint8Array(totalLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

describe("File Workspace structural scanner", () => {
	it("detects representative magic-byte families", () => {
		expect(detectFileWorkspaceContentType(pdfBytes)).toEqual({
			confidence: "magic",
			contentType: "application/pdf",
		});
		expect(detectFileWorkspaceContentType(pngBytes)).toEqual({
			confidence: "magic",
			contentType: "image/png",
		});
		expect(detectFileWorkspaceContentType(textBytes)).toEqual({
			confidence: "text",
			contentType: "text/plain",
		});
	});

	it("marks safe business documents clean and computes SHA-256", async () => {
		const result = await scan({
			bytes: pdfBytes,
			contentType: "application/pdf",
			filename: "  Commitment   Letter.pdf ",
		});
		expect(result).toMatchObject({
			detectedContentType: "application/pdf",
			displayName: "Commitment Letter.pdf",
			normalizedExtension: ".pdf",
			sizeBytes: pdfBytes.byteLength,
			state: "clean",
		});
		expect(result.sha256).toBe(await sha256Hex(pdfBytes));
	});

	it("allows CSV and Markdown as text-backed business formats", async () => {
		await expect(
			scan({
				bytes: textBytes,
				contentType: "text/csv",
				filename: "loan tape.csv",
			})
		).resolves.toMatchObject({
			detectedContentType: "text/csv",
			state: "clean",
		});

		await expect(
			scan({
				bytes: textBytes,
				contentType: "text/markdown",
				filename: "notes.md",
			})
		).resolves.toMatchObject({
			detectedContentType: "text/markdown",
			state: "clean",
		});
	});

	it("rejects blocked extensions and unknown binary formats", async () => {
		await expect(
			scan({
				bytes: textBytes,
				contentType: "text/plain",
				filename: "script.sh",
			})
		).resolves.toMatchObject({
			reasonCode: "blocked_extension",
			state: "rejected",
		});

		await expect(
			scan({
				bytes: binaryBytes,
				contentType: "application/octet-stream",
				filename: "payload.bin",
			})
		).resolves.toMatchObject({
			reasonCode: "unknown_binary_format",
			state: "rejected",
		});
	});

	it("rejects declared MIME spoofing where magic bytes are available", async () => {
		await expect(
			scan({
				bytes: pngBytes,
				contentType: "application/pdf",
				filename: "fake.pdf",
			})
		).resolves.toMatchObject({
			reasonCode: "content_type_mismatch",
			state: "rejected",
		});
	});

	it("rejects generic archives and spoofed ZIP-backed Office payloads", async () => {
		await expect(
			scan({
				bytes: zipBytes,
				contentType: "application/zip",
				filename: "bundle.zip",
			})
		).resolves.toMatchObject({
			reasonCode: "content_type_not_allowed",
			state: "rejected",
		});

		await expect(
			scan({
				bytes: zipBytes,
				contentType:
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				filename: "commitment.docx",
			})
		).resolves.toMatchObject({
			reasonCode: "office_container_invalid",
			state: "rejected",
		});
	});

	it("allows structurally valid ZIP-backed Office documents", async () => {
		await expect(
			scan({
				bytes: docxBytes,
				contentType:
					"application/vnd.openxmlformats-officedocument.wordprocessingml.document; charset=binary",
				filename: "commitment.docx",
			})
		).resolves.toMatchObject({
			detectedContentType:
				"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			state: "clean",
		});
	});

	it("returns scan_error when scanner dependencies throw", async () => {
		const scanner = new StructuralFileScanner({
			detectContentType: () => {
				throw new Error("detector unavailable");
			},
		});
		await expect(
			scanner.scan({
				bytes: pdfBytes,
				declaredContentType: "application/pdf",
				declaredFilename: "commitment.pdf",
				declaredSizeBytes: pdfBytes.byteLength,
				policy: defaultFileWorkspaceScanPolicy,
				storageId: "storage_test",
			})
		).resolves.toMatchObject({
			reasonCode: "scanner_exception",
			state: "scan_error",
		});
	});

	it("rejects uploads that would exceed the current box quota", async () => {
		const scanner = new StructuralFileScanner();
		await expect(
			scanner.scan({
				boxQuota: {
					currentBoxBytes: 100,
					maxBoxBytes: 101,
				},
				bytes: pdfBytes,
				declaredContentType: "application/pdf",
				declaredFilename: "commitment.pdf",
				declaredSizeBytes: pdfBytes.byteLength,
				policy: defaultFileWorkspaceScanPolicy,
				storageId: "storage_test",
			})
		).resolves.toMatchObject({
			reasonCode: "box_quota_exceeded",
			state: "rejected",
		});
	});

	it("retains rejection metadata from injected policy failures without any", async () => {
		const scanner = new StructuralFileScanner({
			hashBytes: async () => "hash",
		});
		const oversizedPolicy = {
			...defaultFileWorkspaceScanPolicy,
			maxFileSizeBytes: 1,
		};
		const result = await scanner.scan({
			bytes: pdfBytes,
			declaredContentType: "application/pdf",
			declaredFilename: "commitment.pdf",
			declaredSizeBytes: pdfBytes.byteLength,
			policy: oversizedPolicy,
			storageId: "storage_test",
		});
		const failure: Partial<FileWorkspacePolicyFailure> = {
			reasonCode: "file_too_large",
		};
		expect(result).toMatchObject({ ...failure, state: "rejected" });
	});
});
