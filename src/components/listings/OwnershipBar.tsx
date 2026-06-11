import { PieChart } from "lucide-react";

interface OwnershipBarProps {
	availablePercent: number;
	lockedPercent: number;
	showDetails?: boolean;
	soldPercent: number;
}

export function OwnershipBar({
	availablePercent = 100,
	lockedPercent = 0,
	showDetails = true,
	soldPercent = 0,
}: OwnershipBarProps) {
	const total = availablePercent + lockedPercent + soldPercent;
	const available = total > 0 ? (availablePercent / total) * 100 : 100;
	const locked = total > 0 ? (lockedPercent / total) * 100 : 0;
	const sold = total > 0 ? (soldPercent / total) * 100 : 0;

	const bar = (
		<div className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/10">
			{sold > 0 && (
				<div className="h-full bg-zinc-500" style={{ width: `${sold}%` }} />
			)}
			{locked > 0 && (
				<div className="h-full bg-amber-500" style={{ width: `${locked}%` }} />
			)}
			{available > 0 && (
				<div
					className="h-full bg-emerald-500"
					style={{ width: `${available}%` }}
				/>
			)}
		</div>
	);

	if (!showDetails) {
		return bar;
	}

	return (
		<div className="flex w-full min-w-0 flex-col gap-1">
			<div className="flex min-w-0 items-center text-muted-foreground text-sm">
				<PieChart className="mr-1 h-4 w-4 shrink-0" />
				<span className="min-w-0 truncate text-foreground/50">Available</span>
			</div>
			<div className="flex min-w-0 items-center gap-2">
				<span className="shrink-0 font-semibold text-emerald-500 text-sm tabular-nums">
					{Math.round(available)}%
				</span>
				{bar}
			</div>
			{lockedPercent > 0 ? (
				<p className="text-[10px] text-amber-500">
					{Math.round(locked)}% locked
				</p>
			) : null}
		</div>
	);
}
