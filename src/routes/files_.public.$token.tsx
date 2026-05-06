import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import {
	PublicFileViewPage,
	type PublicFileViewState,
} from "#/components/file-workspace/PublicFileViewPage";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const Route = createFileRoute("/files_/public/$token")({
	component: PublicFileWorkspaceRoutePage,
});

export function PublicFileWorkspaceRoutePage() {
	const { token } = Route.useParams();
	const resolveBearerLink = useMutation(
		api.fileWorkspace.shareLinks.resolveBearerLink
	);
	const listBearerNodes = useMutation(
		api.fileWorkspace.readModels.listBearerNodes
	);
	const getBearerPreviewUrl = useMutation(
		api.fileWorkspace.versions.getBearerPreviewUrl
	);
	const getBearerDownloadUrl = useMutation(
		api.fileWorkspace.versions.getBearerDownloadUrl
	);
	const [state, setState] = useState<PublicFileViewState>({ kind: "loading" });

	useEffect(() => {
		let active = true;
		setState({ kind: "loading" });
		resolveBearerLink({ rawToken: token })
			.then(async (link) => {
				if (!link.rootNodeId) {
					throw new Error("Public file share root is unavailable.");
				}
				const nodeList = await listBearerNodes({
					parentNodeId: link.rootNodeId,
					rawToken: token,
				});
				if (active) {
					setState({ kind: "ready", link, nodeList });
				}
			})
			.catch(() => {
				if (active) {
					setState({ kind: "inaccessible" });
				}
			});
		return () => {
			active = false;
		};
	}, [listBearerNodes, resolveBearerLink, token]);

	async function openFolder(nodeId: string) {
		if (state.kind !== "ready") {
			return;
		}
		const nodeList = await listBearerNodes({
			parentNodeId: nodeId as Id<"fileNodes">,
			rawToken: token,
		});
		setState({ ...state, nodeList });
	}

	function openStorageUrl(result: { denied?: true; url?: string | null }) {
		if (result.denied || !result.url) {
			return;
		}
		window.open(result.url, "_blank", "noopener,noreferrer");
	}

	return (
		<PublicFileViewPage
			onDownload={async (nodeId) =>
				openStorageUrl(
					await getBearerDownloadUrl({
						nodeId: nodeId as Id<"fileNodes">,
						rawToken: token,
					})
				)
			}
			onOpenFolder={(nodeId) => void openFolder(nodeId)}
			onPreview={async (nodeId) =>
				openStorageUrl(
					await getBearerPreviewUrl({
						nodeId: nodeId as Id<"fileNodes">,
						rawToken: token,
					})
				)
			}
			state={state}
		/>
	);
}
