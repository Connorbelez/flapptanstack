import { createFileRoute } from "@tanstack/react-router";
import { DocumentEnginePackagesPage } from "#/components/document-engine/DocumentEnginePackagesPage";

export const Route = createFileRoute("/admin/document-engine/packages")({
	component: PackagesPage,
});

function PackagesPage() {
	return <DocumentEnginePackagesPage />;
}
