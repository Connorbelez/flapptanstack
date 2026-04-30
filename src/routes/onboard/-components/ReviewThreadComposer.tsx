import { MessageSquarePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import {
	type AppendBrokerNoteFn,
	type BrokerOnboardingReadModel,
	getReviewThread,
} from "../-lib/viewModel";

interface ReviewThreadComposerProps {
	appendBrokerNote: AppendBrokerNoteFn;
	readModel: BrokerOnboardingReadModel;
}

function formatThreadDate(value: number) {
	return new Intl.DateTimeFormat("en-CA", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

export function ReviewThreadComposer({
	appendBrokerNote,
	readModel,
}: ReviewThreadComposerProps) {
	const [body, setBody] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const thread = getReviewThread(readModel);
	const canSend =
		readModel.application.status !== "activated" &&
		readModel.application.status !== "rejected" &&
		!readModel.isExpired;

	async function handleSend() {
		const trimmed = body.trim();
		if (!trimmed) {
			return;
		}
		setIsSending(true);
		setError(null);
		try {
			await appendBrokerNote({
				applicationId: readModel.application._id,
				body: trimmed,
			});
			setBody("");
		} catch (caught) {
			setError(
				caught instanceof Error ? caught.message : "Could not send note"
			);
		} finally {
			setIsSending(false);
		}
	}

	return (
		<section className="rounded-lg border bg-white p-5 shadow-sm">
			<div className="flex items-center gap-2">
				<MessageSquarePlus className="size-4 text-teal-700" />
				<h2 className="font-semibold text-lg">Reviewer thread</h2>
			</div>
			<div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
				{thread.length === 0 ? (
					<p className="text-sm text-stone-500">
						No review thread entries yet.
					</p>
				) : (
					thread.map((entry) => (
						<article
							className="rounded-md border bg-stone-50 p-3"
							key={String(entry._id)}
						>
							<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
								<span className="font-medium text-stone-700">
									{entry.entryType.replace("_", " ")}
								</span>
								<span className="text-stone-500">
									{formatThreadDate(entry.createdAt)}
								</span>
							</div>
							<p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">
								{entry.body}
							</p>
						</article>
					))
				)}
			</div>
			{canSend ? (
				<div className="mt-4 grid gap-2">
					<Textarea
						onChange={(event) => setBody(event.target.value)}
						placeholder="Add context for the reviewer"
						value={body}
					/>
					<div className="flex items-center justify-between gap-3">
						<p className="text-stone-500 text-xs">
							Notes append to the application review thread and cannot be edited
							here.
						</p>
						<Button
							disabled={isSending || !body.trim()}
							onClick={() => void handleSend()}
							size="sm"
						>
							{isSending ? "Sending..." : "Add note"}
						</Button>
					</div>
					{error ? <p className="text-destructive text-sm">{error}</p> : null}
				</div>
			) : null}
		</section>
	);
}
