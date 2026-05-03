import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/deals/$recordid")({
	beforeLoad: ({ params }) => {
		throw redirect({
			params: { dealId: params.recordid },
			to: "/deals/$dealId",
		});
	},
});
