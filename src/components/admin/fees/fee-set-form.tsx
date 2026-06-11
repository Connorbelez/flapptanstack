import { Layers } from "lucide-react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Switch } from "#/components/ui/switch";
import { UnavailableActionButton } from "./unavailable-action-button";

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
			<UnavailableActionButton
				action="Save set"
				className="self-end"
				reason="fee-set persistence is not supported yet"
				variant="outline"
			>
				<Layers className="size-4" />
				Save set
			</UnavailableActionButton>
		</form>
	);
}
