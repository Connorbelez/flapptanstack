import { Layers } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";

export function FeeSetForm() {
	return (
		<form className="grid gap-3 border-border/70 border-t pt-4 md:grid-cols-[1.4fr_auto_auto]">
			<div className="space-y-1.5">
				<Label htmlFor="fee-set-name">Fee set</Label>
				<Input id="fee-set-name" placeholder="Standard mortgage fees" />
			</div>
			<div className="flex items-end gap-2 pb-2">
				<Switch id="fee-set-default" />
				<Label htmlFor="fee-set-default">Default</Label>
			</div>
			<Button className="self-end" type="button" variant="outline">
				<Layers className="size-4" />
				Save set
			</Button>
		</form>
	);
}
