import { DealPortalShell } from "./DealPortalShell";
import type { DealPortalWorkspace } from "./types";

export function DealPortalPage({
	workspace,
}: {
	readonly workspace: DealPortalWorkspace;
}) {
	return <DealPortalShell workspace={workspace} />;
}
