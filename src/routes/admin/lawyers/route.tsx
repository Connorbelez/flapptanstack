import { createFileRoute } from "@tanstack/react-router";
import { AdminLawyersPage } from "#/components/admin/lawyers/AdminLawyersPage";

export const Route = createFileRoute("/admin/lawyers")({
	component: AdminLawyersPage,
});
