import {
	ArrowRight,
	BadgeCheck,
	ClipboardList,
	ShieldCheck,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import type {
	FinancingContinuationKind,
	FinancingPrefill,
} from "#/lib/portal/financing-prefill";

export function BorrowerFinancingApplicationPage({
	kind,
	prefill,
}: {
	kind: FinancingContinuationKind;
	prefill: FinancingPrefill;
}) {
	const isPreApproval = kind === "pre-approval";
	const title = isPreApproval
		? "Pre-approval application"
		: "Financing application";
	const body = isPreApproval
		? "Continue the broker-attributed pre-approval request in the authenticated borrower workspace."
		: "Continue the broker-attributed financing request in the authenticated borrower workspace.";

	return (
		<main className="min-h-screen bg-white text-stone-950">
			<section className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
				<div>
					<p className="font-semibold text-[11px] text-emerald-900 uppercase tracking-[0.18em]">
						Authenticated Borrower Flow
					</p>
					<h1 className="mt-3 text-balance font-serif text-5xl tracking-normal">
						{title}
					</h1>
					<p className="mt-5 max-w-2xl text-pretty text-base text-stone-600 leading-8">
						{body}
					</p>
					<div className="mt-7 grid gap-3 text-sm text-stone-600">
						<div className="flex items-center gap-2">
							<BadgeCheck aria-hidden className="size-4 text-emerald-900" />
							<span>
								Broker portal attribution is preserved by the route handoff.
							</span>
						</div>
						<div className="flex items-center gap-2">
							<ShieldCheck aria-hidden className="size-4 text-emerald-900" />
							<span>
								Application data collection now happens behind borrower auth.
							</span>
						</div>
					</div>
				</div>

				<Card className="rounded-lg border-stone-200 shadow-sm">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<ClipboardList aria-hidden className="size-5 text-emerald-900" />
							Request details
						</CardTitle>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-4"
							onSubmit={(event) => {
								event.preventDefault();
							}}
						>
							<div className="grid gap-2">
								<label className="font-medium text-sm" htmlFor="fullName">
									Legal name
								</label>
								<input
									className="rounded-md border border-stone-200 px-3 py-2 text-sm"
									defaultValue={prefill.fullName}
									id="fullName"
									name="fullName"
								/>
							</div>
							<div className="grid gap-2">
								<label className="font-medium text-sm" htmlFor="email">
									Email
								</label>
								<input
									className="rounded-md border border-stone-200 px-3 py-2 text-sm"
									defaultValue={prefill.email}
									id="email"
									name="email"
									type="email"
								/>
							</div>
							<div className="grid gap-2">
								<label className="font-medium text-sm" htmlFor="amountNeeded">
									Requested amount
								</label>
								<input
									className="rounded-md border border-stone-200 px-3 py-2 text-sm"
									defaultValue={prefill.amountNeeded}
									id="amountNeeded"
									name="amountNeeded"
								/>
							</div>
							<div className="grid gap-2">
								<label
									className="font-medium text-sm"
									htmlFor="propertyAddress"
								>
									Property address
								</label>
								<input
									className="rounded-md border border-stone-200 px-3 py-2 text-sm"
									id="propertyAddress"
									name="propertyAddress"
								/>
							</div>
							<div className="grid gap-2">
								<label className="font-medium text-sm" htmlFor="requestNotes">
									Financing notes
								</label>
								<textarea
									className="min-h-28 rounded-md border border-stone-200 px-3 py-2 text-sm"
									id="requestNotes"
									name="requestNotes"
								/>
							</div>
							<Button
								className="bg-emerald-950 text-white hover:bg-emerald-900"
								type="submit"
							>
								Save application draft
								<ArrowRight aria-hidden className="size-4" />
							</Button>
						</form>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
