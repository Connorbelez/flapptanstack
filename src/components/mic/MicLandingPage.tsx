import { useMutation } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface MicLandingPageProps {
	portalId: string;
	portalSlug: string;
}

export function MicLandingPage({ portalId, portalSlug }: MicLandingPageProps) {
	const [email, setEmail] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const submitRequest = useMutation(
		api.micInvestorAccessRequests.mutations.submitPublicRequest
	);

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault();
			setValidationError(null);
			setServerError(null);

			const trimmedEmail = email.trim();
			if (!EMAIL_REGEX.test(trimmedEmail)) {
				setValidationError("Enter a valid email address");
				return;
			}

			setIsSubmitting(true);
			try {
				await submitRequest({
					email: trimmedEmail,
					portalId: portalId as Id<"portals">,
				});
				setIsSuccess(true);
				setEmail("");
			} catch (err) {
				setServerError(
					err instanceof Error
						? err.message
						: "Something went wrong. Please try again."
				);
			} finally {
				setIsSubmitting(false);
			}
		},
		[email, portalId, submitRequest]
	);

	return (
		<main className="page-wrap flex flex-col gap-8 px-4 py-10 sm:py-12">
			<div className="space-y-3 text-center">
				<h1 className="font-bold text-4xl tracking-tight">
					{portalSlug} portal
				</h1>
				<p className="mx-auto max-w-2xl text-muted-foreground">
					Request access to offering memorandums and prospectuses. Sign in to
					view protected investor materials.
				</p>
			</div>

			{isSuccess ? (
				<Card className="mx-auto w-full max-w-lg">
					<CardHeader>
						<CardTitle>Request received</CardTitle>
						<CardDescription>
							Your request has been received. We will review it and get back to
							you shortly.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button onClick={() => setIsSuccess(false)} variant="outline">
							Submit another request
						</Button>
					</CardContent>
				</Card>
			) : (
				<Card className="mx-auto w-full max-w-lg">
					<CardHeader>
						<CardTitle>Request offering memorandum / prospectus</CardTitle>
						<CardDescription>
							Enter your email to request access to investor materials.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form className="space-y-4" onSubmit={handleSubmit}>
							<div className="space-y-2">
								<Label htmlFor="mic-email">Email address</Label>
								<Input
									aria-invalid={!!validationError}
									id="mic-email"
									onChange={(e) => {
										setEmail(e.target.value);
										setValidationError(null);
										setServerError(null);
									}}
									placeholder="you@example.com"
									type="email"
									value={email}
								/>
								{validationError && (
									<p className="text-destructive text-sm">{validationError}</p>
								)}
							</div>

							{serverError && (
								<div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm">
									{serverError}
								</div>
							)}

							<Button disabled={isSubmitting} type="submit">
								{isSubmitting ? "Submitting..." : "Request access"}
							</Button>
						</form>
					</CardContent>
				</Card>
			)}

			<div className="flex flex-wrap justify-center gap-3">
				<Button asChild>
					<a href="/sign-in?redirect=/portal">Sign in</a>
				</Button>
				<Button asChild variant="outline">
					<a href="/sign-up?redirect=/portal">Sign up</a>
				</Button>
			</div>
		</main>
	);
}
