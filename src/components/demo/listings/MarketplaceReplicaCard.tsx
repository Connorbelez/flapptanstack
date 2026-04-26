import {
	Building2,
	Calendar,
	ChevronRight,
	FileText,
	ShieldCheck,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Card } from "#/components/ui/card";
import { Progress } from "#/components/ui/progress";
import { cn } from "#/lib/utils";
import type { MarketplaceReplicaItem } from "./marketplace-replica-data";

interface MarketplaceReplicaCardProps {
	item: MarketplaceReplicaItem;
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-2 border-border/70 border-r px-7 py-4 last:border-r-0">
			<p className="font-medium text-[#4F4F52] text-[13px] leading-none">
				{label}
			</p>
			<p className="font-semibold text-[#101828] text-[45px] leading-none [font-size:clamp(1.75rem,2.2vw,3rem)]">
				{value}
			</p>
		</div>
	);
}

export function MarketplaceReplicaCard({ item }: MarketplaceReplicaCardProps) {
	return (
		<Card className="rounded-[20px] border-[#E6E7E7] bg-[#F8F8F8] p-4 shadow-sm">
			<div className="grid grid-cols-[350px_1fr] gap-6 xl:grid-cols-[47%_1fr]">
				<div className="relative h-full overflow-hidden rounded-[18px] border border-[#E2E4E8]">
					<img
						alt={item.title}
						className="h-full min-h-[280px] w-full object-cover"
						height={640}
						src={item.imageSrc}
						width={960}
					/>
					<div className="absolute top-4 left-4 rounded-xl bg-white/95 px-4 py-2 font-semibold text-[#101828] text-[18px] shadow-sm">
						FairLend
					</div>
				</div>

				<div className="flex min-w-0 flex-col gap-5 pr-2">
					<div className="flex items-start justify-between gap-4">
						<div>
							<h2 className="font-semibold text-[#101828] text-[clamp(2rem,3.2vw,3.75rem)] leading-none">
								{item.title}
							</h2>
							<p className="mt-3 text-[#535862] text-[clamp(1.1rem,1.45vw,2rem)]">
								{item.mortgageLabel}
								<span className="mx-3">•</span>
								{item.propertyTypeLabel}
								<span className="mx-3">•</span>
								{item.termLabel}
							</p>
						</div>
						<Badge className="rounded-2xl border border-[#CDE7D8] bg-[#EAF6EE] px-4 py-2 font-medium text-[#0B6B3A] text-[18px] hover:bg-[#EAF6EE]">
							<span className="mr-2 inline-block size-3 rounded-full bg-[#0B6B3A]" />
							Available
						</Badge>
					</div>

					<div className="grid grid-cols-4 rounded-2xl border border-[#D2D4DA] bg-[#F7F7F8]">
						<Metric
							label="Target Yield"
							value={`${item.targetYield.toFixed(2)}%`}
						/>
						<Metric label="LTV" value={`${item.ltv}%`} />
						<Metric
							label="Loan Amount"
							value={formatCurrency(item.loanAmount)}
						/>
						<Metric label="Position" value={item.position} />
					</div>

					<div>
						<div className="mb-2 flex items-end justify-between">
							<p className="font-medium text-[#3D3D42] text-[clamp(1.25rem,1.5vw,2rem)]">
								Funding Progress
							</p>
							<p className="font-medium text-[#0B6B3A] text-[clamp(1.2rem,1.4vw,1.9rem)]">
								{item.fundedPercent}%
								<span className="ml-2 font-normal text-[#535862]">funded</span>
							</p>
						</div>
						<Progress className="h-3 bg-[#D1D1D6]" value={item.fundedPercent} />
					</div>

					<div className="flex items-center justify-between border-[#DFE0E4] border-y py-4 text-[#535862] text-[clamp(1.15rem,1.35vw,1.7rem)]">
						<div className="flex items-center gap-3">
							<Calendar className="size-6" />
							<span>Origination Date: {item.originationDate}</span>
						</div>
						<span>
							Minimum investment: {formatCurrency(item.minimumInvestment)}
						</span>
					</div>

					<div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3">
						<div
							className={cn(
								"flex items-center gap-3 border-[#DFE0E4] border-r py-1"
							)}
						>
							<FileText className="size-8 text-[#0B6B3A]" />
							<span className="text-[#263238] text-lg">
								FSRA disclosure available
							</span>
						</div>
						<div
							className={cn(
								"flex items-center gap-3 border-[#DFE0E4] border-r py-1"
							)}
						>
							<ShieldCheck className="size-8 text-[#0B6B3A]" />
							<span className="text-[#263238] text-lg">Documents reviewed</span>
						</div>
						<div className="flex items-center gap-3 py-1">
							<Building2 className="size-8 text-[#0B6B3A]" />
							<span className="text-[#263238] text-lg">PAD collections</span>
						</div>
						<Button className="h-16 rounded-xl bg-[#006837] px-10 text-3xl hover:bg-[#035b31]">
							View Deal
							<ChevronRight className="ml-2 size-8" />
						</Button>
					</div>
				</div>
			</div>
		</Card>
	);
}
