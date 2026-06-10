import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OfflinePaymentOperationsPage } from "#/components/admin/offline-payments/OfflinePaymentOperationsPage";
import { offlinePaymentOperationsQueryOptions } from "#/components/admin/offline-payments/query-options";
import {
	cleanOfflinePaymentOperationsSearch,
	parseOfflinePaymentOperationsSearch,
} from "#/components/admin/offline-payments/search";

export const Route = createFileRoute("/admin/offline-payment-operations")({
	component: OfflinePaymentOperationsRoutePage,
	loaderDeps: ({ search }) => ({
		search,
	}),
	loader: async ({ context, deps }) => {
		await context.queryClient.ensureQueryData(
			offlinePaymentOperationsQueryOptions(deps.search)
		);
	},
	validateSearch: (search: Record<string, unknown>) =>
		parseOfflinePaymentOperationsSearch(search),
});

function OfflinePaymentOperationsRoutePage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryOptions = offlinePaymentOperationsQueryOptions(search);
	const { data, refetch } = useSuspenseQuery(queryOptions);

	return (
		<OfflinePaymentOperationsPage
			onRefresh={async () => refetch()}
			search={search}
			setSearch={(updater) => {
				const nextSearch = cleanOfflinePaymentOperationsSearch(updater(search));
				void navigate({
					search: {
						...nextSearch,
						detailOpen: search.detailOpen,
						entityType: search.entityType,
						recordId: search.recordId,
						staffOverdueOnly: nextSearch.staffOverdueOnly ?? false,
						view: nextSearch.view ?? "board",
					},
					to: "/admin/offline-payment-operations",
				});
			}}
			snapshot={data}
		/>
	);
}
