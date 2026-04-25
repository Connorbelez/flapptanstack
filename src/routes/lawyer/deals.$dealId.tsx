import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LawyerDealWorkspacePage } from "#/components/lawyer/deals/LawyerDealWorkspacePage";
import { lawyerDealWorkspaceQueryOptions } from "#/components/lawyer/deals/query-options";
import type { Id } from "../../../convex/_generated/dataModel";

export const Route = createFileRoute("/lawyer/deals/$dealId")({
	component: LawyerDealWorkspaceRoutePage,
	loader: async ({ context, params }) => {
		await context.queryClient.ensureQueryData(
			lawyerDealWorkspaceQueryOptions(params.dealId as Id<"deals">)
		);
	},
});

export function LawyerDealWorkspaceRoutePage() {
	const { dealId } = Route.useParams();
	const { data } = useSuspenseQuery(
		lawyerDealWorkspaceQueryOptions(dealId as Id<"deals">)
	);

	if (data === null) {
		return (
			<main className="min-h-dvh bg-slate-50 px-4 py-12">
				<div className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-6 shadow-xs">
					<h1 className="font-semibold text-2xl text-slate-950">
						Matter not found
					</h1>
					<p className="mt-2 text-slate-600 text-sm">
						This closing does not exist or is no longer available to your lawyer
						workspace.
					</p>
				</div>
			</main>
		);
	}

	return <LawyerDealWorkspacePage workspace={data} />;
}
