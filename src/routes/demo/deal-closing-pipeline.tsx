import { createFileRoute } from "@tanstack/react-router";
import {
	DealClosingPipelineDemo,
	DealClosingTemplateEvidence,
} from "#/components/demo/deal-closing/DealClosingPipelineDemo";
import { dealClosingPipelineFixture } from "#/components/demo/deal-closing/fixtures";

export const Route = createFileRoute("/demo/deal-closing-pipeline")({
	ssr: false,
	component: DealClosingPipelineRoute,
});

function DealClosingPipelineRoute() {
	return (
		<>
			<DealClosingPipelineDemo data={dealClosingPipelineFixture} />
			<div className="pointer-events-none mx-auto mt-8 max-w-[1312px] px-4 pb-10 sm:px-8 lg:px-16">
				<DealClosingTemplateEvidence data={dealClosingPipelineFixture} />
			</div>
		</>
	);
}
