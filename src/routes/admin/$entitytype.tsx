import {
	createFileRoute,
	Outlet,
	redirect,
	useMatch,
} from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { AdminEntityViewPage } from "#/components/admin/shell/AdminEntityViewPage";
import { AdminPageSkeleton } from "#/components/admin/shell/AdminRouteStates";
import { EMPTY_ADMIN_DETAIL_SEARCH } from "#/lib/admin-detail-search";
import { isReservedAdminRouteSegment } from "#/lib/admin-entities";

const VelocityPackagesIndexPage = lazy(() =>
	import("#/components/admin/velocity/VelocityPackagesIndexPage").then(
		(module) => ({
			default: module.VelocityPackagesIndexPage,
		})
	)
);

export const Route = createFileRoute("/admin/$entitytype")({
	beforeLoad: ({ params }) => {
		if (isReservedAdminRouteSegment(params.entitytype)) {
			throw redirect({
				to: "/admin",
				search: EMPTY_ADMIN_DETAIL_SEARCH,
			});
		}
	},
	component: EntityList,
});

function EntityList() {
	const { entitytype } = Route.useParams();

	return <TypedEntityList entityType={entitytype} />;
}

function TypedEntityList({ entityType }: { entityType: string }) {
	const recordId = useMatch({
		from: "/admin/$entitytype/$recordid",
		select: (match) => match.params.recordid,
		shouldThrow: false,
	});

	if (recordId) {
		return <Outlet />;
	}

	if (entityType === "velocity") {
		return (
			<Suspense
				fallback={
					<AdminPageSkeleton descriptionWidth="w-72" titleWidth="w-64" />
				}
			>
				<VelocityPackagesIndexPage />
			</Suspense>
		);
	}

	return <AdminEntityViewPage entityType={entityType} />;
}
