import { createFileRoute, Outlet, useMatch } from "@tanstack/react-router";
import { AdminLawyersPage } from "#/components/admin/lawyers/AdminLawyersPage";

export const Route = createFileRoute("/admin/lawyers")({
	component: LawyersList,
});

function LawyersList() {
	const recordId = useMatch({
		from: "/admin/lawyers/$recordid",
		select: (match) => match.params.recordid,
		shouldThrow: false,
	});

	if (recordId) {
		return <Outlet />;
	}

	return <AdminLawyersPage />;
}
