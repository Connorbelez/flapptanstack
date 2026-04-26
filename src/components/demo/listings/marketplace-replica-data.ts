import { demoListings } from "#/data/demo-listings-data";

export interface MarketplaceReplicaItem {
	city: string;
	fundedPercent: number;
	id: string;
	imageSrc: string;
	lat: number;
	lng: number;
	loanAmount: number;
	ltv: number;
	minimumInvestment: number;
	mortgageLabel: string;
	originationDate: string;
	position: string;
	propertyTypeLabel: string;
	province: string;
	targetYield: number;
	termLabel: string;
	title: string;
}

const FALLBACK_ITEMS: MarketplaceReplicaItem[] = [
	{
		id: "replica-toronto",
		title: "1st Mortgage — Toronto, ON",
		city: "Toronto",
		province: "ON",
		mortgageLabel: "Residential",
		propertyTypeLabel: "Detached",
		termLabel: "12-month term",
		targetYield: 10.75,
		ltv: 68,
		loanAmount: 740_000,
		position: "1st",
		fundedPercent: 82,
		originationDate: "Jan 15, 2025",
		minimumInvestment: 5000,
		imageSrc:
			"https://images.unsplash.com/photo-1600585154363-67eb9e2e2099?auto=format&fit=crop&w=1200&q=80",
		lat: 43.6532,
		lng: -79.3832,
	},
	{
		id: "replica-mississauga",
		title: "1st Mortgage — Mississauga, ON",
		city: "Mississauga",
		province: "ON",
		mortgageLabel: "Residential",
		propertyTypeLabel: "Detached",
		termLabel: "9-month term",
		targetYield: 10.5,
		ltv: 65,
		loanAmount: 620_000,
		position: "1st",
		fundedPercent: 76,
		originationDate: "Jan 10, 2025",
		minimumInvestment: 5000,
		imageSrc:
			"https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80",
		lat: 43.589,
		lng: -79.6441,
	},
	{
		id: "replica-vaughan",
		title: "1st Mortgage — Vaughan, ON",
		city: "Vaughan",
		province: "ON",
		mortgageLabel: "Residential",
		propertyTypeLabel: "Detached",
		termLabel: "12-month term",
		targetYield: 11.25,
		ltv: 70,
		loanAmount: 850_000,
		position: "1st",
		fundedPercent: 64,
		originationDate: "Jan 20, 2025",
		minimumInvestment: 5000,
		imageSrc:
			"https://images.unsplash.com/photo-1605146769289-440113cc3d00?auto=format&fit=crop&w=1200&q=80",
		lat: 43.8361,
		lng: -79.4983,
	},
];

function formatDate(date: Date): string {
	return date.toLocaleDateString("en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function getMarketplaceReplicaItems(): MarketplaceReplicaItem[] {
	if (demoListings.length < 3) {
		return FALLBACK_ITEMS;
	}

	return demoListings.slice(0, 3).map((listing, index) => {
		const fundedPercent = Math.max(
			48,
			Math.min(87, 100 - (listing.availablePercent ?? 0))
		);
		const termMonths = [12, 9, 12][index] ?? 12;
		const city = listing.address.split(",")[1]?.trim() ?? "Toronto";

		return {
			id: listing.id,
			title: `1st Mortgage — ${city}, ON`,
			city,
			province: "ON",
			mortgageLabel: "Residential",
			propertyTypeLabel: "Detached",
			termLabel: `${termMonths}-month term`,
			targetYield: Number((listing.apr + 1.25).toFixed(2)),
			ltv: listing.ltv,
			loanAmount: Math.round(listing.principal / 1000) * 1000,
			position: "1st",
			fundedPercent,
			originationDate: formatDate(listing.maturityDate),
			minimumInvestment: 5000,
			imageSrc: listing.imageSrc,
			lat: listing.lat,
			lng: listing.lng,
		};
	});
}
