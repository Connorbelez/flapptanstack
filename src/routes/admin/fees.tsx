import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AdminFeesPage } from "#/components/admin/fees/admin-fees-page";
import { api } from "../../../convex/_generated/api";

const adminFeesQueryOptions = convexQuery(
	api.fees.queries.getAdminFeeManagementSnapshot,
	{}
);

export const Route = createFileRoute("/admin/fees")({
	component: AdminFeesRoutePage,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(adminFeesQueryOptions);
	},
});

function AdminFeesRoutePage() {
	const { data: snapshot, refetch } = useSuspenseQuery(adminFeesQueryOptions);

	return (
		<AdminFeesPage
			onRefresh={async () => {
				await refetch();
			}}
			snapshot={snapshot}
		/>
	);
}
