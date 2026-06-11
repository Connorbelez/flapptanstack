import { Check } from "lucide-react";
import { formatEnumLabel } from "./format";
import type { DealPortalScreen } from "./types";

const steps: ReadonlyArray<{
	readonly description: string;
	readonly label: string;
	readonly screen: DealPortalScreen;
}> = [
	{
		description: "Counsel confirms representation.",
		label: "Representation",
		screen: "representation",
	},
	{
		description: "Required documents are completed or skipped.",
		label: "Documents",
		screen: "documents",
	},
	{
		description: "Funds are confirmed on the ledger.",
		label: "Payment",
		screen: "payment",
	},
	{
		description: "Shares and audit record are finalized.",
		label: "Complete",
		screen: "complete",
	},
];

export function DealPortalStepRail({
	activeScreen,
	dealStatus,
}: {
	readonly activeScreen: DealPortalScreen;
	readonly dealStatus: string;
}) {
	const activeIndex = steps.findIndex((s) => s.screen === activeScreen);
	const activeStepNumber = activeIndex >= 0 ? activeIndex + 1 : 0;
	const progressPercent =
		activeStepNumber > 0 ? (activeStepNumber / steps.length) * 100 : 0;

	return (
		<nav aria-label="Closing flow steps">
			{/* Steps header + counter */}
			<div className="mb-3 flex items-center justify-between">
				<p
					className="font-semibold text-sm"
					style={{ color: "var(--sea-ink)" }}
				>
					Steps
				</p>
				<p className="text-xs" style={{ color: "var(--sea-ink-soft)" }}>
					{activeStepNumber} of {steps.length}
				</p>
			</div>

			{/* Progress bar */}
			<div
				className="mb-5 h-2 w-full overflow-hidden rounded-full"
				style={{ background: "var(--line)" }}
			>
				<div
					className="h-full rounded-full transition-all duration-500"
					style={{
						background: "var(--lagoon)",
						width: `${Math.max(0, progressPercent)}%`,
					}}
				/>
			</div>

			{/* Status label */}
			<p className="mb-4 text-xs" style={{ color: "var(--sea-ink-soft)" }}>
				{formatEnumLabel(dealStatus)}
			</p>

			{/* Step cards */}
			<ol className="space-y-3">
				{steps.map((step, index) => {
					const isActive = activeScreen === step.screen;
					const isCompleted = index < activeIndex;
					const isFuture = index > activeIndex;
					const stepNumber = index + 1;

					return (
						<li aria-current={isActive ? "step" : undefined} key={step.screen}>
							<div
								className="flex items-start gap-4 rounded-xl p-4 transition-all"
								style={{
									background: isActive
										? "var(--surface-strong)"
										: "var(--surface)",
									border: isActive
										? "2px solid var(--lagoon)"
										: "1px solid var(--line)",
									boxShadow: isActive
										? "0 0 0 1px var(--lagoon), 0 8px 24px rgba(23,58,64,0.08)"
										: "none",
								}}
							>
								{/* Icon / Number circle */}
								<div
									className="flex size-10 shrink-0 items-center justify-center rounded-full transition-all"
									style={{
										background: isCompleted
											? "var(--palm)"
											: isActive
												? "transparent"
												: "color-mix(in oklab, var(--surface-strong) 70%, transparent)",
										border: isCompleted
											? "none"
											: isActive
												? "2px solid var(--lagoon)"
												: "1.5px solid color-mix(in oklab, var(--line) 70%, var(--lagoon) 30%)",
										color: isCompleted
											? "white"
											: isActive
												? "var(--lagoon)"
												: isFuture
													? "color-mix(in oklab, var(--sea-ink-soft) 72%, transparent)"
													: "var(--sea-ink-soft)",
									}}
								>
									{isCompleted ? (
										<Check className="size-5" strokeWidth={3} />
									) : (
										<span className="font-bold text-sm">{stepNumber}</span>
									)}
								</div>

								{/* Text content */}
								<div className="min-w-0 pt-0.5">
									<p
										className="font-semibold text-sm"
										style={{
											color: isFuture
												? "color-mix(in oklab, var(--sea-ink-soft) 78%, transparent)"
												: "var(--sea-ink)",
										}}
									>
										{step.label}
									</p>
									<p
										className="mt-0.5 text-xs leading-relaxed"
										style={{
											color: isFuture
												? "color-mix(in oklab, var(--sea-ink-soft) 62%, transparent)"
												: "var(--sea-ink-soft)",
										}}
									>
										{step.description}
									</p>
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
