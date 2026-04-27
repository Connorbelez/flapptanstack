import { Alert, AlertDescription } from "#/components/ui/alert";
import type { MicPortfolioDataCompleteness } from "../../../convex/micPortfolio/contracts";

interface MicDataWarningsProps {
	dataCompleteness: MicPortfolioDataCompleteness;
	warnings: string[];
}

export function MicDataWarnings({
	dataCompleteness,
	warnings,
}: MicDataWarningsProps) {
	const hasWarnings = warnings.length > 0;
	const isPartial = dataCompleteness === "partial";

	if (!(isPartial || hasWarnings)) {
		return null;
	}

	return (
		<Alert
			className={
				isPartial
					? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
					: undefined
			}
		>
			<AlertDescription>
				{isPartial && (
					<p className="font-medium">Portfolio data is partially complete.</p>
				)}
				{hasWarnings && (
					<ul className="mt-1 list-inside list-disc">
						{warnings.map((warning) => (
							<li key={warning}>{warning}</li>
						))}
					</ul>
				)}
			</AlertDescription>
		</Alert>
	);
}
