// biome-ignore lint/performance/noBarrelFile: Preserve the existing signing gate import surface.
export { canStartSigningForDealStatus } from "../../deals/portalContracts";

export const EMBEDDED_SIGNING_LOCKED_BY_DEAL_STATUS_MESSAGE =
	"Embedded signing is locked until lawyer representation is confirmed.";

export function isDealStatusOpenForEmbeddedSigning(
	dealStatus: string | null | undefined
) {
	return (
		dealStatus === "documentReview.pending" ||
		dealStatus === "documentReview.signed"
	);
}
