import { useAction } from "convex/react";
import { ExternalLink, Signature } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export function EmbeddedSigningPanel({
	dealId,
	instanceId,
}: {
	readonly dealId: Id<"deals">;
	readonly instanceId: Id<"dealDocumentInstances">;
}) {
	const [status, setStatus] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const createEmbeddedSigningSession = useAction(
		api.documents.signature.sessions.createEmbeddedSigningSession
	);

	async function launchSigning() {
		setLoading(true);
		setStatus(null);
		try {
			const session = await createEmbeddedSigningSession({
				dealId,
				instanceId,
			});
			window.location.assign(session.url);
		} catch (error) {
			setStatus(
				error instanceof Error
					? error.message
					: "Embedded signing could not be started."
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-start gap-3">
					<Signature className="mt-1 size-5 text-emerald-700" />
					<div>
						<p className="font-semibold text-sm">Ready for embedded signing</p>
						<p className="mt-1 text-emerald-800 text-sm leading-6">
							Your current signing turn is available.
						</p>
					</div>
				</div>
				<button
					className="inline-flex items-center gap-2 rounded-md bg-emerald-900 px-3 py-2 font-medium text-sm text-white disabled:cursor-not-allowed disabled:bg-emerald-500"
					disabled={loading}
					onClick={() => void launchSigning()}
					type="button"
				>
					<ExternalLink className="size-4" />
					{loading ? "Opening signing" : "Start signing"}
				</button>
			</div>
			{status ? (
				<p className="mt-2 text-emerald-800 text-sm">{status}</p>
			) : null}
		</div>
	);
}
