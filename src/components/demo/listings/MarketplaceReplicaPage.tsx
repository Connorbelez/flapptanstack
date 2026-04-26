import {
	Bookmark,
	ChevronDown,
	List,
	MapIcon,
	Search,
	SlidersHorizontal,
} from "lucide-react";
import { useMemo } from "react";
import { Input } from "#/components/ui/input";
import { Separator } from "#/components/ui/separator";
import { MarketplaceReplicaCard } from "./MarketplaceReplicaCard";
import { MarketplaceReplicaMap } from "./MarketplaceReplicaMap";
import { getMarketplaceReplicaItems } from "./marketplace-replica-data";

export function MarketplaceReplicaPage() {
	const listings = useMemo(() => getMarketplaceReplicaItems(), []);

	return (
		<div className="min-h-screen bg-[#F3F3F3] p-6 text-[#101828]">
			<div className="overflow-hidden rounded-[22px] border border-[#DDDEDF] bg-[#F8F8F8] shadow-sm">
				<header className="flex items-center justify-between border-[#E2E4E8] border-b px-8 py-5">
					<div className="flex items-center gap-7">
						<p className="font-semibold text-4xl">FairLend</p>
						<Separator className="h-8" orientation="vertical" />
						<p className="font-medium text-4xl">Marketplace</p>
					</div>
					<div className="mx-8 flex flex-1 items-center gap-4">
						<div className="relative flex-1">
							<Search className="absolute top-1/2 left-4 size-6 -translate-y-1/2 text-[#667085]" />
							<Input
								className="h-14 rounded-xl border-[#D0D5DD] bg-[#FCFCFD] pl-12 text-lg"
								placeholder="Search by city, mortgage type, borrower profile, or deal ID"
							/>
						</div>
						<button
							className="flex h-14 items-center gap-2 rounded-xl border border-[#D0D5DD] bg-white px-5 font-medium text-lg"
							type="button"
						>
							<SlidersHorizontal className="size-5" /> Filters
						</button>
					</div>
					<div className="flex items-center gap-6 text-lg">
						<div className="flex items-center gap-2">
							<Bookmark className="size-5" />
							Saved filters
							<span className="rounded-full bg-[#EAECF0] px-2 py-1 text-sm">
								2
							</span>
						</div>
						<div className="flex size-12 items-center justify-center rounded-full bg-[#EAECF0] font-semibold">
							AM
						</div>
						<ChevronDown className="size-5" />
					</div>
				</header>

				<div className="grid grid-cols-[64%_36%] gap-4 p-4">
					<section>
						<div className="mb-3 flex items-center justify-between px-2">
							<div className="flex items-center gap-4 text-3xl">
								<p className="font-semibold">{listings.length} opportunities</p>
								<p className="text-[#667085] text-xl">• updated just now</p>
							</div>
							<div className="flex items-center gap-3 text-xl">
								<p>Sort by</p>
								<button
									className="flex h-11 items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4"
									type="button"
								>
									Funding progress <ChevronDown className="size-4" />
								</button>
								<div className="flex overflow-hidden rounded-lg border border-[#D0D5DD]">
									<button
										className="flex h-11 items-center gap-2 bg-white px-4"
										type="button"
									>
										<List className="size-4" /> List
									</button>
									<button
										className="flex h-11 items-center gap-2 bg-[#F5F7FA] px-4"
										type="button"
									>
										<MapIcon className="size-4" /> Map
									</button>
								</div>
							</div>
						</div>
						<div className="space-y-4">
							{listings.map((listing) => (
								<MarketplaceReplicaCard item={listing} key={listing.id} />
							))}
						</div>
					</section>

					<section className="h-[calc(100vh-11rem)] min-h-[780px] overflow-hidden rounded-2xl border border-[#DFE2E6] bg-white">
						<div className="flex h-full flex-col">
							<div className="z-10 flex items-center justify-between border-[#E5E7EB] border-b px-4 py-3">
								<button
									className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-4 py-2 text-lg"
									type="button"
								>
									Greater Toronto Area <ChevronDown className="size-4" />
								</button>
							</div>
							<div className="min-h-0 flex-1">
								<MarketplaceReplicaMap items={listings} />
							</div>
							<div className="absolute right-8 bottom-8 z-10 rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-lg shadow-sm">
								Active opportunities
							</div>
						</div>
					</section>
				</div>
			</div>
		</div>
	);
}
