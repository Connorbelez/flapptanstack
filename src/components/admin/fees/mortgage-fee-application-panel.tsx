import { Search } from "lucide-react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { UnavailableActionButton } from "./unavailable-action-button";

export function MortgageFeeApplicationPanel() {
	return (
		<section className="space-y-3">
			<div>
				<h2 className="font-semibold text-lg">Mortgage Application</h2>
				<p className="text-muted-foreground text-sm">
					Apply overrides, inspect inherited defaults, and trace assessments.
				</p>
			</div>
			<div className="grid gap-3 md:grid-cols-[1fr_auto]">
				<div className="space-y-1.5">
					<Label htmlFor="mortgage-fee-id">Mortgage</Label>
					<Input id="mortgage-fee-id" placeholder="Mortgage ID" />
				</div>
				<UnavailableActionButton
					action="Inspect"
					className="self-end"
					reason="mortgage fee inspection is not supported yet"
					variant="outline"
				>
					<Search className="size-4" />
					Inspect
				</UnavailableActionButton>
			</div>
		</section>
	);
}
