"use client";

import { useMutation } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { api } from "../../../../convex/_generated/api";

export function MicRequestForm({ portalSlug }: { portalSlug: string }) {
	const submitRequest = useMutation(
		api.micInvestorAccess.mutations.submitRequest
	);
	const [email, setEmail] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setIsSubmitting(true);
		try {
			await submitRequest({
				email,
				portalSlug,
			});
			toast.success(
				"Request received. We will follow up by email after review."
			);
			setEmail("");
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Unable to submit your request right now."
			);
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form className="space-y-3" onSubmit={handleSubmit}>
			<label className="block font-medium text-sm" htmlFor="mic-request-email">
				Request offering memorandum / prospectus
			</label>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Input
					autoComplete="email"
					id="mic-request-email"
					inputMode="email"
					onChange={(event) => setEmail(event.target.value)}
					placeholder="name@example.com"
					required
					type="email"
					value={email}
				/>
				<Button disabled={isSubmitting} type="submit">
					{isSubmitting ? "Submitting..." : "Request access"}
				</Button>
			</div>
		</form>
	);
}
