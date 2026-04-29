import { createFileRoute } from "@tanstack/react-router";
import { AdminMicInvestorRequestsPage } from "#/components/admin/mic-investors/AdminMicInvestorRequestsPage";

export const Route = createFileRoute("/admin/mic-investors")({
	component: AdminMicInvestorRequestsPage,
});
