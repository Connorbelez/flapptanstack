import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/lawyer/deals/$dealId")({
	beforeLoad: ({ params }) => {
		throw redirect({
			params: { dealId: params.dealId },
			to: "/deals/$dealId",
		});
	},
});
