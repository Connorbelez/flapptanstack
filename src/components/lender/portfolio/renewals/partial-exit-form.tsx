import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { formatPortfolioFractions } from "../portfolio-formatters";
import type { RenewalSurfaceVariant } from "./renewal-status";

interface PartialExitFormProps {
	currentHeldFractions: number;
	isDisabled?: boolean;
	isSubmitting: boolean;
	minimumFractions: number;
	mortgageId: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	validationError?: string;
	value: string;
	variant: RenewalSurfaceVariant;
}

export function PartialExitForm({
	currentHeldFractions,
	isDisabled,
	isSubmitting,
	minimumFractions,
	mortgageId,
	onChange,
	onSubmit,
	validationError,
	value,
	variant,
}: PartialExitFormProps) {
	return (
		<div
			className={
				variant === "compact"
					? "space-y-3 border-border/70 border-y py-3"
					: "space-y-3 border-border/70 border-y py-4"
			}
			data-testid={`renewal-partial-exit-form-${mortgageId}`}
		>
			<div className="space-y-1">
				<Label htmlFor={`renewal-partial-exit-input-${mortgageId}`}>
					Partial exit amount
				</Label>
				<p className="text-muted-foreground text-sm">
					Enter the number of fractions to exit. The runtime currently allows
					between {formatPortfolioFractions(minimumFractions)} and{" "}
					{formatPortfolioFractions(currentHeldFractions)}.
				</p>
			</div>
			<div className="flex flex-col gap-3 sm:flex-row">
				<Input
					id={`renewal-partial-exit-input-${mortgageId}`}
					inputMode="numeric"
					min={minimumFractions}
					onChange={(event) => onChange(event.target.value)}
					placeholder={String(minimumFractions)}
					step={1}
					type="number"
					value={value}
				/>
				<Button
					data-testid={`renewal-submit-partial-exit-${mortgageId}`}
					disabled={isDisabled ?? isSubmitting}
					onClick={() => void onSubmit()}
					type="button"
				>
					{isSubmitting ? "Saving..." : "Confirm partial exit"}
				</Button>
			</div>
			{validationError ? (
				<p
					className="text-destructive text-sm"
					data-testid={`renewal-partial-exit-error-${mortgageId}`}
				>
					{validationError}
				</p>
			) : null}
		</div>
	);
}
