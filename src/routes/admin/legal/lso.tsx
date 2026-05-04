import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { AlertCircle, Database, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

interface LsoImportRowInput {
	barNumber: string;
	displayName: string;
	email?: string;
	entitledToPractise: boolean;
	firmName?: string;
	jurisdiction: string;
	licenseeType: "lawyer" | "paralegal";
	licensingStatus:
		| "administratively_suspended"
		| "licensed"
		| "retired"
		| "revoked"
		| "suspended"
		| "unknown";
	restrictionStatus:
		| "clear"
		| "requires_review"
		| "restricted"
		| "suspended"
		| "unknown";
	restrictionSummary?: string;
}

const sampleRows = JSON.stringify(
	[
		{
			barNumber: "L12345",
			displayName: "Jane Eligible",
			email: "jane@example.test",
			entitledToPractise: true,
			firmName: "Example LLP",
			jurisdiction: "ON",
			licenseeType: "lawyer",
			licensingStatus: "licensed",
			restrictionStatus: "clear",
		},
	],
	null,
	2
);

export const Route = createFileRoute("/admin/legal/lso")({
	component: AdminLegalLsoRoute,
});

function parseRows(value: string): LsoImportRowInput[] {
	const parsed: unknown = JSON.parse(value);
	if (!Array.isArray(parsed)) {
		throw new Error("Import payload must be a JSON array.");
	}
	return parsed as LsoImportRowInput[];
}

function AdminLegalLsoRoute() {
	const importBatch = useMutation(
		api.legalRepresentation.lsoRegistry.importBatch
	);
	const [rowsJson, setRowsJson] = useState(sampleRows);
	const [sourceName, setSourceName] = useState("lso-import.json");
	const [checksum, setChecksum] = useState(`manual:${Date.now()}`);
	const [batchId, setBatchId] = useState<Id<"lsoImportBatches"> | null>(null);
	const [isImporting, setIsImporting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const diagnostics = useQuery(
		api.legalRepresentation.lsoRegistry.getImportBatch,
		batchId ? { batchId } : "skip"
	);
	const preview = useMemo(() => {
		try {
			const rows = parseRows(rowsJson);
			return { rows, error: null };
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : "Invalid JSON.",
				rows: [] as LsoImportRowInput[],
			};
		}
	}, [rowsJson]);

	async function handleImport() {
		if (preview.error) {
			setMessage(preview.error);
			return;
		}
		setIsImporting(true);
		setMessage(null);
		try {
			const result = await importBatch({
				checksum,
				rows: preview.rows,
				sourceName,
			});
			setBatchId(result.batchId);
			setMessage(
				`Imported ${result.imported.toLocaleString()} rows with ${result.errors.toLocaleString()} row errors.`
			);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Import failed.");
		} finally {
			setIsImporting(false);
		}
	}

	return (
		<main className="min-h-screen bg-background px-6 py-8 text-foreground">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<header className="flex flex-col gap-2 border-border border-b pb-5">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Legal operations
					</p>
					<h1 className="font-semibold text-3xl tracking-normal">
						LSO registry import
					</h1>
				</header>

				<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
					<div className="flex min-w-0 flex-col gap-3">
						<label className="font-medium text-sm" htmlFor="lso-rows">
							Import rows
						</label>
						<textarea
							className="min-h-[420px] rounded-md border border-input bg-background p-3 font-mono text-sm outline-none focus:border-ring"
							id="lso-rows"
							onChange={(event) => setRowsJson(event.target.value)}
							spellCheck={false}
							value={rowsJson}
						/>
					</div>

					<aside className="flex flex-col gap-4">
						<div className="grid gap-3">
							<label className="grid gap-1 font-medium text-sm">
								<span>Source name</span>
								<input
									className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring"
									onChange={(event) => setSourceName(event.target.value)}
									value={sourceName}
								/>
							</label>
							<label className="grid gap-1 font-medium text-sm">
								<span>Checksum</span>
								<input
									className="rounded-md border border-input bg-background px-3 py-2 outline-none focus:border-ring"
									onChange={(event) => setChecksum(event.target.value)}
									value={checksum}
								/>
							</label>
						</div>

						<div className="rounded-md border border-border p-4">
							<div className="flex items-center gap-2 font-medium text-sm">
								<Database className="size-4" />
								<span>Preview</span>
							</div>
							<p className="mt-3 text-muted-foreground text-sm">
								{preview.error ??
									`${preview.rows.length.toLocaleString()} rows ready to commit.`}
							</p>
						</div>

						<button
							className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm disabled:cursor-not-allowed disabled:opacity-60"
							disabled={isImporting || preview.error !== null}
							onClick={handleImport}
							type="button"
						>
							<Upload className="size-4" />
							{isImporting ? "Importing" : "Commit import"}
						</button>

						{message ? (
							<div className="rounded-md border border-border p-4 text-sm">
								{message}
							</div>
						) : null}
					</aside>
				</section>

				{diagnostics ? (
					<section className="grid gap-3 border-border border-t pt-5">
						<div className="flex items-center gap-2 font-medium">
							<AlertCircle className="size-4" />
							<span>Batch diagnostics</span>
						</div>
						<div className="grid gap-2 text-sm md:grid-cols-3">
							<div>Status: {diagnostics.batch.status}</div>
							<div>Rows: {diagnostics.batch.rowCount.toLocaleString()}</div>
							<div>Errors: {diagnostics.batch.errorCount.toLocaleString()}</div>
						</div>
						{diagnostics.errors.length > 0 ? (
							<div className="overflow-x-auto rounded-md border border-border">
								<table className="w-full min-w-[680px] text-left text-sm">
									<thead className="bg-muted/50">
										<tr>
											<th className="px-3 py-2">Row</th>
											<th className="px-3 py-2">Code</th>
											<th className="px-3 py-2">Key</th>
											<th className="px-3 py-2">Message</th>
										</tr>
									</thead>
									<tbody>
										{diagnostics.errors.map((error) => (
											<tr className="border-border border-t" key={error._id}>
												<td className="px-3 py-2">{error.rowNumber}</td>
												<td className="px-3 py-2">{error.errorCode}</td>
												<td className="px-3 py-2">
													{error.normalizedKey ?? "Unavailable"}
												</td>
												<td className="px-3 py-2">{error.message}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						) : null}
					</section>
				) : null}
			</div>
		</main>
	);
}
