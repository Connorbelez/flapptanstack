import { createFileRoute } from "@tanstack/react-router";
import { PublishedTemplatesPage } from "#/components/document-engine/PublishedTemplatesPage";

export const Route = createFileRoute(
	"/admin/document-engine/published-templates"
)({
	component: PublishedTemplatesRoute,
});

function PublishedTemplatesRoute() {
	return <PublishedTemplatesPage />;
}
