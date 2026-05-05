import { createFileRoute } from "@tanstack/react-router";
import { AdminLawyerDetailPageSurface } from "#/components/admin/lawyers/AdminLawyersDetailSheet";
import type { Id } from "../../../../convex/_generated/dataModel";

export const Route = createFileRoute("/admin/lawyers/$recordid")({
	component: RouteComponent,
});

function RouteComponent() {
	const { recordid } = Route.useParams();

	return (
		<AdminLawyerDetailPageSurface
			profileId={recordid as Id<"lawyerProfiles">}
		/>
	);
}
