import { Filter, Search, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { cn } from "#/lib/utils";
import FilterModal from "./filter-modal";
import {
	DEFAULT_FILTERS,
	FILTER_BOUNDS,
	type FilterMetricItem,
	type FilterState,
} from "./types/listing-filters";

export type MarketplaceFilterChangeMode = "commit" | "debounced";

interface MarketplaceFilterBarProps {
	filters: FilterState;
	items?: readonly FilterMetricItem[];
	onFiltersChange: (
		filters: FilterState,
		options?: { mode?: MarketplaceFilterChangeMode }
	) => void;
}

export function MarketplaceFilterBar({
	filters,
	items = [],
	onFiltersChange,
}: MarketplaceFilterBarProps) {
	const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		onFiltersChange(
			{
				...filters,
				searchQuery: event.target.value,
			},
			{ mode: "debounced" }
		);
	};

	const handleClearFilters = () => {
		onFiltersChange(DEFAULT_FILTERS, { mode: "commit" });
	};

	const hasActiveFilters =
		filters.availablePercentRange[0] > FILTER_BOUNDS.availablePercentRange[0] ||
		filters.availablePercentRange[1] < FILTER_BOUNDS.availablePercentRange[1] ||
		filters.ltvRange[0] > FILTER_BOUNDS.ltvRange[0] ||
		filters.ltvRange[1] < FILTER_BOUNDS.ltvRange[1] ||
		filters.interestRateRange[0] > FILTER_BOUNDS.interestRateRange[0] ||
		filters.interestRateRange[1] < FILTER_BOUNDS.interestRateRange[1] ||
		filters.minimumInvestmentRange[0] >
			FILTER_BOUNDS.minimumInvestmentRange[0] ||
		filters.minimumInvestmentRange[1] <
			FILTER_BOUNDS.minimumInvestmentRange[1] ||
		filters.principalRange[0] > FILTER_BOUNDS.principalRange[0] ||
		filters.principalRange[1] < FILTER_BOUNDS.principalRange[1] ||
		filters.mortgageTypes.length > 0 ||
		filters.propertyTypes.length > 0 ||
		filters.maturityDate !== undefined ||
		filters.searchQuery.length > 0;

	const quickFilters = [
		{
			id: "first-mortgages",
			label: "1st mortgages",
			active: filters.mortgageTypes.includes("First"),
			nextFilters: () => ({
				...filters,
				mortgageTypes: filters.mortgageTypes.includes("First")
					? filters.mortgageTypes.filter((type) => type !== "First")
					: [...filters.mortgageTypes, "First" as const],
			}),
		},
		{
			id: "low-ltv",
			label: "LTV <= 65%",
			active: filters.ltvRange[1] <= 65,
			nextFilters: () => ({
				...filters,
				ltvRange:
					filters.ltvRange[1] <= 65
						? DEFAULT_FILTERS.ltvRange
						: ([FILTER_BOUNDS.ltvRange[0], 65] as [number, number]),
			}),
		},
		{
			id: "high-apr",
			label: "APR >= 9%",
			active: filters.interestRateRange[0] >= 9,
			nextFilters: () => ({
				...filters,
				interestRateRange:
					filters.interestRateRange[0] >= 9
						? DEFAULT_FILTERS.interestRateRange
						: ([9, FILTER_BOUNDS.interestRateRange[1]] as [number, number]),
			}),
		},
		{
			id: "available-half",
			label: "Available >= 50%",
			active: filters.availablePercentRange[0] >= 50,
			nextFilters: () => ({
				...filters,
				availablePercentRange:
					filters.availablePercentRange[0] >= 50
						? DEFAULT_FILTERS.availablePercentRange
						: ([50, FILTER_BOUNDS.availablePercentRange[1]] as [
								number,
								number,
							]),
			}),
		},
		{
			id: "available-full",
			label: "10/10 fractions available",
			active:
				filters.availablePercentRange[0] >= 100 &&
				filters.availablePercentRange[1] === 100,
			nextFilters: () => ({
				...filters,
				availablePercentRange:
					filters.availablePercentRange[0] >= 100 &&
					filters.availablePercentRange[1] === 100
						? DEFAULT_FILTERS.availablePercentRange
						: ([100, 100] as [number, number]),
			}),
		},
		{
			id: "minimum-investment",
			label: "Min <= $25K",
			active: filters.minimumInvestmentRange[1] <= 25_000,
			nextFilters: () => ({
				...filters,
				minimumInvestmentRange:
					filters.minimumInvestmentRange[1] <= 25_000
						? DEFAULT_FILTERS.minimumInvestmentRange
						: ([FILTER_BOUNDS.minimumInvestmentRange[0], 25_000] as [
								number,
								number,
							]),
			}),
		},
	] as const;

	return (
		<div className="z-10 flex flex-col justify-center gap-x-4">
			<div className="flex flex-nowrap items-center justify-start gap-2">
				<div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
					<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground md:text-foreground" />
					<Input
						className="h-10 rounded-[14px] border-transparent bg-[#EEF0F3] pl-10 shadow-none placeholder:text-muted-foreground md:rounded-full md:border-input md:bg-background md:shadow-md"
						onChange={handleSearchChange}
						placeholder="Search address, city, type"
						type="text"
						value={filters.searchQuery}
					/>
				</div>

				<FilterModal
					filters={filters}
					items={items}
					onFiltersChange={(nextFilters) =>
						onFiltersChange(nextFilters, { mode: "commit" })
					}
				/>

				{hasActiveFilters ? (
					<Button
						aria-label="Clear filters"
						className="h-10 rounded-[14px] px-2 md:rounded-md"
						onClick={handleClearFilters}
						size="sm"
						variant="destructive"
					>
						<X className="size-3.5" />
						<Filter className="size-3.5" />
					</Button>
				) : null}
			</div>
			<div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
				{quickFilters.map((quickFilter) => (
					<button
						aria-pressed={quickFilter.active}
						className={cn(
							"shrink-0 rounded-full border px-3 py-1.5 font-medium text-[12px] transition-colors",
							quickFilter.active
								? "border-[#0B1220] bg-[#0B1220] text-white"
								: "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
						)}
						key={quickFilter.id}
						onClick={() =>
							onFiltersChange(quickFilter.nextFilters(), {
								mode: "debounced",
							})
						}
						type="button"
					>
						{quickFilter.label}
					</button>
				))}
			</div>
		</div>
	);
}
