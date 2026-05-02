import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import {
	type BoxIndexFilter,
	BoxIndexPage,
} from "#/components/file-workspace/BoxIndexPage";
import { fileWorkspaceBoxIndexQueryOptions } from "#/components/file-workspace/query-options";
import { api } from "../../../convex/_generated/api";

const BOX_INDEX_FILTERS = new Set<BoxIndexFilter>([
	"all",
	"owned",
	"shared",
	"public",
	"archived",
]);

function readActiveFilter(): BoxIndexFilter {
	if (typeof window === "undefined") {
		return "all";
	}
	const filter = new URLSearchParams(window.location.search).get("filter");
	return filter && BOX_INDEX_FILTERS.has(filter as BoxIndexFilter)
		? (filter as BoxIndexFilter)
		: "all";
}

export const Route = createFileRoute("/files/")({
	component: FilesIndexRoutePage,
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(
			fileWorkspaceBoxIndexQueryOptions()
		);
	},
});

export function FilesIndexRoutePage() {
	const { data: boxes } = useSuspenseQuery(fileWorkspaceBoxIndexQueryOptions());
	const createBox = useMutation(api.fileWorkspace.boxes.createBox);
	const activeFilter = readActiveFilter();

	async function handleCreateBox(name: string) {
		const created = await createBox({ name });
		window.location.assign(`/files/${created.boxId}`);
	}

	return (
		<BoxIndexPage
			activeFilter={activeFilter}
			boxes={boxes}
			onCreateBox={handleCreateBox}
			onFilterChange={(filter) => {
				const search = new URLSearchParams(window.location.search);
				if (filter === "all") {
					search.delete("filter");
				} else {
					search.set("filter", filter);
				}
				window.location.assign(`/files${search.size > 0 ? `?${search}` : ""}`);
			}}
		/>
	);
}
