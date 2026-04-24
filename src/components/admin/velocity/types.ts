import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../../convex/_generated/api";

export type VelocityBoardRows = FunctionReturnType<
	typeof api.velocity.workspaces.listVelocityPackageWorkspaces
>;
export type VelocityBoardRow = VelocityBoardRows[number];

export type VelocityWorkspaceDetail = NonNullable<
	FunctionReturnType<typeof api.velocity.workspaces.getVelocityPackageWorkspace>
>;

export type VelocityReadiness = VelocityWorkspaceDetail["readiness"];
export type VelocityDocumentLink = VelocityWorkspaceDetail["documents"][number];
export type VelocityException = VelocityWorkspaceDetail["exceptions"][number];
export type VelocitySnapshot = VelocityWorkspaceDetail["snapshots"][number];
