import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../_generated/server";

export const MOCK_MORTGAGE_CATALOG_VERSION = "mock-mortgage-v1";

export interface MockMortgageComparableFixture {
	readonly address: string;
	readonly adjustedValueDollars: number;
	readonly lotSize?: string;
	readonly propertyType: string;
	readonly saleDate: string;
	readonly salePriceDollars: number;
	readonly squareFootage?: number;
	readonly yearBuilt?: number;
}

export interface MockMortgageCatalogItem {
	readonly address: {
		city: string;
		latitude: number;
		longitude: number;
		postalCode: string;
		province: string;
		streetAddress: string;
		unit?: string;
	};
	readonly amortizationMonths: number;
	readonly appraisalValueDollars: number;
	readonly borrowerName: string;
	readonly comparables: readonly MockMortgageComparableFixture[];
	readonly heroImageStorageId: Id<"_storage">;
	readonly interestRatePercent: number;
	readonly key: string;
	readonly lienPosition: 1 | 2;
	readonly neighborhoodLabel: string;
	readonly principalDollars: number;
	readonly propertyType: "condo" | "multi_unit" | "residential";
	readonly termMonths: number;
}

const MOCK_MORTGAGE_IMAGE_STORAGE_IDS = [
	"kg287qhzvj5dfzj58r6xh0tkhd859w15",
	"kg20er6058bm1ecwfsfyj7fw7d858pwx",
	"kg2d6ht2tb9fr4pqh6pv5dfndn858a4h",
	"kg2d6ht2tb9fr4pqh6pv5dfndn858a4h",
	"kg21wrr8kt5k6rg334zss6hwjx859vyq",
	"kg2akvg7mkvdhnk7c8tjsr8g1n858mma",
	"kg2css54zk1myxd0zej9aqbj4h859rn2",
	"kg2bnnhazn16xvg5b9efrd2jbx858dbf",
	"kg2d34ncppnh7txqsk291b3xnd858q26",
	"kg22z8yazfmgee4zp2g8qq68nn859kgd",
	"kg2352ehhcqfq45v8fe1fqd4c9859t55",
	"kg24nk9rywzp2txg7g1a96zxk9858pbt",
] as const satisfies readonly string[];

function toStorageId(value: (typeof MOCK_MORTGAGE_IMAGE_STORAGE_IDS)[number]) {
	return value as Id<"_storage">;
}

function comparable(
	address: string,
	salePriceDollars: number,
	adjustedValueDollars: number,
	saleDate: string,
	propertyType: string,
	squareFootage?: number,
	yearBuilt?: number,
	lotSize?: string
): MockMortgageComparableFixture {
	return {
		address,
		adjustedValueDollars,
		lotSize,
		propertyType,
		saleDate,
		salePriceDollars,
		squareFootage,
		yearBuilt,
	};
}

export const MOCK_MORTGAGE_CATALOG = [
	{
		key: "plato-leslieville-triplex",
		borrowerName: "Plato",
		neighborhoodLabel: "Leslieville Triplex",
		propertyType: "multi_unit",
		lienPosition: 1,
		interestRatePercent: 8.15,
		principalDollars: 465_000,
		appraisalValueDollars: 710_000,
		amortizationMonths: 360,
		termMonths: 12,
		address: {
			streetAddress: "45 Bertmount Ave",
			city: "Toronto",
			province: "ON",
			postalCode: "M4M 2X8",
			latitude: 43.6625,
			longitude: -79.3345,
		},
		comparables: [
			comparable(
				"129 Pape Ave, Toronto, ON M4M 2V8",
				742_000,
				721_000,
				"2025-12-14",
				"Triplex",
				2280,
				1910
			),
			comparable(
				"88 Curzon St, Toronto, ON M4M 3B4",
				718_000,
				709_000,
				"2025-11-03",
				"Duplex",
				2140,
				1922
			),
			comparable(
				"41 Boston Ave, Toronto, ON M4M 2T9",
				754_000,
				729_000,
				"2026-01-20",
				"Triplex",
				2365,
				1915
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[0]),
	},
	{
		key: "aristotle-niagara-condo",
		borrowerName: "Aristotle",
		neighborhoodLabel: "Niagara Condo",
		propertyType: "condo",
		lienPosition: 1,
		interestRatePercent: 7.4,
		principalDollars: 320_000,
		appraisalValueDollars: 540_000,
		amortizationMonths: 300,
		termMonths: 12,
		address: {
			streetAddress: "38 Niagara St",
			unit: "908",
			city: "Toronto",
			province: "ON",
			postalCode: "M5V 3X1",
			latitude: 43.6425,
			longitude: -79.3991,
		},
		comparables: [
			comparable(
				"15 Bruyeres Mews Unit 807, Toronto, ON M5V 0A7",
				552_000,
				543_000,
				"2026-01-09",
				"Condo",
				715,
				2015
			),
			comparable(
				"50 Ordnance St Unit 1203, Toronto, ON M6K 0C9",
				545_000,
				537_000,
				"2025-12-02",
				"Condo",
				702,
				2020
			),
			comparable(
				"560 Front St W Unit 411, Toronto, ON M5V 1C1",
				558_000,
				541_000,
				"2025-10-28",
				"Condo",
				748,
				2006
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[1]),
	},
	{
		key: "socrates-trinity-bellwoods-home",
		borrowerName: "Socrates",
		neighborhoodLabel: "Trinity-Bellwoods Home",
		propertyType: "residential",
		lienPosition: 1,
		interestRatePercent: 7.95,
		principalDollars: 390_000,
		appraisalValueDollars: 650_000,
		amortizationMonths: 300,
		termMonths: 12,
		address: {
			streetAddress: "112 Euclid Ave",
			city: "Toronto",
			province: "ON",
			postalCode: "M6J 2J7",
			latitude: 43.6478,
			longitude: -79.4101,
		},
		comparables: [
			comparable(
				"74 Crawford St, Toronto, ON M6J 2V4",
				668_000,
				654_000,
				"2025-12-19",
				"Semi-Detached",
				1520,
				1908
			),
			comparable(
				"39 Gore Vale Ave, Toronto, ON M6J 2R5",
				641_000,
				646_000,
				"2025-11-07",
				"Detached",
				1455,
				1898
			),
			comparable(
				"158 Grace St, Toronto, ON M6J 2S2",
				659_000,
				651_000,
				"2026-02-13",
				"Semi-Detached",
				1490,
				1912
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[2]),
	},
	{
		key: "hypatia-lakeshore-condo",
		borrowerName: "Hypatia",
		neighborhoodLabel: "Humber Bay Condo",
		propertyType: "condo",
		lienPosition: 1,
		interestRatePercent: 8.45,
		principalDollars: 295_000,
		appraisalValueDollars: 515_000,
		amortizationMonths: 300,
		termMonths: 12,
		address: {
			streetAddress: "1900 Lake Shore Blvd W",
			unit: "2503",
			city: "Toronto",
			province: "ON",
			postalCode: "M6S 1A4",
			latitude: 43.6351,
			longitude: -79.4658,
		},
		comparables: [
			comparable(
				"2200 Lake Shore Blvd W Unit 2907, Toronto, ON M8V 1A4",
				528_000,
				518_000,
				"2026-01-15",
				"Condo",
				690,
				2014
			),
			comparable(
				"80 Marine Parade Dr Unit 1609, Toronto, ON M8V 4G1",
				505_000,
				512_000,
				"2025-10-17",
				"Condo",
				676,
				2011
			),
			comparable(
				"2212 Lake Shore Blvd W Unit 1702, Toronto, ON M8V 1A4",
				521_000,
				516_000,
				"2025-12-11",
				"Condo",
				688,
				2015
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[3]),
	},
	{
		key: "simone-rosebank-home",
		borrowerName: "Simone de Beauvoir",
		neighborhoodLabel: "Rosebank Home",
		propertyType: "residential",
		lienPosition: 1,
		interestRatePercent: 7.25,
		principalDollars: 410_000,
		appraisalValueDollars: 690_000,
		amortizationMonths: 360,
		termMonths: 12,
		address: {
			streetAddress: "27 Rosebank Dr",
			city: "Toronto",
			province: "ON",
			postalCode: "M1B 5Y7",
			latitude: 43.7989,
			longitude: -79.1974,
		},
		comparables: [
			comparable(
				"53 Seasons Dr, Toronto, ON M1X 1X3",
				705_000,
				694_000,
				"2025-11-22",
				"Detached",
				1810,
				2001
			),
			comparable(
				"41 Pinery Trl, Toronto, ON M1B 6A3",
				682_000,
				688_000,
				"2026-02-06",
				"Detached",
				1760,
				1999
			),
			comparable(
				"15 Purpledusk Trl, Toronto, ON M1X 1B8",
				699_000,
				691_000,
				"2025-12-30",
				"Detached",
				1785,
				2003
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[4]),
	},
	{
		key: "confucius-holmes-condo",
		borrowerName: "Confucius",
		neighborhoodLabel: "North York Condo",
		propertyType: "condo",
		lienPosition: 1,
		interestRatePercent: 8.75,
		principalDollars: 340_000,
		appraisalValueDollars: 590_000,
		amortizationMonths: 300,
		termMonths: 12,
		address: {
			streetAddress: "18 Holmes Ave",
			unit: "2108",
			city: "Toronto",
			province: "ON",
			postalCode: "M2N 0H1",
			latitude: 43.7706,
			longitude: -79.4122,
		},
		comparables: [
			comparable(
				"23 Sheppard Ave E Unit 1206, Toronto, ON M2N 0C8",
				601_000,
				592_000,
				"2026-01-31",
				"Condo",
				742,
				2017
			),
			comparable(
				"35 Finch Ave E Unit 1608, Toronto, ON M2N 6Z8",
				585_000,
				589_000,
				"2025-11-14",
				"Condo",
				721,
				2015
			),
			comparable(
				"5168 Yonge St Unit 1707, Toronto, ON M2N 5P6",
				594_000,
				587_000,
				"2025-12-18",
				"Condo",
				730,
				2009
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[5]),
	},
	{
		key: "ibn-sina-port-royal-home",
		borrowerName: "Ibn Sina",
		neighborhoodLabel: "Port Royal Family Home",
		propertyType: "residential",
		lienPosition: 1,
		interestRatePercent: 7.6,
		principalDollars: 430_000,
		appraisalValueDollars: 760_000,
		amortizationMonths: 360,
		termMonths: 12,
		address: {
			streetAddress: "55 Port Royal Trl",
			city: "Toronto",
			province: "ON",
			postalCode: "M1V 2G5",
			latitude: 43.8178,
			longitude: -79.2871,
		},
		comparables: [
			comparable(
				"42 Havendale Rd, Toronto, ON M1S 1B2",
				772_000,
				758_000,
				"2026-02-10",
				"Detached",
				1960,
				1988
			),
			comparable(
				"19 Milliken Meadows Dr, Toronto, ON M1V 1S7",
				751_000,
				754_000,
				"2025-10-24",
				"Detached",
				1880,
				1986
			),
			comparable(
				"68 Highglen Ave, Markham, ON L3S 3K3",
				768_000,
				761_000,
				"2025-12-05",
				"Detached",
				1940,
				1990
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[6]),
	},
	{
		key: "laozi-lillian-condo",
		borrowerName: "Laozi",
		neighborhoodLabel: "Midtown Condo",
		propertyType: "condo",
		lienPosition: 1,
		interestRatePercent: 8.2,
		principalDollars: 360_000,
		appraisalValueDollars: 610_000,
		amortizationMonths: 300,
		termMonths: 12,
		address: {
			streetAddress: "66 Lillian St",
			unit: "1907",
			city: "Toronto",
			province: "ON",
			postalCode: "M4S 0A9",
			latitude: 43.7063,
			longitude: -79.3972,
		},
		comparables: [
			comparable(
				"89 Dunfield Ave Unit 1009, Toronto, ON M4S 0A4",
				624_000,
				613_000,
				"2025-12-12",
				"Condo",
				775,
				2018
			),
			comparable(
				"98 Redpath Ave Unit 1111, Toronto, ON M4S 0A5",
				606_000,
				609_000,
				"2026-01-18",
				"Condo",
				752,
				2015
			),
			comparable(
				"30 Roehampton Ave Unit 1407, Toronto, ON M4P 0B9",
				618_000,
				611_000,
				"2025-11-29",
				"Condo",
				760,
				2016
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[7]),
	},
	{
		key: "arendt-mississauga-second",
		borrowerName: "Hannah Arendt",
		neighborhoodLabel: "City Centre Condo",
		propertyType: "condo",
		lienPosition: 2,
		interestRatePercent: 10.75,
		principalDollars: 110_000,
		appraisalValueDollars: 615_000,
		amortizationMonths: 240,
		termMonths: 12,
		address: {
			streetAddress: "325 Webb Dr",
			unit: "1405",
			city: "Mississauga",
			province: "ON",
			postalCode: "L5B 3Z9",
			latitude: 43.5897,
			longitude: -79.6446,
		},
		comparables: [
			comparable(
				"388 Prince of Wales Dr Unit 1206, Mississauga, ON L5B 0A1",
				628_000,
				617_000,
				"2025-10-30",
				"Condo",
				840,
				2010
			),
			comparable(
				"3504 Hurontario St Unit 1903, Mississauga, ON L5B 0B9",
				612_000,
				614_000,
				"2026-01-07",
				"Condo",
				828,
				2014
			),
			comparable(
				"3939 Duke of York Blvd Unit 1806, Mississauga, ON L5B 4N2",
				620_000,
				616_000,
				"2025-12-21",
				"Condo",
				835,
				2005
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[8]),
	},
	{
		key: "mill-brampton-second",
		borrowerName: "John Stuart Mill",
		neighborhoodLabel: "Mount Pleasant Townhome",
		propertyType: "residential",
		lienPosition: 2,
		interestRatePercent: 11.4,
		principalDollars: 145_000,
		appraisalValueDollars: 840_000,
		amortizationMonths: 240,
		termMonths: 12,
		address: {
			streetAddress: "9800 McLaughlin Rd N",
			unit: "42",
			city: "Brampton",
			province: "ON",
			postalCode: "L6X 4R1",
			latitude: 43.7049,
			longitude: -79.8121,
		},
		comparables: [
			comparable(
				"10 Bannister Cres, Brampton, ON L7A 4M1",
				855_000,
				842_000,
				"2025-11-16",
				"Detached",
				2140,
				2011
			),
			comparable(
				"7 Fann Dr, Brampton, ON L7A 4E7",
				832_000,
				836_000,
				"2026-02-03",
				"Detached",
				2065,
				2009
			),
			comparable(
				"27 Clenston Rd, Brampton, ON L7A 3V4",
				848_000,
				841_000,
				"2025-12-08",
				"Detached",
				2105,
				2010
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[9]),
	},
	{
		key: "nietzsche-vaughan-second",
		borrowerName: "Nietzsche",
		neighborhoodLabel: "Maple Condo",
		propertyType: "condo",
		lienPosition: 2,
		interestRatePercent: 12.2,
		principalDollars: 125_000,
		appraisalValueDollars: 720_000,
		amortizationMonths: 240,
		termMonths: 12,
		address: {
			streetAddress: "9235 Jane St",
			unit: "1508",
			city: "Vaughan",
			province: "ON",
			postalCode: "L6A 0J7",
			latitude: 43.8518,
			longitude: -79.5057,
		},
		comparables: [
			comparable(
				"99 Eagle Rock Way Unit 906, Vaughan, ON L6A 5A7",
				731_000,
				719_000,
				"2026-01-11",
				"Condo",
				905,
				2021
			),
			comparable(
				"2900 Highway 7 Rd Unit 1702, Vaughan, ON L4K 0G3",
				708_000,
				714_000,
				"2025-11-05",
				"Condo",
				880,
				2018
			),
			comparable(
				"9075 Jane St Unit 709, Vaughan, ON L4K 0L7",
				725_000,
				718_000,
				"2025-12-17",
				"Condo",
				892,
				2020
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[10]),
	},
	{
		key: "descartes-richmond-hill-second",
		borrowerName: "Descartes",
		neighborhoodLabel: "Richmond Hill Condo",
		propertyType: "condo",
		lienPosition: 2,
		interestRatePercent: 10.95,
		principalDollars: 135_000,
		appraisalValueDollars: 700_000,
		amortizationMonths: 240,
		termMonths: 12,
		address: {
			streetAddress: "75 Norman Bethune Ave",
			unit: "202",
			city: "Richmond Hill",
			province: "ON",
			postalCode: "L4B 0B6",
			latitude: 43.8428,
			longitude: -79.3849,
		},
		comparables: [
			comparable(
				"62 Suncrest Blvd Unit 708, Markham, ON L3T 0C1",
				708_000,
				702_000,
				"2025-12-01",
				"Condo",
				860,
				2014
			),
			comparable(
				"39 Galleria Pkwy Unit 906, Markham, ON L3T 0A6",
				695_000,
				698_000,
				"2026-01-25",
				"Condo",
				842,
				2011
			),
			comparable(
				"376 Highway 7 E Unit 612, Richmond Hill, ON L4B 0C6",
				703_000,
				699_000,
				"2025-10-21",
				"Condo",
				854,
				2012
			),
		],
		heroImageStorageId: toStorageId(MOCK_MORTGAGE_IMAGE_STORAGE_IDS[11]),
	},
] as const satisfies readonly MockMortgageCatalogItem[];

function slugify(value: string) {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function dollarsToCents(value: number) {
	return Math.round(value * 100);
}

export function computeAmortizedMonthlyPaymentCents(args: {
	amortizationMonths: number;
	annualRatePercent: number;
	principalDollars: number;
}) {
	const principal = dollarsToCents(args.principalDollars);
	const monthlyRate = args.annualRatePercent / 100 / 12;
	if (monthlyRate === 0) {
		return Math.round(principal / args.amortizationMonths);
	}

	const factor = (1 + monthlyRate) ** args.amortizationMonths;
	const payment = (principal * monthlyRate * factor) / (factor - 1);
	return Math.round(payment);
}

export function addMonthsToBusinessDate(value: string, months: number) {
	const [year, month, day] = value.split("-").map(Number);
	const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
	date.setUTCMonth(date.getUTCMonth() + months);
	return date.toISOString().slice(0, 10);
}

export function firstDayOfNextMonth(timestamp: number) {
	const date = new Date(timestamp);
	const nextMonth = new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
	);
	return nextMonth.toISOString().slice(0, 10);
}

export function buildMockMortgageBorrowerEmail(item: MockMortgageCatalogItem) {
	return `mock.borrower+${slugify(item.key)}@fairlend.dev`;
}

export function buildMockMortgageBorrowerPhone(index: number) {
	return `416555${String(index + 1).padStart(4, "0")}`;
}

export function buildMockMortgageBankAccount(index: number) {
	return {
		accountNumber: `9000${String(index + 1).padStart(4, "0")}`,
		institutionNumber: "004",
		transitNumber: String(10_000 + index + 1),
	};
}

export function buildMockMortgageListingTitle(item: MockMortgageCatalogItem) {
	const lienLabel =
		item.lienPosition === 1 ? "First Mortgage" : "Second Mortgage";
	return `Mock ${lienLabel} - ${item.borrowerName} - ${item.neighborhoodLabel}`;
}

export function buildMockMortgageSeoSlug(item: MockMortgageCatalogItem) {
	return slugify(buildMockMortgageListingTitle(item));
}

export interface MockOriginationBatchStatusSnapshot {
	readonly activeBatchExists: boolean;
	readonly batchId: Id<"mockOriginationBatches"> | null;
	readonly catalogVersion: string | null;
	readonly cleanedAt: number | null;
	readonly completedAt: number | null;
	readonly failedCount: number;
	readonly itemCount: number;
	readonly lastError: string | null;
	readonly providerCleanupCount: number;
	readonly publishedCount: number;
	readonly readyCount: number;
	readonly startedAt: number | null;
	readonly status: Doc<"mockOriginationBatches">["status"] | null;
	readonly updatedAt: number | null;
}

type BatchReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

export async function getLatestMockOriginationBatchSnapshot(
	ctx: BatchReaderCtx,
	orgId: string | undefined
): Promise<MockOriginationBatchStatusSnapshot | null> {
	if (!orgId) {
		return null;
	}

	const batch = await ctx.db
		.query("mockOriginationBatches")
		.withIndex("by_org_started_at", (query) => query.eq("orgId", orgId))
		.order("desc")
		.first();
	if (!batch) {
		return null;
	}

	const items = await ctx.db
		.query("mockOriginationBatchItems")
		.withIndex("by_batch", (query) => query.eq("batchId", batch._id))
		.collect();

	return {
		activeBatchExists: batch.status !== "cleaned",
		batchId: batch._id,
		catalogVersion: batch.catalogVersion,
		cleanedAt: batch.cleanedAt ?? null,
		completedAt: batch.completedAt ?? null,
		failedCount: items.filter((item) => item.status === "failed").length,
		itemCount: batch.itemCount,
		lastError: batch.lastError ?? null,
		providerCleanupCount: items.filter(
			(item) =>
				item.status === "cleanup_provider_done" ||
				item.status === "cleanup_local_done" ||
				item.status === "cleaned"
		).length,
		publishedCount: items.filter(
			(item) =>
				item.status === "published" ||
				item.status === "cleanup_provider_done" ||
				item.status === "cleanup_local_done" ||
				item.status === "cleaned"
		).length,
		readyCount: items.filter(
			(item) =>
				item.status === "committed" ||
				item.status === "published" ||
				item.status === "cleanup_provider_done" ||
				item.status === "cleanup_local_done" ||
				item.status === "cleaned"
		).length,
		startedAt: batch.startedAt,
		status: batch.status,
		updatedAt: batch.updatedAt,
	};
}
