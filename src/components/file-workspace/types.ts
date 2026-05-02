import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type FileWorkspaceBoxIndex = FunctionReturnType<
	typeof api.fileWorkspace.readModels.listBoxIndex
>;

export type FileWorkspaceBoxIndexItem = FileWorkspaceBoxIndex[number];

export type FileWorkspaceBoxDetail = FunctionReturnType<
	typeof api.fileWorkspace.boxes.getBox
>;

export type FileWorkspaceCapabilities = FunctionReturnType<
	typeof api.fileWorkspace.readModels.getCapabilityPreview
>;

export type FileWorkspaceNodeList = FunctionReturnType<
	typeof api.fileWorkspace.readModels.listNodes
>;

export type FileWorkspaceNodeListItem = FileWorkspaceNodeList["nodes"][number];

export type FileWorkspaceManagerSettings = FunctionReturnType<
	typeof api.fileWorkspace.readModels.getManagerSettings
>;

export type FileWorkspaceVersionList = FunctionReturnType<
	typeof api.fileWorkspace.versions.listVersions
>;

export type FileWorkspaceCommentList = FunctionReturnType<
	typeof api.fileWorkspace.comments.listComments
>;

export type FileWorkspaceTagList = FunctionReturnType<
	typeof api.fileWorkspace.tags.listTags
>;

export type FileWorkspacePublicLink = FunctionReturnType<
	typeof api.fileWorkspace.shareLinks.resolveBearerLink
>;

export type FileWorkspacePublicNodeList = FunctionReturnType<
	typeof api.fileWorkspace.readModels.listBearerNodes
>;

export type FileWorkspaceScanState = NonNullable<
	FileWorkspaceNodeListItem["currentVersion"]
>["scanState"];

export type FileWorkspaceRole = FileWorkspaceBoxIndexItem["role"];

export type FileWorkspaceVisibility = FileWorkspaceBoxIndexItem["visibility"];

export type FileWorkspaceBoxStatus = FileWorkspaceBoxIndexItem["status"];

export type FileWorkspaceViewMode = "list" | "table";

export type FileWorkspaceCapability =
	FileWorkspaceCapabilities["capabilities"][number];
