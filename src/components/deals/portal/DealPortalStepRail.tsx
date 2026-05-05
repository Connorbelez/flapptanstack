import {
	AlertTriangle,
	CheckCircle2,
	Circle,
	FileSignature,
	Scale,
	WalletCards,
} from "lucide-react";
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
		description: "Required parties sign closing documents.",
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

const stepIcon = {
	complete: CheckCircle2,
	documents: FileSignature,
	failed: Circle,
	payment: WalletCards,
	representation: Scale,
	unavailable: AlertTriangle,
} satisfies Record<DealPortalScreen, typeof Circle>;

export function DealPortalStepRail({
	activeScreen,
	dealStatus,
}: {
	readonly activeScreen: DealPortalScreen;
	readonly dealStatus: string;
}) {
	const activeIndex = steps.findIndex((s) => s.screen === activeScreen);

	return (
		<div>
			<div className="mb-1 flex items-center justify-between">
				<p className="island-kicker">Closing Flow</p>
				<p className="text-xs" style={{ color: "var(--sea-ink-soft)" }}>
					{formatEnumLabel(dealStatus)}
				</p>
			</div>

			<ol className="relative flex items-start justify-between">
				<div
					aria-hidden="true"
					className="absolute top-5 right-0 left-0 h-px"
					style={{ background: "var(--line)" }}
				/>

				<div
					aria-hidden="true"
					className="absolute top-5 left-0 h-px transition-all"
					style={{
						background: "var(--lagoon)",
						width: `${Math.max(0, (activeIndex / (steps.length - 1)) * 100)}%`,
					}}
				/>

				{steps.map((step, index) => {
					const isActive = activeScreen === step.screen;
					const isCompleted = index < activeIndex;
					const Icon = stepIcon[step.screen];
					return (
						<li
							aria-current={isActive ? "step" : undefined}
							className="relative z-10 flex flex-col items-center gap-2"
							key={step.screen}
						>
							<div
								className="flex size-10 items-center justify-center rounded-full transition-all"
								style={{
									background: isCompleted
										? "var(--palm)"
										: isActive
											? "white"
											: "var(--bg-base)",
									border: isActive
										? "2px solid var(--lagoon)"
										: isCompleted
											? "none"
											: "1px solid var(--line)",
									color: isCompleted
										? "white"
										: isActive
											? "var(--lagoon)"
											: "var(--sea-ink-soft)",
									boxShadow: isActive
										? "0 0 0 4px color-mix(in oklab, var(--lagoon) 15%, transparent)"
										: "none",
								}}
							>
								<Icon className="size-4" />
							</div>
							<div className="text-center">
								<p
									className="font-medium text-xs"
									style={{
										color: isActive
											? "var(--sea-ink)"
											: isCompleted
												? "var(--sea-ink-soft)"
												: "color-mix(in oklab, var(--sea-ink-soft) 55%, transparent)",
									}}
								>
									{step.label}
								</p>
								<p
									className="hidden max-w-[6rem] text-[0.65rem] leading-snug sm:block"
									style={{
										color: isActive
											? "var(--sea-ink-soft)"
											: "color-mix(in oklab, var(--sea-ink-soft) 50%, transparent)",
									}}
								>
									{step.description}
								</p>
							</div>
						</li>
					);
				})}
			</ol>
		</div>
	);
}
