import { ArrowUpRight } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { cn } from "#/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import { isValidMicAccessEmail } from "./micLandingEmail";

export type MicLandingSubmitRequest = (args: {
	email: string;
	portalId: Id<"portals">;
}) => Promise<unknown>;

export interface MicLandingPageViewProps {
	portalId: string;
	portalSlug: string;
	submitRequest: MicLandingSubmitRequest;
}

export function MicLandingPageView({
	portalId,
	portalSlug,
	submitRequest,
}: MicLandingPageViewProps) {
	const [email, setEmail] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [serverError, setServerError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const year = new Date().getFullYear();

	const handleSubmit = useCallback(
		async (e: FormEvent) => {
			e.preventDefault();
			setValidationError(null);
			setServerError(null);

			const trimmedEmail = email.trim();
			if (!isValidMicAccessEmail(trimmedEmail)) {
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
		<main
			className={cn(
				"relative isolate min-h-[100dvh] overflow-hidden antialiased",
				"bg-[oklch(0.11_0.012_165)] text-[oklch(0.93_0.018_85)]"
			)}
		>
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,oklch(0.2_0.04_195/0.35),transparent_55%),radial-gradient(ellipse_70%_45%_at_50%_105%,oklch(0.08_0.02_165/0.9),transparent_50%)]"
			/>

			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 flex select-none items-center justify-center overflow-hidden"
			>
				<span
					className="translate-y-[-4%] whitespace-nowrap font-medium font-serif text-[clamp(5.5rem,22vw,13rem)] text-[oklch(0.96_0.01_90)]/[0.055] tracking-[-0.04em]"
					style={{ fontFamily: "'Fraunces', Georgia, serif" }}
				>
					FAIRLEND
				</span>
			</div>

			<div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-between px-6 pt-7 md:px-10 md:pt-10">
				<span
					className="font-medium text-base tracking-wide md:text-lg"
					style={{ fontFamily: "'Fraunces', Georgia, serif" }}
				>
					FairLend
				</span>
				<span className="max-w-[10rem] text-right font-medium font-sans text-[10px] text-[oklch(0.93_0.015_85)]/60 uppercase leading-relaxed tracking-[0.42em]">
					Investor platform
				</span>
			</div>

			<div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-between gap-6 px-6 pb-7 md:px-10 md:pb-10">
				<span className="font-sans text-[10px] text-[oklch(0.93_0.015_85)]/40 uppercase tracking-[0.28em]">
					© {year} FairLend Inc.
				</span>
				<span className="max-w-[14rem] text-right font-sans text-[10px] text-[oklch(0.93_0.015_85)]/40 uppercase leading-relaxed tracking-[0.22em]">
					Regulated offering materials on request
				</span>
			</div>

			<div className="relative z-10 flex min-h-[100dvh] flex-col">
				{isSuccess ? (
					<div className="motion-safe:fade-in flex flex-1 flex-col items-center justify-center px-6 pt-24 pb-28 text-center motion-safe:animate-in motion-safe:duration-700">
						<h2
							className="font-medium text-3xl tracking-tight sm:text-4xl"
							style={{ fontFamily: "'Fraunces', Georgia, serif" }}
						>
							Request received
						</h2>
						<p className="mt-5 max-w-md text-[oklch(0.93_0.015_85)]/65 text-sm leading-relaxed">
							Your request has been received. We will review it and get back to
							you shortly.
						</p>
						<button
							className="mt-12 border border-white/20 bg-transparent px-6 py-2.5 font-medium font-sans text-[11px] text-[oklch(0.93_0.015_85)]/80 uppercase tracking-[0.2em] transition-colors hover:border-white/35 hover:text-[oklch(0.96_0.01_90)]"
							onClick={() => setIsSuccess(false)}
							type="button"
						>
							Submit another request
						</button>
					</div>
				) : (
					<>
						<div className="motion-safe:fade-in motion-safe:slide-in-from-bottom-2 flex flex-1 flex-col items-center justify-center px-6 pt-28 pb-12 text-center motion-safe:animate-in motion-safe:duration-700 md:pt-32">
							<p className="mb-5 font-medium font-sans text-[10px] text-[oklch(0.93_0.015_85)]/50 uppercase tracking-[0.45em]">
								Private access
							</p>
							<h1
								className="mb-6 max-w-[16ch] font-medium text-[clamp(2.35rem,6.5vw,4rem)] leading-[1.06] tracking-[-0.02em]"
								style={{ fontFamily: "'Fraunces', Georgia, serif" }}
							>
								{`${portalSlug} portal`}
							</h1>
							<p className="mb-14 max-w-md font-sans text-[oklch(0.93_0.015_85)]/68 text-sm leading-relaxed">
								Request access to offering memorandums and prospectuses. Sign in
								to view protected investor materials and your portfolio
								dashboard.
							</p>

							<a
								className="group inline-flex items-center gap-3 rounded-full bg-[oklch(0.94_0.02_95)] px-7 py-3 pl-8 font-medium font-sans text-[oklch(0.14_0.02_165)] text-sm transition-[opacity,transform] hover:opacity-95 active:scale-[0.99]"
								href="/sign-in?redirect=/portal"
							>
								Sign in
								<span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-[oklch(0.14_0.02_165)] text-[oklch(0.94_0.02_95)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
									<ArrowUpRight
										aria-hidden
										className="size-4"
										strokeWidth={2}
									/>
								</span>
							</a>
							<a
								className="mt-9 font-medium font-sans text-[11px] text-[oklch(0.93_0.015_85)]/45 uppercase tracking-[0.22em] underline-offset-4 transition-colors hover:text-[oklch(0.93_0.015_85)]/75 hover:underline"
								href="/sign-up?redirect=/portal"
							>
								Sign up
							</a>
						</div>

						<section
							aria-labelledby="mic-access-request"
							className="border-white/10 border-t px-6 py-16 pb-32 md:py-20 md:pb-36"
						>
							<div className="mx-auto max-w-md">
								<h2
									className="font-medium text-xl tracking-tight sm:text-2xl"
									id="mic-access-request"
									style={{ fontFamily: "'Fraunces', Georgia, serif" }}
								>
									Request offering memorandum / prospectus
								</h2>
								<p className="mt-3 font-sans text-[oklch(0.93_0.015_85)]/52 text-sm leading-relaxed">
									Enter your email to request access to investor materials.
								</p>

								<form className="mt-12 space-y-10" onSubmit={handleSubmit}>
									<div>
										<label
											className="mb-3 block font-medium font-sans text-[10px] text-[oklch(0.93_0.015_85)]/45 uppercase tracking-[0.28em]"
											htmlFor="mic-email"
										>
											Email address
										</label>
										<input
											aria-invalid={!!validationError}
											className="w-full border-0 border-white/20 border-b bg-transparent py-3 font-sans text-[oklch(0.96_0.01_90)] text-base outline-none transition-[border-color] placeholder:text-[oklch(0.93_0.015_85)]/30 focus:border-white/45"
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
										{validationError ? (
											<p className="mt-3 font-sans text-red-300/95 text-sm">
												{validationError}
											</p>
										) : null}
									</div>

									{serverError ? (
										<div
											className="rounded-lg border border-red-400/25 bg-red-950/35 p-4 font-sans text-red-100/90 text-sm leading-relaxed"
											role="alert"
										>
											{serverError}
										</div>
									) : null}

									<button
										className="rounded-full border border-white/22 bg-white/[0.06] px-10 py-3.5 font-medium font-sans text-[11px] text-[oklch(0.93_0.015_85)]/90 uppercase tracking-[0.18em] transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.1] disabled:opacity-45"
										disabled={isSubmitting}
										type="submit"
									>
										{isSubmitting ? "Submitting..." : "Request access"}
									</button>
								</form>
							</div>
						</section>
					</>
				)}
			</div>
		</main>
	);
}
