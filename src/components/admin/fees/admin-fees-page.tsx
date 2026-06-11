import { BadgeDollarSign, RotateCw } from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { BulkApplyFeeSetPanel } from "./bulk-apply-fee-set-panel";
import { FeeDefinitionForm } from "./fee-definition-form";
import { FeeSetForm } from "./fee-set-form";
import { FeeValue } from "./fee-value";
import { MortgageFeeApplicationPanel } from "./mortgage-fee-application-panel";

interface FeeTemplateRow {
	readonly _id: string;
	readonly behavior: string;
	readonly displayCode: string;
	readonly name: string;
	readonly status: string;
	readonly valueLabel: string;
}

interface FeeSetRow {
	readonly _id: string;
	readonly isPlatformDefault: boolean;
	readonly itemCount: number;
	readonly name: string;
	readonly status: string;
}

interface FeeSnapshot {
	readonly feeSets: readonly FeeSetRow[];
	readonly feeTemplates: readonly FeeTemplateRow[];
	readonly mortgageFeeCounts: {
		readonly active: number;
		readonly optOuts: number;
		readonly overrides: number;
		readonly total: number;
	};
	readonly revenue: {
		readonly openAccountsReceivableCents: number;
		readonly totalIncomeCents: number;
	};
}

interface AdminFeesPageProps {
	readonly onRefresh?: () => Promise<unknown>;
	readonly snapshot: FeeSnapshot;
}

function formatMoney(cents: number) {
	return new Intl.NumberFormat("en-CA", {
		currency: "CAD",
		style: "currency",
	}).format(cents / 100);
}

function compactBehavior(value: string) {
	return value.replaceAll("_", " ");
}

export function AdminFeesPage({ onRefresh, snapshot }: AdminFeesPageProps) {
	return (
		<div className="space-y-8 p-4 md:p-6">
			<header className="flex flex-col gap-4 border-border/70 border-b pb-5 md:flex-row md:items-end md:justify-between">
				<div className="space-y-2">
					<div className="flex items-center gap-2 text-muted-foreground text-sm">
						<BadgeDollarSign className="size-4" />
						<span>Admin fee management</span>
					</div>
					<h1 className="font-semibold text-2xl tracking-normal">
						Fee Configuration
					</h1>
				</div>
				<Button
					onClick={() => void onRefresh?.()}
					type="button"
					variant="outline"
				>
					<RotateCw className="size-4" />
					Refresh
				</Button>
			</header>

			<section className="grid gap-3 md:grid-cols-4">
				<Metric
					label="Recognized income"
					value={formatMoney(snapshot.revenue.totalIncomeCents)}
				/>
				<Metric
					label="Open receivable"
					value={formatMoney(snapshot.revenue.openAccountsReceivableCents)}
				/>
				<Metric
					label="Active fees"
					value={String(snapshot.mortgageFeeCounts.active)}
				/>
				<Metric
					label="Opt-outs"
					value={String(snapshot.mortgageFeeCounts.optOuts)}
				/>
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="font-semibold text-lg">Fee Definitions</h2>
					<p className="text-muted-foreground text-sm">
						Canonical fee rules used by defaults, overrides, and borrower
						charges.
					</p>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Behavior</TableHead>
							<TableHead className="text-right">Value</TableHead>
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{snapshot.feeTemplates.map((template) => (
							<TableRow key={template._id}>
								<TableCell className="font-medium">{template.name}</TableCell>
								<TableCell className="capitalize">
									{compactBehavior(template.behavior)}
								</TableCell>
								<TableCell className="text-right">
									<FeeValue valueLabel={template.valueLabel} />
								</TableCell>
								<TableCell>
									<Badge
										variant={
											template.status === "active" ? "secondary" : "outline"
										}
									>
										{template.status}
									</Badge>
								</TableCell>
								<TableCell className="text-right">
									<Button size="sm" type="button" variant="ghost">
										Edit
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				<FeeDefinitionForm />
			</section>

			<section className="space-y-4">
				<div>
					<h2 className="font-semibold text-lg">Fee Sets</h2>
					<p className="text-muted-foreground text-sm">
						Bundles applied at activation or in controlled bulk updates.
					</p>
				</div>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Name</TableHead>
							<TableHead>Items</TableHead>
							<TableHead>Default</TableHead>
							<TableHead>Status</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{snapshot.feeSets.map((set) => (
							<TableRow key={set._id}>
								<TableCell className="font-medium">{set.name}</TableCell>
								<TableCell>{set.itemCount}</TableCell>
								<TableCell>
									{set.isPlatformDefault ? "Platform" : "No"}
								</TableCell>
								<TableCell>
									<Badge
										variant={set.status === "active" ? "secondary" : "outline"}
									>
										{set.status}
									</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				<FeeSetForm />
			</section>

			<div className="grid gap-8 lg:grid-cols-2">
				<MortgageFeeApplicationPanel />
				<BulkApplyFeeSetPanel />
			</div>
		</div>
	);
}

function Metric({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="rounded-md border border-border/70 bg-muted/20 p-4">
			<div className="text-muted-foreground text-sm">{label}</div>
			<div className="mt-1 font-semibold text-xl tabular-nums">{value}</div>
		</div>
	);
}
