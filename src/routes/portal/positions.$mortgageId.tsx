import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { micPositionDetailQueryOptions } from "#/components/mic/query-options";
import { Card, CardContent, CardHeader, CardTitle } from "#/components/ui/card";
import { assertActivePortalId } from "#/lib/portal/active-portal";
import type { Id } from "../../../convex/_generated/dataModel";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/portal/positions/$mortgageId")({
	component: MicPositionDetailRoutePage,
	loader: async ({ context, params }) => {
		const portalId = assertActivePortalId(
			context.portalContext,
			"MIC portal requires an active portal host."
		);
		const detail = await context.queryClient.ensureQueryData(
			micPositionDetailQueryOptions(
				portalId,
				params.mortgageId as Id<"mortgages">
			)
		);
		if (!detail.position) {
			throw notFound();
		}
		return { mortgageId: params.mortgageId };
	},
	notFoundComponent: MicPositionNotFoundComponent,
});

export function MicPositionDetailRoutePage() {
	const { mortgageId } = Route.useLoaderData();
	const { portalContext } = RootRoute.useRouteContext();
	const portalId = assertActivePortalId(
		portalContext,
		"MIC portal requires an active portal host."
	);
	const { data } = useSuspenseQuery(
		micPositionDetailQueryOptions(portalId, mortgageId as Id<"mortgages">)
	);

	if (!data.position) {
		throw notFound();
	}

	const { position } = data;

	return (
		<main className="page-wrap px-4 py-10 sm:py-12">
			<section className="mx-auto flex max-w-4xl flex-col gap-6">
				<div className="space-y-2">
					<Link
						className="inline-flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
						to="/portal"
					>
						<ArrowLeft className="size-4" />
						Back to dashboard
					</Link>
					<h1 className="font-semibold text-3xl tracking-tight">
						{position.position.propertyLabel}
					</h1>
					<p className="max-w-2xl text-muted-foreground text-sm leading-6">
						Position detail for mortgage{" "}
						<code className="rounded bg-muted px-1 py-0.5 text-xs">
							{position.mortgage.mortgageId}
						</code>
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<Card>
						<CardHeader>
							<CardTitle>Mortgage</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Principal</span>
								<span className="font-medium">
									${position.mortgage.principal.toLocaleString()}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Interest Rate</span>
								<span className="font-medium">
									{position.mortgage.interestRate}%
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Rate Type</span>
								<span className="font-medium">
									{position.mortgage.rateType}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Loan Type</span>
								<span className="font-medium">
									{position.mortgage.loanType}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Status</span>
								<span className="font-medium">{position.mortgage.status}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Maturity Date</span>
								<span className="font-medium">
									{position.mortgage.maturityDate}
								</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Position</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									Outstanding Principal
								</span>
								<span className="font-medium">
									${position.position.outstandingPrincipal.toLocaleString()}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Position Units</span>
								<span className="font-medium">
									{position.position.positionUnits.toLocaleString()}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Borrower</span>
								<span className="font-medium">
									{position.position.borrowerLabel}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Property Type</span>
								<span className="font-medium">
									{position.position.propertySummary.propertyType}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">City</span>
								<span className="font-medium">
									{position.position.propertySummary.city}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Province</span>
								<span className="font-medium">
									{position.position.propertySummary.province}
								</span>
							</div>
						</CardContent>
					</Card>
				</div>
			</section>
		</main>
	);
}

function MicPositionNotFoundComponent() {
	const { mortgageId } = Route.useParams();

	return (
		<div className="min-h-full px-4 py-16 text-foreground sm:px-6">
			<div className="mx-auto max-w-2xl rounded-3xl border border-[#E7E5E4] bg-white px-8 py-10 shadow-sm">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-full bg-[#F8EAEA] text-[#B42318]">
						<AlertCircle className="size-5" />
					</div>
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">
							Position not found
						</h1>
						<p className="mt-1 text-[#6B6B68] text-sm">
							We could not find a MIC position for mortgage{" "}
							<code>{mortgageId}</code>.
						</p>
					</div>
				</div>

				<Link
					className="mt-8 inline-flex items-center gap-2 rounded-full border border-[#E7E5E4] px-4 py-2 font-medium text-sm hover:bg-[#FBFAF8]"
					to="/portal"
					viewTransition
				>
					<ArrowLeft className="size-4" />
					Back to Dashboard
				</Link>
			</div>
		</div>
	);
}
