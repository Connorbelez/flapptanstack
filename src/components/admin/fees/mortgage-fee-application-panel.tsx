import { Search } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";

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
				<Button className="self-end" type="button" variant="outline">
					<Search className="size-4" />
					Inspect
				</Button>
			</div>
		</section>
	);
}
