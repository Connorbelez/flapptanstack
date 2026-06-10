import { Filter, Search, X } from "lucide-react";
import type { ChangeEvent } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import FilterModal from "./filter-modal";
import {
	DEFAULT_FILTERS,
	FILTER_BOUNDS,
	type FilterMetricItem,
	type FilterState,
} from "./types/listing-filters";

interface MarketplaceFilterBarProps {
	filters: FilterState;
	items?: readonly FilterMetricItem[];
	onFiltersChange: (filters: FilterState) => void;
}

export function MarketplaceFilterBar({
	filters,
	items = [],
	onFiltersChange,
}: MarketplaceFilterBarProps) {
	const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
		onFiltersChange({
			...filters,
			searchQuery: event.target.value,
		});
	};

	const handleClearFilters = () => {
		onFiltersChange(DEFAULT_FILTERS);
	};

	const hasActiveFilters =
		filters.ltvRange[0] > FILTER_BOUNDS.ltvRange[0] ||
		filters.ltvRange[1] < FILTER_BOUNDS.ltvRange[1] ||
		filters.interestRateRange[0] > FILTER_BOUNDS.interestRateRange[0] ||
		filters.interestRateRange[1] < FILTER_BOUNDS.interestRateRange[1] ||
		filters.principalRange[0] > FILTER_BOUNDS.principalRange[0] ||
		filters.principalRange[1] < FILTER_BOUNDS.principalRange[1] ||
		filters.mortgageTypes.length > 0 ||
		filters.propertyTypes.length > 0 ||
		filters.maturityDate !== undefined ||
		filters.searchQuery.length > 0;

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
					onFiltersChange={onFiltersChange}
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
		</div>
	);
}
