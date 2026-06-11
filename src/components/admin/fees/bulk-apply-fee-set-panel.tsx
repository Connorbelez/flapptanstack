import { Play } from "lucide-react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { UnavailableActionButton } from "./unavailable-action-button";

export function BulkApplyFeeSetPanel() {
	return (
		<section className="space-y-3">
			<div>
				<h2 className="font-semibold text-lg">Bulk Apply</h2>
				<p className="text-muted-foreground text-sm">
					Preview target mortgages, opt-outs, and active-fee conflicts.
				</p>
			</div>
			<div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
				<div className="space-y-1.5">
					<Label htmlFor="bulk-set-id">Fee set</Label>
					<Input id="bulk-set-id" placeholder="Fee set ID" />
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="bulk-effective-from">Effective from</Label>
					<Input id="bulk-effective-from" placeholder="2026-05-04" />
				</div>
				<UnavailableActionButton
					action="Preview"
					className="self-end"
					reason="bulk fee-set preview is not supported yet"
					variant="outline"
				>
					<Play className="size-4" />
					Preview
				</UnavailableActionButton>
			</div>
		</section>
	);
}
