import { AlertCircleIcon } from "lucide-react";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "#/components/ui/select";
import { Slider } from "#/components/ui/slider";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { DatePickerButton } from "./DatePickerButton";
import {
	formatPaymentScheduleMoney,
	replacementFrequencyLabels,
	replacementRailGroups,
	replacementRailLabels,
} from "./types";

type ReplacementFrequency = keyof typeof replacementFrequencyLabels;
type ReplacementRail = keyof typeof replacementRailLabels;

interface EligibleBankAccountOption {
	accountLast4?: string;
	bankAccountId: Id<"bankAccounts">;
	label: string;
}

interface ScheduleReplacementControlsProps {
	deadlineDate: number;
	draft: {
		bankAccountId?: Id<"bankAccounts">;
		interestPaymentAmount: number;
		paymentFrequency: ReplacementFrequency;
		replacementRail: ReplacementRail;
		sliderBounds: {
			maxInterestPaymentAmount: number;
			minInterestPaymentAmount: number;
			step: number;
		};
		startDate: number;
		validationIssues: Array<{ code: string; message: string }>;
	};
	eligibleBankAccounts?: EligibleBankAccountOption[];
	minStartDate: number;
	onChange: (patch: {
		bankAccountId?: Id<"bankAccounts">;
		interestPaymentAmount?: number;
		paymentFrequency?: ReplacementFrequency;
		replacementRail?: ReplacementRail;
		startDate?: number;
	}) => void;
}

export function ScheduleReplacementControls({
	deadlineDate,
	draft,
	eligibleBankAccounts = [],
	minStartDate,
	onChange,
}: ScheduleReplacementControlsProps) {
	return (
		<div className="space-y-5">
			<div className="space-y-2">
				<Label>Payment rail</Label>
				<RadioGroup
					className="grid gap-3 md:grid-cols-2"
					onValueChange={(value) => {
						const replacementRail = value as ReplacementRail;
						const patch: {
							bankAccountId?: Id<"bankAccounts">;
							replacementRail: ReplacementRail;
						} = { replacementRail };
						const bankAccountId =
							replacementRail === "provider_managed_rotessa"
								? (draft.bankAccountId ??
									eligibleBankAccounts[0]?.bankAccountId)
								: draft.bankAccountId;
						if (bankAccountId) {
							patch.bankAccountId = bankAccountId;
						}
						onChange(patch);
					}}
					value={draft.replacementRail}
				>
					{replacementRailGroups.map((group) => (
						<div className="space-y-2" key={group.label}>
							<div className="font-medium text-muted-foreground text-xs uppercase tracking-normal">
								{group.label}
							</div>
							{group.options.map((option) => (
								<label
									className="flex min-h-11 items-center gap-3 rounded-md border px-3 py-2"
									htmlFor={`replacement-rail-${option}`}
									key={option}
								>
									<RadioGroupItem
										aria-label={replacementRailLabels[option]}
										id={`replacement-rail-${option}`}
										value={option}
									/>
									<span className="font-medium text-sm">
										{replacementRailLabels[option]}
									</span>
								</label>
							))}
						</div>
					))}
				</RadioGroup>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label>Start date</Label>
					<DatePickerButton
						className="w-full"
						label="Start date"
						maxDate={deadlineDate}
						minDate={minStartDate}
						onChange={(startDate) => onChange({ startDate })}
						value={draft.startDate}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="payment-frequency">Payment frequency</Label>
					<Select
						onValueChange={(paymentFrequency) =>
							onChange({
								paymentFrequency: paymentFrequency as ReplacementFrequency,
							})
						}
						value={draft.paymentFrequency}
					>
						<SelectTrigger
							aria-label="Payment frequency"
							className="w-full"
							id="payment-frequency"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{Object.entries(replacementFrequencyLabels).map(
								([value, label]) => (
									<SelectItem key={value} value={value}>
										{label}
									</SelectItem>
								)
							)}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between gap-3">
					<Label htmlFor="interest-payment-amount">
						Interest payment amount
					</Label>
					<div className="font-semibold text-sm">
						{formatPaymentScheduleMoney(draft.interestPaymentAmount)}
					</div>
				</div>
				<Slider
					aria-label="Interest payment amount"
					id="interest-payment-amount"
					max={draft.sliderBounds.maxInterestPaymentAmount}
					min={draft.sliderBounds.minInterestPaymentAmount}
					onValueChange={([interestPaymentAmount]) => {
						if (interestPaymentAmount !== undefined) {
							onChange({ interestPaymentAmount });
						}
					}}
					step={draft.sliderBounds.step}
					value={[draft.interestPaymentAmount]}
				/>
				<div className="flex justify-between text-muted-foreground text-xs">
					<span>
						{formatPaymentScheduleMoney(
							draft.sliderBounds.minInterestPaymentAmount
						)}
					</span>
					<span>
						{formatPaymentScheduleMoney(
							draft.sliderBounds.maxInterestPaymentAmount
						)}
					</span>
				</div>
			</div>

			{draft.replacementRail === "provider_managed_rotessa" ? (
				<div className="space-y-2">
					<Label htmlFor="rotessa-bank-account">Rotessa bank account</Label>
					<Select
						onValueChange={(bankAccountId) =>
							onChange({ bankAccountId: bankAccountId as Id<"bankAccounts"> })
						}
						value={draft.bankAccountId}
					>
						<SelectTrigger
							aria-label="Rotessa bank account"
							className="w-full"
							id="rotessa-bank-account"
						>
							<SelectValue placeholder="Select borrower bank account" />
						</SelectTrigger>
						<SelectContent>
							{eligibleBankAccounts.map((account) => (
								<SelectItem
									key={account.bankAccountId}
									value={account.bankAccountId}
								>
									{account.accountLast4
										? `${account.label} ending ${account.accountLast4}`
										: account.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			) : null}

			{draft.validationIssues.length > 0 ? (
				<div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
					<div className="flex items-start gap-2">
						<AlertCircleIcon className="mt-0.5 size-4" />
						<div className="space-y-1">
							{draft.validationIssues.map((issue) => (
								<div key={`${issue.code}:${issue.message}`}>
									{issue.message}
								</div>
							))}
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
