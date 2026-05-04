import { CalendarIcon } from "lucide-react";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { cn } from "#/lib/utils";
import { formatPaymentScheduleDate, fromUtcDate, toUtcDate } from "./types";

interface DatePickerButtonProps {
	buttonAriaLabel?: string;
	className?: string;
	disabled?: boolean;
	label: string;
	maxDate: number;
	minDate: number;
	onChange: (value: number) => void;
	value: number;
}

export function DatePickerButton({
	buttonAriaLabel,
	className,
	disabled,
	label,
	maxDate,
	minDate,
	onChange,
	value,
}: DatePickerButtonProps) {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					aria-label={buttonAriaLabel}
					className={cn("justify-start gap-2", className)}
					disabled={disabled}
					type="button"
					variant="outline"
				>
					<CalendarIcon className="size-4" />
					<span className="truncate">{formatPaymentScheduleDate(value)}</span>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto p-0">
				<Calendar
					aria-label={label}
					disabled={(date) => {
						const timestamp = fromUtcDate(date);
						return timestamp < minDate || timestamp > maxDate;
					}}
					mode="single"
					onSelect={(date) => {
						if (date) {
							onChange(fromUtcDate(date));
						}
					}}
					selected={toUtcDate(value)}
				/>
			</PopoverContent>
		</Popover>
	);
}
