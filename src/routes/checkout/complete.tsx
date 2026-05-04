import { createFileRoute, Link } from "@tanstack/react-router";
import { Authenticated, AuthLoading, useAction, useQuery } from "convex/react";
import {
	AlertCircle,
	CheckCircle2,
	Clock3,
	ExternalLink,
	FileText,
	Home,
	ReceiptText,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AppRoutePendingScreen } from "#/components/AppRoutePendingScreen";
import { Button } from "#/components/ui/button";
import { guardAuthenticated } from "#/lib/auth";
import { api } from "../../../convex/_generated/api";

export const Route = createFileRoute("/checkout/complete")({
	beforeLoad: guardAuthenticated(),
	validateSearch: (search: Record<string, unknown>) => ({
		stripeCheckoutSessionId:
			typeof search.stripeCheckoutSessionId === "string"
				? search.stripeCheckoutSessionId
				: undefined,
	}),
	component: CheckoutCompleteRouteComponent,
});

function CheckoutCompleteRouteComponent() {
	return (
		<>
			<Authenticated>
				<CheckoutCompletePage />
			</Authenticated>
			<AuthLoading>
				<AppRoutePendingScreen />
			</AuthLoading>
		</>
	);
}

function CheckoutCompletePage() {
	const { stripeCheckoutSessionId } = Route.useSearch();
	const [receiptError, setReceiptError] = useState<string | null>(null);
	const [isReceiptPending, setIsReceiptPending] = useState(false);
	const [syncError, setSyncError] = useState<string | null>(null);
	const [syncedStripeSessionId, setSyncedStripeSessionId] = useState<
		string | null
	>(null);
	const [handoffError, setHandoffError] = useState<string | null>(null);
	const [handoffRequestedCheckoutId, setHandoffRequestedCheckoutId] = useState<
		string | null
	>(null);
	const getReceiptUrl = useAction(
		api.checkout.actions.getMarketplaceCheckoutReceiptUrl
	);
	const syncCheckout = useAction(
		api.checkout.actions.syncMarketplaceCheckoutFromStripe
	);
	const createDealFromPaidCheckout = useAction(
		api.checkout.dealHandoff.createDealFromPaidCheckoutForViewer
	);
	const confirmation = useQuery(
		api.checkout.queries.getMarketplaceCheckoutConfirmation,
		stripeCheckoutSessionId ? { stripeCheckoutSessionId } : "skip"
	);

	useEffect(() => {
		if (
			!stripeCheckoutSessionId ||
			syncedStripeSessionId === stripeCheckoutSessionId
		) {
			return;
		}
		let cancelled = false;
		setSyncedStripeSessionId(stripeCheckoutSessionId);
		setSyncError(null);
		void syncCheckout({ stripeCheckoutSessionId })
			.then((result) => {
				if (cancelled || result.ok) {
					return;
				}
				setSyncError(result.message);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				console.error("[CheckoutCompletePage] Stripe checkout sync failed", {
					error,
					stripeCheckoutSessionId,
				});
				setSyncError("Unable to refresh Stripe checkout status right now.");
			});
		return () => {
			cancelled = true;
		};
	}, [stripeCheckoutSessionId, syncCheckout, syncedStripeSessionId]);

	useEffect(() => {
		if (
			!confirmation ||
			confirmation.status !== "completed" ||
			confirmation.dealId ||
			handoffRequestedCheckoutId === String(confirmation.checkoutSessionId)
		) {
			return;
		}
		let cancelled = false;
		const checkoutSessionId = confirmation.checkoutSessionId;
		setHandoffRequestedCheckoutId(String(checkoutSessionId));
		setHandoffError(null);
		void createDealFromPaidCheckout({ checkoutSessionId })
			.then((result) => {
				if (cancelled || result.ok) {
					return;
				}
				setHandoffError(result.message);
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}
				console.error("[CheckoutCompletePage] deal handoff failed", {
					checkoutSessionId: String(checkoutSessionId),
					error,
				});
				setHandoffError("Unable to prepare the lender deal portal right now.");
			});
		return () => {
			cancelled = true;
		};
	}, [confirmation, createDealFromPaidCheckout, handoffRequestedCheckoutId]);

	async function openStripeReceipt() {
		if (!stripeCheckoutSessionId) {
			return;
		}
		setReceiptError(null);
		setIsReceiptPending(true);
		try {
			const result = await getReceiptUrl({ stripeCheckoutSessionId });
			if (!result.ok) {
				setReceiptError(result.message);
				return;
			}
			window.open(result.receiptUrl, "_blank", "noopener,noreferrer");
		} catch (error) {
			console.error("[CheckoutCompletePage] Stripe receipt lookup failed", {
				error,
				stripeCheckoutSessionId,
			});
			setReceiptError("Unable to load the Stripe receipt right now.");
		} finally {
			setIsReceiptPending(false);
		}
	}

	if (!stripeCheckoutSessionId) {
		return (
			<CheckoutShell>
				<StatusPanel
					description="Stripe returned without a checkout session reference. Return to listings and contact FairLend support if the payment was completed."
					icon={<AlertCircle className="size-6" />}
					title="Checkout session missing"
					tone="error"
				/>
			</CheckoutShell>
		);
	}

	if (confirmation === undefined) {
		return (
			<CheckoutShell>
				<StatusPanel
					description="FairLend is loading the Stripe checkout handoff."
					icon={<Clock3 className="size-6 animate-pulse" />}
					title="Confirming checkout"
					tone="pending"
				/>
			</CheckoutShell>
		);
	}

	if (confirmation === null) {
		return (
			<CheckoutShell>
				<StatusPanel
					description="No checkout owned by your account matches this Stripe session. Return to listings or contact FairLend support with the session id below."
					icon={<AlertCircle className="size-6" />}
					title="Checkout not found"
					tone="error"
				/>
				<ReferencePanel
					items={[["Stripe checkout session", stripeCheckoutSessionId]]}
				/>
			</CheckoutShell>
		);
	}

	const statusView = statusViewFor(confirmation.status);

	return (
		<CheckoutShell>
			<StatusPanel
				description={statusView.description}
				icon={statusIcon(statusView.tone)}
				title={statusView.title}
				tone={statusView.tone}
			/>

			<section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
				<div className="rounded-lg border border-border bg-card p-5">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Deal Summary
					</p>
					<h2 className="mt-3 font-semibold text-2xl leading-tight">
						{confirmation.listing?.title ?? "Marketplace mortgage"}
					</h2>
					<div className="mt-5 grid gap-3 sm:grid-cols-3">
						<Metric
							label="Fractions"
							value={confirmation.requestedFractions.toLocaleString()}
						/>
						<Metric
							label="Lock Fee"
							value={formatMoney(
								confirmation.lockFeeAmount,
								confirmation.lockFeeCurrency
							)}
						/>
						<Metric label="Status" value={formatStatus(confirmation.status)} />
					</div>
					<div className="mt-5 rounded-lg border border-border/70 bg-muted/25 p-4">
						<p className="text-muted-foreground text-sm">Closing counsel</p>
						<p className="mt-1 font-medium">
							{confirmation.selectedLawyer.name}
						</p>
						<p className="text-muted-foreground text-sm">
							{confirmation.selectedLawyer.email}
						</p>
					</div>
				</div>

				<aside className="space-y-3 rounded-lg border border-border bg-card p-5">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Next Actions
					</p>
					{confirmation.dealId ? (
						<Button asChild className="w-full justify-between">
							<Link
								params={{ dealId: String(confirmation.dealId) }}
								to="/lender/deals/$dealId"
							>
								<span>Open lender deal portal</span>
								<ExternalLink className="size-4" />
							</Link>
						</Button>
					) : (
						<Button className="w-full justify-between" disabled type="button">
							<span>{dealPortalUnavailableLabel(confirmation.status)}</span>
							{statusView.tone === "pending" ? (
								<Clock3 className="size-4" />
							) : (
								<AlertCircle className="size-4" />
							)}
						</Button>
					)}
					{syncError ? (
						<p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 text-sm dark:text-red-200">
							{syncError}
						</p>
					) : null}
					{handoffError ? (
						<p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 text-sm dark:text-red-200">
							{handoffError}
						</p>
					) : null}
					<Button asChild className="w-full justify-between" variant="outline">
						{confirmation.listing ? (
							<Link
								params={{ listingId: String(confirmation.listing.id) }}
								to="/listings/$listingId"
							>
								<span>Return to listing</span>
								<Home className="size-4" />
							</Link>
						) : (
							<Link to="/listings">
								<span>Return to listings</span>
								<Home className="size-4" />
							</Link>
						)}
					</Button>
					<Button
						className="w-full justify-between"
						disabled={!confirmation.stripePaymentIntentId || isReceiptPending}
						onClick={openStripeReceipt}
						type="button"
						variant="outline"
					>
						<span>
							{isReceiptPending
								? "Loading Stripe receipt"
								: "Open Stripe receipt"}
						</span>
						<ReceiptText className="size-4" />
					</Button>
					<div className="rounded-lg border border-border border-dashed p-3 text-muted-foreground text-sm">
						<div className="flex items-center gap-2 font-medium text-foreground">
							<ReceiptText className="size-4" />
							Stripe receipt
						</div>
						<p className="mt-2 leading-5">
							Stripe emails the official receipt after payment. This button
							retrieves the same hosted receipt from Stripe once the payment
							intent is available.
						</p>
						{receiptError ? (
							<p className="mt-2 text-red-600 dark:text-red-300">
								{receiptError}
							</p>
						) : null}
					</div>
					<Button asChild className="w-full justify-between" variant="ghost">
						<Link to="/lender/deals">
							<span>View lender deal queue</span>
							<FileText className="size-4" />
						</Link>
					</Button>
				</aside>
			</section>

			<ReferencePanel
				items={[
					["Checkout session", String(confirmation.checkoutSessionId)],
					[
						"Stripe checkout session",
						confirmation.stripeCheckoutSessionId ?? "-",
					],
					["Stripe payment intent", confirmation.stripePaymentIntentId ?? "-"],
				]}
			/>
		</CheckoutShell>
	);
}

function CheckoutShell({ children }: { children: ReactNode }) {
	return (
		<main className="min-h-full bg-background px-4 py-8 text-foreground sm:px-6 lg:px-10">
			<div className="mx-auto max-w-5xl space-y-5">{children}</div>
		</main>
	);
}

function StatusPanel({
	description,
	icon,
	title,
	tone,
}: {
	description: string;
	icon: ReactNode;
	title: string;
	tone: "error" | "pending" | "success";
}) {
	const toneClass = statusToneClass(tone);
	return (
		<section className="rounded-lg border border-border bg-card p-5">
			<div className="flex gap-4">
				<div
					className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${toneClass}`}
				>
					{icon}
				</div>
				<div className="min-w-0">
					<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.16em]">
						Hosted Checkout
					</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-tight">
						{title}
					</h1>
					<p className="mt-2 max-w-2xl text-muted-foreground leading-6">
						{description}
					</p>
				</div>
			</div>
		</section>
	);
}

type CheckoutStatusTone = "error" | "pending" | "success";

function statusViewFor(status: string): {
	readonly description: string;
	readonly title: string;
	readonly tone: CheckoutStatusTone;
} {
	if (status === "completed") {
		return {
			description:
				"Stripe payment was received. FairLend has locked the selected fractions and prepared the deal workspace.",
			title: "Fraction lock confirmed",
			tone: "success",
		};
	}
	if (status === "refunded_late_success") {
		return {
			description:
				"Stripe payment was received after the local lock window had already closed. FairLend has recorded the payment for refund review.",
			title: "Payment received after lock expiry",
			tone: "error",
		};
	}
	if (status === "expired") {
		return {
			description:
				"The local lock window expired before FairLend confirmed payment. If Stripe shows a successful payment, use the support references below.",
			title: "Lock window expired",
			tone: "error",
		};
	}
	if (status === "abandoned" || status === "provider_start_failed") {
		return {
			description:
				"FairLend could not complete this hosted checkout. Return to the listing to start a fresh lock.",
			title: "Checkout not completed",
			tone: "error",
		};
	}
	return {
		description:
			"Stripe has returned control to FairLend. Payment reconciliation is refreshing now.",
		title: "Checkout received",
		tone: "pending",
	};
}

function statusIcon(tone: CheckoutStatusTone): ReactNode {
	if (tone === "success") {
		return <CheckCircle2 className="size-6" />;
	}
	if (tone === "error") {
		return <AlertCircle className="size-6" />;
	}
	return <Clock3 className="size-6 animate-pulse" />;
}

function dealPortalUnavailableLabel(status: string): string {
	if (status === "completed") {
		return "Preparing lender deal portal";
	}
	if (status === "refunded_late_success") {
		return "Refund review pending";
	}
	return "Deal portal unavailable";
}

function statusToneClass(tone: "error" | "pending" | "success"): string {
	if (tone === "success") {
		return "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300";
	}
	if (tone === "error") {
		return "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300";
	}
	return "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300";
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-lg border border-border/70 bg-background/50 p-4">
			<p className="text-muted-foreground text-sm">{label}</p>
			<p className="mt-2 font-semibold text-xl">{value}</p>
		</div>
	);
}

function ReferencePanel({ items }: { items: [string, string][] }) {
	return (
		<section className="rounded-lg border border-border bg-card p-5">
			<div className="flex items-center gap-2">
				<FileText className="size-4 text-muted-foreground" />
				<p className="font-medium">Support references</p>
			</div>
			<dl className="mt-4 grid gap-3 text-sm">
				{items.map(([label, value]) => (
					<div
						className="grid gap-1 rounded-md bg-muted/25 p-3 sm:grid-cols-[180px_minmax(0,1fr)]"
						key={label}
					>
						<dt className="text-muted-foreground">{label}</dt>
						<dd className="break-all font-mono">{value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function formatMoney(amount: number, currency: string): string {
	return new Intl.NumberFormat("en-CA", {
		currency,
		style: "currency",
	}).format(amount / 100);
}

function formatStatus(status: string): string {
	return status
		.split("_")
		.map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
		.join(" ");
}
