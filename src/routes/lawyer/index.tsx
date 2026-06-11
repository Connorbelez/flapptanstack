import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { LawyerAssignedClosingsPage } from "#/components/lawyer/deals/LawyerAssignedClosingsPage";
import { lawyerAssignedClosingsQueryOptions } from "#/components/lawyer/deals/query-options";
import { guardRouteAccess } from "#/lib/auth";

export const Route = createFileRoute("/lawyer/")({
	beforeLoad: guardRouteAccess("lawyer"),
	component: LawyerIndexRoutePage,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			lawyerAssignedClosingsQueryOptions()
		);
	},
});

export function LawyerIndexRoutePage() {
	const { data } = useSuspenseQuery(lawyerAssignedClosingsQueryOptions());
	return <LawyerAssignedClosingsPage matters={data} />;
}
