import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/broker/deals/$dealId")({
	beforeLoad: ({ params }) => {
		throw redirect({
			params: { dealId: params.dealId },
			to: "/deals/$dealId",
		});
	},
});
