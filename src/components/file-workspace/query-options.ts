import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export function fileWorkspaceBoxIndexQueryOptions() {
	return convexQuery(api.fileWorkspace.readModels.listBoxIndex, {});
}

export function fileWorkspaceBoxQueryOptions(boxId: Id<"fileBoxes">) {
	return convexQuery(api.fileWorkspace.boxes.getBox, { boxId });
}

export function fileWorkspaceCapabilitiesQueryOptions(boxId: Id<"fileBoxes">) {
	return convexQuery(api.fileWorkspace.readModels.getCapabilityPreview, {
		boxId,
	});
}

export function fileWorkspaceManagerSettingsQueryOptions(
	boxId: Id<"fileBoxes">
) {
	return convexQuery(api.fileWorkspace.readModels.getManagerSettings, {
		boxId,
	});
}

export function fileWorkspaceNodesQueryOptions(
	boxId: Id<"fileBoxes">,
	parentNodeId: Id<"fileNodes">
) {
	return convexQuery(api.fileWorkspace.readModels.listNodes, {
		boxId,
		parentNodeId,
	});
}

export function fileWorkspaceCommentsQueryOptions(
	boxId: Id<"fileBoxes">,
	nodeId: Id<"fileNodes">
) {
	return convexQuery(api.fileWorkspace.comments.listComments, {
		boxId,
		nodeId,
	});
}

export function fileWorkspaceTagsQueryOptions(boxId: Id<"fileBoxes">) {
	return convexQuery(api.fileWorkspace.tags.listTags, { boxId });
}

export function fileWorkspaceVersionsQueryOptions(
	boxId: Id<"fileBoxes">,
	nodeId: Id<"fileNodes">
) {
	return convexQuery(api.fileWorkspace.versions.listVersions, {
		boxId,
		nodeId,
	});
}
