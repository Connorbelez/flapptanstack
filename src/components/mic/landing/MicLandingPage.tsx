"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { Button } from "#/components/ui/button";
import { Card, CardContent } from "#/components/ui/card";
import { MicRequestForm } from "./MicRequestForm";

interface MicLandingPageProps {
	portalSlug: string;
	signInHref: string;
}

export function MicLandingPage({
	portalSlug,
	signInHref,
}: MicLandingPageProps) {
	return (
		<main className="page-wrap flex flex-col gap-8 px-4 py-10 sm:py-12">
			<section className="space-y-4 text-center">
				<p className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.24em]">
					FairLend MIC
				</p>
				<h1 className="font-bold text-4xl tracking-tight sm:text-5xl">
					MIC Investors Portal
				</h1>
				<p className="mx-auto max-w-3xl text-base text-muted-foreground leading-7">
					Request the offering memorandum or prospectus, then sign in once your
					access has been approved to review the MIC portfolio in real time.
				</p>
			</section>

			<section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
				<Card className="border-border/70">
					<CardContent className="space-y-6 p-6 sm:p-8">
						<div className="space-y-2">
							<h2 className="font-semibold text-2xl tracking-tight">
								Transparent portfolio reporting
							</h2>
							<p className="text-muted-foreground leading-7">
								The portal is read only. Approved investors can inspect every
								mortgage position the MIC currently holds, drill into position
								detail, and review the available mortgage history surfaced from
								the ledger-backed system of record.
							</p>
						</div>
						<div className="grid gap-3 sm:grid-cols-3">
							<div className="rounded-xl border border-border/70 bg-muted/40 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
									Access
								</p>
								<p className="mt-2 font-medium">Invite only</p>
							</div>
							<div className="rounded-xl border border-border/70 bg-muted/40 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
									Experience
								</p>
								<p className="mt-2 font-medium">Read only</p>
							</div>
							<div className="rounded-xl border border-border/70 bg-muted/40 p-4">
								<p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">
									Source
								</p>
								<p className="mt-2 font-medium">Mortgage ledger</p>
							</div>
						</div>
					</CardContent>
				</Card>

				<Card className="border-border/70">
					<CardContent className="space-y-5 p-6 sm:p-8">
						<div className="space-y-2">
							<h2 className="font-semibold text-2xl tracking-tight">
								Request access materials
							</h2>
							<p className="text-muted-foreground leading-7">
								Submit your email to request the MIC offering memorandum or
								prospectus. Your request is reviewed in the admin dashboard.
							</p>
						</div>

						<MicRequestForm portalSlug={portalSlug} />

						<div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4">
							<p className="font-medium text-sm">Already approved?</p>
							<Unauthenticated>
								<Button asChild className="w-full">
									<a href={signInHref}>Sign in to the portal</a>
								</Button>
							</Unauthenticated>
							<Authenticated>
								<Button asChild className="w-full">
									<a href="/portal">Open portal</a>
								</Button>
							</Authenticated>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
