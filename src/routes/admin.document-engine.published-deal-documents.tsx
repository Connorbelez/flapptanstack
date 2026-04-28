import { createFileRoute } from "@tanstack/react-router";
import { PublishedDealDocumentsPage } from "#/components/document-engine/PublishedDealDocumentsPage";

export const Route = createFileRoute(
	"/admin/document-engine/published-deal-documents"
)({
	component: PublishedDealDocumentsRoute,
});

function PublishedDealDocumentsRoute() {
	return <PublishedDealDocumentsPage />;
}
