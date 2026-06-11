import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/borrower/deals")({
	beforeLoad: () => {
		throw redirect({ to: "/lender/deals" });
	},
});
