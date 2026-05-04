import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeDollarSign } from "lucide-react";
import { Button } from "#/components/ui/button";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { api } from "../../../convex/_generated/api";

const feeRevenueQueryOptions = convexQuery(
	api.fees.queries.getFeeRevenueSummary,
	{}
);

export const Route = createFileRoute("/admin/")({
	component: AdminIndexRoutePage,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(feeRevenueQueryOptions);
	},
});

function AdminIndexRoutePage() {
	const { data: revenue } = useSuspenseQuery(feeRevenueQueryOptions);

	return (
		<div className="space-y-6 p-4 md:p-6">
			<section className="flex flex-col gap-4 border-border/70 border-b pb-5 md:flex-row md:items-end md:justify-between">
				<div>
					<p className="text-muted-foreground text-sm">Backoffice control</p>
					<h1 className="font-semibold text-2xl">Admin Dashboard</h1>
				</div>
				<Button asChild variant="outline">
					<Link search={EMPTY_ADMIN_DETAIL_SEARCH} to="/admin/fees">
						<BadgeDollarSign className="size-4" />
						Fees
					</Link>
				</Button>
			</section>
			<section className="grid gap-3 md:grid-cols-4">
				<Metric
					label="Fee income"
					value={formatMoney(revenue.totalIncomeCents)}
				/>
				<Metric
					label="Borrower charges"
					value={formatMoney(revenue.borrowerChargeIncomeCents)}
				/>
				<Metric
					label="Waterfall fees"
					value={formatMoney(revenue.waterfallIncomeCents)}
				/>
				<Metric
					label="Open receivable"
					value={formatMoney(revenue.openAccountsReceivableCents)}
				/>
			</section>
		</div>
	);
}

function formatMoney(cents: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		style: "currency",
	}).format(cents / 100);
}

function Metric({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-4">
			<div className="text-muted-foreground text-sm">{label}</div>
			<div className="mt-1 font-semibold text-xl tabular-nums">{value}</div>
		</div>
	);
}
