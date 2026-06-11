import { Plus } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";

export function FeeDefinitionForm() {
	return (
		<form className="grid gap-3 border-border/70 border-t pt-4 md:grid-cols-[1.2fr_1fr_1fr_auto]">
			<div className="space-y-1.5">
				<Label htmlFor="fee-name">Definition</Label>
				<Input id="fee-name" placeholder="Document preparation" />
			</div>
			<div className="space-y-1.5">
				<Label>Behavior</Label>
				<Select defaultValue="borrower_one_time_charge">
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="borrower_one_time_charge">One-time</SelectItem>
						<SelectItem value="borrower_recurring_charge">Recurring</SelectItem>
						<SelectItem value="payment_waterfall_deduction">
							Waterfall
						</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="space-y-1.5">
				<Label htmlFor="fee-amount">Value</Label>
				<Input id="fee-amount" inputMode="decimal" placeholder="150.00" />
			</div>
			<Button className="self-end" type="button" variant="outline">
				<Plus className="size-4" />
				Add
			</Button>
		</form>
	);
}
