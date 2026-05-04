import { cn } from "#/lib/utils";

interface FeeValueProps {
	readonly className?: string;
	readonly valueLabel: string;
}

export function FeeValue({ className, valueLabel }: FeeValueProps) {
	return (
		<span
			className={cn(
				"inline-flex min-w-[7rem] items-center justify-end rounded-md border border-border/70 bg-muted/35 px-2 py-1 font-medium text-foreground text-sm tabular-nums",
				className
			)}
		>
			{valueLabel}
		</span>
	);
}
