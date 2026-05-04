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
		label: "Legal Representation",
		screen: "representation",
	},
	{
		description: "Required parties sign closing documents.",
		label: "Document Signing",
		screen: "documents",
	},
	{
		description: "Funds are confirmed on the ledger.",
		label: "Payment Confirmation",
		screen: "payment",
	},
	{
		description: "Shares and audit record are finalized.",
		label: "Deal Complete",
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
	return (
		<aside className="h-fit rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
			<div className="mb-4">
				<p className="font-medium text-slate-500 text-xs uppercase tracking-[0.14em]">
					Closing Flow
				</p>
				<p className="mt-1 text-slate-700 text-sm">
					{formatEnumLabel(dealStatus)}
				</p>
			</div>
			<ol className="space-y-2">
				{steps.map((step) => {
					const active = activeScreen === step.screen;
					const Icon = stepIcon[step.screen];
					return (
						<li
							aria-current={active ? "step" : undefined}
							className={
								active
									? "rounded-md border border-slate-900 bg-slate-950 p-3 text-white"
									: "rounded-md border border-slate-200 p-3 text-slate-700"
							}
							key={step.screen}
						>
							<div className="flex items-start gap-3">
								<Icon
									className={
										active
											? "mt-0.5 size-4 text-white"
											: "mt-0.5 size-4 text-slate-500"
									}
								/>
								<div>
									<p className="font-medium text-sm">{step.label}</p>
									<p
										className={
											active
												? "mt-1 text-slate-200 text-xs leading-5"
												: "mt-1 text-slate-500 text-xs leading-5"
										}
									>
										{step.description}
									</p>
								</div>
							</div>
						</li>
					);
				})}
			</ol>
		</aside>
	);
}
