import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { applyComputedFieldValues } from "./entityViewFields";
import type { EntityViewAdapterContract, UnifiedRecord } from "./types";

type ObjectDef = Doc<"objectDefs">;
type UserDoc = Doc<"users">;
type BorrowerDoc = Doc<"borrowers">;
type BrokerDoc = Doc<"brokers">;
type LenderDoc = Doc<"lenders">;
type OrganizationDoc = Doc<"organizations">;
type MortgageDoc = Doc<"mortgages">;
type MortgageBorrowerDoc = Doc<"mortgageBorrowers">;
type PropertyDoc = Doc<"properties">;
type ListingDoc = Doc<"listings">;

const FRACTIONAL_SHARE_UNITS_PER_WHOLE = 10_000;
const DISPLAY_LABEL_SEPARATOR_REGEX = /[\s._-]+/;

interface EntityViewHydrationArgs {
	adapterContract: EntityViewAdapterContract;
	ctx: QueryCtx;
	objectDef: ObjectDef;
	orgId: string;
	records: readonly UnifiedRecord[];
	requestedFieldNames?: ReadonlySet<string>;
}

function formatCurrencyAmount(value: number, divisor = 1): string {
	const normalizedValue = value / divisor;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: normalizedValue % 1 === 0 ? 0 : 2,
	}).format(normalizedValue);
}

function toDisplayLabel(value: string): string {
	return value
		.split(DISPLAY_LABEL_SEPARATOR_REGEX)
		.filter((part) => part.length > 0)
		.map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
		.join(" ");
}

function buildUserDisplayName(
	user: UserDoc | null | undefined
): string | undefined {
	if (!user) {
		return undefined;
	}

	return [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
}

function buildPropertySummary(
	property: PropertyDoc | null | undefined,
	fallbackFields?: Record<string, unknown>
): string | undefined {
	if (property) {
		return [property.streetAddress, property.city, property.province]
			.filter(Boolean)
			.join(", ");
	}

	const city =
		typeof fallbackFields?.city === "string" ? fallbackFields.city : undefined;
	const province =
		typeof fallbackFields?.province === "string"
			? fallbackFields.province
			: undefined;
	const propertyType =
		typeof fallbackFields?.propertyType === "string"
			? toDisplayLabel(fallbackFields.propertyType)
			: undefined;

	return [propertyType, city, province].filter(Boolean).join(" • ");
}

function buildBorrowerSummary(names: readonly string[]): string | undefined {
	if (names.length === 0) {
		return undefined;
	}

	if (names.length === 1) {
		return names[0];
	}

	return `${names[0]} + ${String(names.length - 1)} more`;
}

function buildBrokerRollupSummary(
	broker: BrokerDoc | null | undefined
): string | undefined {
	if (!broker) {
		return undefined;
	}

	const brokerageLabel =
		typeof broker.brokerageName === "string" &&
		broker.brokerageName.trim().length > 0
			? broker.brokerageName.trim()
			: undefined;
	const licenseParts = [broker.licenseProvince, broker.licenseId].filter(
		(part): part is string => typeof part === "string" && part.trim().length > 0
	);
	const licenseLabel =
		licenseParts.length > 0 ? licenseParts.join(" ") : undefined;

	return [brokerageLabel ?? "Brokerage", licenseLabel]
		.filter(Boolean)
		.join(" • ");
}

function buildBrokerPersonSummary(args: {
	broker: BrokerDoc | null | undefined;
	user: UserDoc | null | undefined;
}): string | undefined {
	const brokerName = buildUserDisplayName(args.user);
	const brokerageName =
		typeof args.broker?.brokerageName === "string" &&
		args.broker.brokerageName.trim().length > 0
			? args.broker.brokerageName.trim()
			: undefined;

	return [brokerName, brokerageName].filter(Boolean).join(" • ");
}

function buildListingSummary(
	listing: ListingDoc | null | undefined
): string | undefined {
	if (!listing) {
		return undefined;
	}

	const listingTitle =
		typeof listing.title === "string" && listing.title.trim().length > 0
			? listing.title
			: undefined;
	const marketSummary = [
		listing.status ? toDisplayLabel(listing.status) : undefined,
		typeof listing.city === "string" ? listing.city : undefined,
		typeof listing.province === "string" ? listing.province : undefined,
	]
		.filter(Boolean)
		.join(" • ");

	return listingTitle ?? marketSummary;
}

function buildMortgageSummary(args: {
	mortgage: MortgageDoc | null | undefined;
	property?: PropertyDoc | null | undefined;
}): string | undefined {
	if (!args.mortgage) {
		return undefined;
	}

	const propertySummary = buildPropertySummary(args.property);
	const status = toDisplayLabel(args.mortgage.status);
	const principal = formatCurrencyAmount(args.mortgage.principal);

	return [propertySummary, `${status} mortgage`, principal]
		.filter(Boolean)
		.join(" • ");
}

function buildListingMortgageSummary(
	mortgage: MortgageDoc | null | undefined
): string | undefined {
	if (!mortgage) {
		return undefined;
	}

	return [
		toDisplayLabel(mortgage.status),
		formatCurrencyAmount(mortgage.principal),
	]
		.filter(Boolean)
		.join(" • ");
}

async function loadUsersById(
	ctx: QueryCtx,
	userIds: Iterable<string>
): Promise<Map<string, UserDoc>> {
	const users = new Map<string, UserDoc>();

	await Promise.all(
		[...new Set([...userIds])].map(async (userId) => {
			const normalizedId = ctx.db.normalizeId("users", userId);
			if (!normalizedId) {
				return;
			}

			const user = await ctx.db.get(normalizedId);
			if (user) {
				users.set(String(user._id), user);
			}
		})
	);

	return users;
}

async function loadUsersByAuthId(
	ctx: QueryCtx,
	authIds: Iterable<string>
): Promise<Map<string, UserDoc>> {
	const users = new Map<string, UserDoc>();
	const uniqueAuthIds = [
		...new Set(
			[...authIds].filter(
				(authId): authId is string =>
					typeof authId === "string" && authId.trim().length > 0
			)
		),
	];

	await Promise.all(
		uniqueAuthIds.map(async (authId) => {
			const user = await ctx.db
				.query("users")
				.withIndex("authId", (query) => query.eq("authId", authId))
				.unique();
			if (user) {
				users.set(authId, user);
			}
		})
	);

	return users;
}

async function loadBorrowersById(args: {
	ctx: QueryCtx;
	orgId: string;
	recordIds: Iterable<string>;
}): Promise<Map<string, BorrowerDoc>> {
	const borrowers = new Map<string, BorrowerDoc>();

	await Promise.all(
		[...new Set([...args.recordIds])].map(async (recordId) => {
			const normalizedId = args.ctx.db.normalizeId("borrowers", recordId);
			if (!normalizedId) {
				return;
			}

			const borrower = await args.ctx.db.get(normalizedId);
			if (borrower && borrower.orgId === args.orgId) {
				borrowers.set(String(borrower._id), borrower);
			}
		})
	);

	return borrowers;
}

async function loadBrokersById(args: {
	ctx: QueryCtx;
	orgId: string;
	recordIds: Iterable<string>;
}): Promise<Map<string, BrokerDoc>> {
	const brokers = new Map<string, BrokerDoc>();

	await Promise.all(
		[...new Set([...args.recordIds])].map(async (recordId) => {
			const normalizedId = args.ctx.db.normalizeId("brokers", recordId);
			if (!normalizedId) {
				return;
			}

			const broker = await args.ctx.db.get(normalizedId);
			if (
				broker &&
				(broker.orgId === args.orgId || broker.orgId === undefined)
			) {
				brokers.set(String(broker._id), broker);
			}
		})
	);

	return brokers;
}

async function loadLenderDocsByRecordIds(
	ctx: QueryCtx,
	recordIds: readonly string[]
): Promise<Map<string, LenderDoc>> {
	const lenders = new Map<string, LenderDoc>();

	await Promise.all(
		[...new Set(recordIds)].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("lenders", recordId);
			if (!normalizedId) {
				return;
			}

			const lender = await ctx.db.get(normalizedId);
			if (lender) {
				lenders.set(recordId, lender);
			}
		})
	);

	return lenders;
}

async function loadBrokerDocsByRecordIds(
	ctx: QueryCtx,
	recordIds: readonly string[]
): Promise<Map<string, BrokerDoc>> {
	const brokers = new Map<string, BrokerDoc>();

	await Promise.all(
		[...new Set(recordIds)].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("brokers", recordId);
			if (!normalizedId) {
				return;
			}

			const broker = await ctx.db.get(normalizedId);
			if (broker) {
				brokers.set(recordId, broker);
			}
		})
	);

	return brokers;
}

async function loadOrganizationsByWorkosIds(
	ctx: QueryCtx,
	workosIds: Iterable<string>
): Promise<Map<string, OrganizationDoc>> {
	const organizations = new Map<string, OrganizationDoc>();
	const uniqueIds = [
		...new Set(
			[...workosIds].filter(
				(id): id is string => typeof id === "string" && id.trim().length > 0
			)
		),
	];

	await Promise.all(
		uniqueIds.map(async (workosId) => {
			const org = await ctx.db
				.query("organizations")
				.withIndex("workosId", (q) => q.eq("workosId", workosId))
				.unique();
			if (org) {
				organizations.set(workosId, org);
			}
		})
	);

	return organizations;
}

async function loadMortgagesById(args: {
	ctx: QueryCtx;
	orgId: string;
	recordIds: Iterable<string>;
}): Promise<Map<string, MortgageDoc>> {
	const mortgages = new Map<string, MortgageDoc>();

	await Promise.all(
		[...new Set([...args.recordIds])].map(async (recordId) => {
			const normalizedId = args.ctx.db.normalizeId("mortgages", recordId);
			if (!normalizedId) {
				return;
			}

			const mortgage = await args.ctx.db.get(normalizedId);
			if (mortgage && mortgage.orgId === args.orgId) {
				mortgages.set(String(mortgage._id), mortgage);
			}
		})
	);

	return mortgages;
}

async function loadLinkedMortgagesById(
	ctx: QueryCtx,
	recordIds: Iterable<string>
): Promise<Map<string, MortgageDoc>> {
	const mortgages = new Map<string, MortgageDoc>();

	await Promise.all(
		[...new Set([...recordIds])].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("mortgages", recordId);
			if (!normalizedId) {
				return;
			}

			const mortgage = await ctx.db.get(normalizedId);
			if (mortgage) {
				mortgages.set(String(mortgage._id), mortgage);
			}
		})
	);

	return mortgages;
}

async function loadLinkedBorrowersById(
	ctx: QueryCtx,
	recordIds: Iterable<string>
): Promise<Map<string, BorrowerDoc>> {
	const borrowers = new Map<string, BorrowerDoc>();

	await Promise.all(
		[...new Set([...recordIds])].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("borrowers", recordId);
			if (!normalizedId) {
				return;
			}

			const borrower = await ctx.db.get(normalizedId);
			if (borrower) {
				borrowers.set(String(borrower._id), borrower);
			}
		})
	);

	return borrowers;
}

async function loadLinkedBrokersById(
	ctx: QueryCtx,
	recordIds: Iterable<string>
): Promise<Map<string, BrokerDoc>> {
	const brokers = new Map<string, BrokerDoc>();

	await Promise.all(
		[...new Set([...recordIds])].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("brokers", recordId);
			if (!normalizedId) {
				return;
			}

			const broker = await ctx.db.get(normalizedId);
			if (broker) {
				brokers.set(String(broker._id), broker);
			}
		})
	);

	return brokers;
}

async function loadPropertiesById(
	ctx: QueryCtx,
	recordIds: Iterable<string>
): Promise<Map<string, PropertyDoc>> {
	const properties = new Map<string, PropertyDoc>();

	await Promise.all(
		[...new Set([...recordIds])].map(async (recordId) => {
			const normalizedId = ctx.db.normalizeId("properties", recordId);
			if (!normalizedId) {
				return;
			}

			const property = await ctx.db.get(normalizedId);
			if (property) {
				properties.set(String(property._id), property);
			}
		})
	);

	return properties;
}

async function loadListingsByMortgageId(
	ctx: QueryCtx,
	mortgageIds: Iterable<string>
): Promise<Map<string, ListingDoc>> {
	const listings = new Map<string, ListingDoc>();

	await Promise.all(
		[...new Set([...mortgageIds])].map(async (mortgageId) => {
			const normalizedId = ctx.db.normalizeId("mortgages", mortgageId);
			if (!normalizedId) {
				return;
			}

			const listing = await ctx.db
				.query("listings")
				.withIndex("by_mortgage", (q) => q.eq("mortgageId", normalizedId))
				.unique();

			if (listing) {
				listings.set(mortgageId, listing);
			}
		})
	);

	return listings;
}

function mergeHydratedFields(
	record: UnifiedRecord,
	fields: Record<string, unknown>
): UnifiedRecord {
	return {
		...record,
		fields: {
			...record.fields,
			...fields,
		},
	};
}

function shouldHydrateField(
	args: EntityViewHydrationArgs,
	fieldName: string
): boolean {
	return args.requestedFieldNames?.has(fieldName) ?? true;
}

async function loadMortgageBorrowerLinksByMortgageId(
	ctx: QueryCtx,
	mortgageIds: Iterable<string>
): Promise<Map<string, MortgageBorrowerDoc[]>> {
	const entries = await Promise.all(
		[...new Set([...mortgageIds])].map(
			async (mortgageId): Promise<readonly [string, MortgageBorrowerDoc[]]> => {
				const normalizedMortgageId = ctx.db.normalizeId(
					"mortgages",
					mortgageId
				);
				if (!normalizedMortgageId) {
					return [mortgageId, []];
				}

				const links = await ctx.db
					.query("mortgageBorrowers")
					.withIndex("by_mortgage", (query) =>
						query.eq("mortgageId", normalizedMortgageId)
					)
					.collect();

				return [mortgageId, links];
			}
		)
	);

	return new Map<string, MortgageBorrowerDoc[]>(entries);
}

async function hydrateListingRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const shouldHydratePropertySummary = shouldHydrateField(
		args,
		"propertySummary"
	);
	const shouldHydrateMortgageSummary = shouldHydrateField(
		args,
		"mortgageSummary"
	);
	const propertyIds = shouldHydratePropertySummary
		? args.records.flatMap((record) =>
				typeof record.fields.propertyId === "string"
					? [record.fields.propertyId]
					: []
			)
		: [];
	const mortgageIds = shouldHydrateMortgageSummary
		? args.records.flatMap((record) =>
				typeof record.fields.mortgageId === "string"
					? [record.fields.mortgageId]
					: []
			)
		: [];
	const [propertiesById, mortgagesById] = await Promise.all([
		shouldHydratePropertySummary
			? loadPropertiesById(args.ctx, propertyIds)
			: Promise.resolve(new Map<string, PropertyDoc>()),
		shouldHydrateMortgageSummary
			? loadMortgagesById({
					ctx: args.ctx,
					orgId: args.orgId,
					recordIds: mortgageIds,
				})
			: Promise.resolve(new Map<string, MortgageDoc>()),
	]);

	return args.records.map((record) => {
		const propertyId =
			typeof record.fields.propertyId === "string"
				? record.fields.propertyId
				: undefined;
		const mortgageId =
			typeof record.fields.mortgageId === "string"
				? record.fields.mortgageId
				: undefined;

		return mergeHydratedFields(record, {
			...(shouldHydratePropertySummary
				? {
						propertySummary: buildPropertySummary(
							propertyId ? propertiesById.get(propertyId) : undefined,
							record.fields
						),
					}
				: {}),
			...(shouldHydrateMortgageSummary
				? {
						mortgageSummary: buildListingMortgageSummary(
							mortgageId ? mortgagesById.get(mortgageId) : undefined
						),
					}
				: {}),
		});
	});
}

async function hydrateMortgageRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const shouldHydratePropertySummary = shouldHydrateField(
		args,
		"propertySummary"
	);
	const shouldHydrateBorrowerSummary = shouldHydrateField(
		args,
		"borrowerSummary"
	);
	const shouldHydrateListingSummary = shouldHydrateField(
		args,
		"listingSummary"
	);
	const propertyIds = shouldHydratePropertySummary
		? args.records.flatMap((record) =>
				typeof record.fields.propertyId === "string"
					? [record.fields.propertyId]
					: []
			)
		: [];
	const propertiesById = shouldHydratePropertySummary
		? await loadPropertiesById(args.ctx, propertyIds)
		: new Map<string, PropertyDoc>();
	const mortgageIds = args.records.map((record) => record._id);
	const [borrowerLinksByMortgageId, listingsByMortgageId] = await Promise.all([
		shouldHydrateBorrowerSummary
			? Promise.all(
					mortgageIds.map(
						async (
							mortgageId
						): Promise<readonly [string, MortgageBorrowerDoc[]]> => {
							const normalizedMortgageId = args.ctx.db.normalizeId(
								"mortgages",
								mortgageId
							);
							if (!normalizedMortgageId) {
								return [mortgageId, []];
							}

							const links = await args.ctx.db
								.query("mortgageBorrowers")
								.withIndex("by_mortgage", (q) =>
									q.eq("mortgageId", normalizedMortgageId)
								)
								.collect();

							return [mortgageId, links];
						}
					)
				).then((entries) => new Map<string, MortgageBorrowerDoc[]>(entries))
			: Promise.resolve(new Map<string, MortgageBorrowerDoc[]>()),
		shouldHydrateListingSummary
			? loadListingsByMortgageId(args.ctx, mortgageIds)
			: Promise.resolve(new Map<string, ListingDoc>()),
	]);
	const borrowersById = shouldHydrateBorrowerSummary
		? await loadBorrowersById({
				ctx: args.ctx,
				orgId: args.orgId,
				recordIds: [...borrowerLinksByMortgageId.values()].flatMap((links) =>
					links.map((link) => String(link.borrowerId))
				),
			})
		: new Map<string, BorrowerDoc>();
	const usersById = shouldHydrateBorrowerSummary
		? await loadUsersById(
				args.ctx,
				[...borrowersById.values()].map((borrower) => String(borrower.userId))
			)
		: new Map<string, UserDoc>();

	return args.records.map((record) => {
		const propertyId =
			typeof record.fields.propertyId === "string"
				? record.fields.propertyId
				: undefined;
		const borrowerNames = shouldHydrateBorrowerSummary
			? (borrowerLinksByMortgageId.get(record._id)?.flatMap((link) => {
					const borrower = borrowersById.get(String(link.borrowerId));
					const user = borrower ? usersById.get(String(borrower.userId)) : null;
					const name = buildUserDisplayName(user);
					return name ? [name] : [];
				}) ?? [])
			: [];

		return mergeHydratedFields(record, {
			...(shouldHydratePropertySummary
				? {
						propertySummary: buildPropertySummary(
							propertyId ? propertiesById.get(propertyId) : undefined
						),
					}
				: {}),
			...(shouldHydrateBorrowerSummary
				? {
						borrowerSummary: buildBorrowerSummary(borrowerNames),
					}
				: {}),
			...(shouldHydrateListingSummary
				? {
						listingSummary: buildListingSummary(
							listingsByMortgageId.get(record._id)
						),
					}
				: {}),
		});
	});
}

async function hydrateObligationRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const shouldHydrateMortgageSummary = shouldHydrateField(
		args,
		"mortgageSummary"
	);
	const shouldHydrateBorrowerSummary = shouldHydrateField(
		args,
		"borrowerSummary"
	);
	const mortgageIds = shouldHydrateMortgageSummary
		? args.records.flatMap((record) =>
				typeof record.fields.mortgageId === "string"
					? [record.fields.mortgageId]
					: []
			)
		: [];
	const borrowerIds = shouldHydrateBorrowerSummary
		? args.records.flatMap((record) =>
				typeof record.fields.borrowerId === "string"
					? [record.fields.borrowerId]
					: []
			)
		: [];
	const [mortgagesById, borrowersById] = await Promise.all([
		shouldHydrateMortgageSummary
			? loadMortgagesById({
					ctx: args.ctx,
					orgId: args.orgId,
					recordIds: mortgageIds,
				})
			: Promise.resolve(new Map<string, MortgageDoc>()),
		shouldHydrateBorrowerSummary
			? loadBorrowersById({
					ctx: args.ctx,
					orgId: args.orgId,
					recordIds: borrowerIds,
				})
			: Promise.resolve(new Map<string, BorrowerDoc>()),
	]);
	const propertiesById = shouldHydrateMortgageSummary
		? await loadPropertiesById(
				args.ctx,
				[...mortgagesById.values()].map((mortgage) =>
					String(mortgage.propertyId)
				)
			)
		: new Map<string, PropertyDoc>();
	const usersById = shouldHydrateBorrowerSummary
		? await loadUsersById(
				args.ctx,
				[...borrowersById.values()].map((borrower) => String(borrower.userId))
			)
		: new Map<string, UserDoc>();

	return args.records.map((record) => {
		const mortgageId =
			typeof record.fields.mortgageId === "string"
				? record.fields.mortgageId
				: undefined;
		const borrowerId =
			typeof record.fields.borrowerId === "string"
				? record.fields.borrowerId
				: undefined;
		const mortgage = mortgageId ? mortgagesById.get(mortgageId) : undefined;
		const borrower = borrowerId ? borrowersById.get(borrowerId) : undefined;

		return mergeHydratedFields(record, {
			...(shouldHydrateMortgageSummary
				? {
						mortgageSummary: buildMortgageSummary({
							mortgage,
							property: mortgage
								? propertiesById.get(String(mortgage.propertyId))
								: undefined,
						}),
					}
				: {}),
			...(shouldHydrateBorrowerSummary
				? {
						borrowerSummary: buildUserDisplayName(
							borrower ? usersById.get(String(borrower.userId)) : undefined
						),
					}
				: {}),
		});
	});
}

interface DealHydrationFlags {
	readonly shouldHydrateBorrowerSummary: boolean;
	readonly shouldHydrateBrokerSummary: boolean;
	readonly shouldHydrateFractionAmount: boolean;
	readonly shouldHydrateLenderSummary: boolean;
	readonly shouldHydrateLoanAmount: boolean;
	readonly shouldHydrateMortgageSummary: boolean;
}

interface DealHydrationMaps {
	readonly borrowerLinksByMortgageId: ReadonlyMap<
		string,
		readonly MortgageBorrowerDoc[]
	>;
	readonly borrowersById: ReadonlyMap<string, BorrowerDoc>;
	readonly borrowerUsersById: ReadonlyMap<string, UserDoc>;
	readonly brokersById: ReadonlyMap<string, BrokerDoc>;
	readonly brokerUsersById: ReadonlyMap<string, UserDoc>;
	readonly buyerUsersByAuthId: ReadonlyMap<string, UserDoc>;
	readonly lendersById: ReadonlyMap<string, LenderDoc>;
	readonly lenderUsersById: ReadonlyMap<string, UserDoc>;
	readonly mortgagesById: ReadonlyMap<string, MortgageDoc>;
	readonly propertiesById: ReadonlyMap<string, PropertyDoc>;
}

function getStringField(
	fields: Record<string, unknown>,
	fieldName: string
): string | undefined {
	const value = fields[fieldName];
	return typeof value === "string" ? value : undefined;
}

function getNumberField(
	fields: Record<string, unknown>,
	fieldName: string
): number | undefined {
	const value = fields[fieldName];
	return typeof value === "number" ? value : undefined;
}

function resolveDealLenderUser(args: {
	buyerAuthId?: string;
	lender?: LenderDoc;
	maps: Pick<DealHydrationMaps, "buyerUsersByAuthId" | "lenderUsersById">;
}): UserDoc | undefined {
	if (args.lender) {
		return args.maps.lenderUsersById.get(String(args.lender.userId));
	}
	if (args.buyerAuthId) {
		return args.maps.buyerUsersByAuthId.get(args.buyerAuthId);
	}
	return undefined;
}

function orderMortgageBorrowerLinks(
	links: readonly MortgageBorrowerDoc[]
): MortgageBorrowerDoc[] {
	return [...links].sort((left, right) => {
		if (left.role === right.role) {
			return 0;
		}
		return left.role === "primary" ? -1 : 1;
	});
}

function resolveDealBorrowerFields(args: {
	links: readonly MortgageBorrowerDoc[];
	maps: Pick<DealHydrationMaps, "borrowersById" | "borrowerUsersById">;
}): { borrowerId?: string; borrowerSummary?: string } {
	const borrowerNames = args.links.flatMap((link) => {
		const borrower = args.maps.borrowersById.get(String(link.borrowerId));
		const user = borrower
			? args.maps.borrowerUsersById.get(String(borrower.userId))
			: null;
		const name = buildUserDisplayName(user);
		return name ? [name] : [];
	});
	const primaryBorrowerId = args.links[0]?.borrowerId;

	return {
		borrowerId: primaryBorrowerId ? String(primaryBorrowerId) : undefined,
		borrowerSummary: buildBorrowerSummary(borrowerNames),
	};
}

interface DealRecordHydrationContext {
	readonly buyerAuthId?: string;
	readonly fractionalShare?: number;
	readonly lender?: LenderDoc;
	readonly mortgage?: MortgageDoc;
	readonly mortgageId?: string;
}

function resolveDealRecordHydrationContext(args: {
	maps: DealHydrationMaps;
	record: UnifiedRecord;
}): DealRecordHydrationContext {
	const mortgageId = getStringField(args.record.fields, "mortgageId");
	const lenderId = getStringField(args.record.fields, "lenderId");

	return {
		buyerAuthId: getStringField(args.record.fields, "buyerId"),
		fractionalShare: getNumberField(args.record.fields, "fractionalShare"),
		lender: lenderId ? args.maps.lendersById.get(lenderId) : undefined,
		mortgage: mortgageId ? args.maps.mortgagesById.get(mortgageId) : undefined,
		mortgageId,
	};
}

function applyDealMortgageAmountFields(args: {
	context: DealRecordHydrationContext;
	flags: Pick<
		DealHydrationFlags,
		| "shouldHydrateFractionAmount"
		| "shouldHydrateLoanAmount"
		| "shouldHydrateMortgageSummary"
	>;
	hydratedFields: Record<string, unknown>;
	maps: Pick<DealHydrationMaps, "propertiesById">;
}): void {
	const { fractionalShare, mortgage } = args.context;
	if (args.flags.shouldHydrateMortgageSummary) {
		args.hydratedFields.mortgageSummary = buildMortgageSummary({
			mortgage,
			property: mortgage
				? args.maps.propertiesById.get(String(mortgage.propertyId))
				: undefined,
		});
	}
	if (args.flags.shouldHydrateLoanAmount) {
		args.hydratedFields.loanAmount = mortgage?.principal;
	}
	if (args.flags.shouldHydrateFractionAmount) {
		args.hydratedFields.fractionAmount =
			mortgage && fractionalShare !== undefined
				? (mortgage.principal * fractionalShare) /
					FRACTIONAL_SHARE_UNITS_PER_WHOLE
				: undefined;
	}
}

function applyDealLenderField(args: {
	context: DealRecordHydrationContext;
	flags: Pick<DealHydrationFlags, "shouldHydrateLenderSummary">;
	hydratedFields: Record<string, unknown>;
	maps: DealHydrationMaps;
}): void {
	if (args.flags.shouldHydrateLenderSummary) {
		args.hydratedFields.lenderSummary = buildUserDisplayName(
			resolveDealLenderUser({
				buyerAuthId: args.context.buyerAuthId,
				lender: args.context.lender,
				maps: args.maps,
			})
		);
	}
}

function applyDealBrokerFields(args: {
	context: DealRecordHydrationContext;
	flags: Pick<DealHydrationFlags, "shouldHydrateBrokerSummary">;
	hydratedFields: Record<string, unknown>;
	maps: DealHydrationMaps;
}): void {
	if (args.flags.shouldHydrateBrokerSummary) {
		const broker = args.context.mortgage
			? args.maps.brokersById.get(
					String(args.context.mortgage.brokerOfRecordId)
				)
			: undefined;
		args.hydratedFields.brokerId = args.context.mortgage
			? String(args.context.mortgage.brokerOfRecordId)
			: undefined;
		args.hydratedFields.brokerSummary = buildBrokerPersonSummary({
			broker,
			user: broker
				? args.maps.brokerUsersById.get(String(broker.userId))
				: null,
		});
	}
}

function applyDealBorrowerFields(args: {
	context: DealRecordHydrationContext;
	flags: Pick<DealHydrationFlags, "shouldHydrateBorrowerSummary">;
	hydratedFields: Record<string, unknown>;
	maps: DealHydrationMaps;
}): void {
	if (args.flags.shouldHydrateBorrowerSummary) {
		const borrowerFields = resolveDealBorrowerFields({
			links: orderMortgageBorrowerLinks(
				args.context.mortgageId
					? (args.maps.borrowerLinksByMortgageId.get(args.context.mortgageId) ??
							[])
					: []
			),
			maps: args.maps,
		});
		Object.assign(args.hydratedFields, borrowerFields);
	}
}

function buildDealHydratedFields(args: {
	flags: DealHydrationFlags;
	maps: DealHydrationMaps;
	record: UnifiedRecord;
}): Record<string, unknown> {
	const context = resolveDealRecordHydrationContext({
		maps: args.maps,
		record: args.record,
	});
	const hydratedFields: Record<string, unknown> = {};

	applyDealMortgageAmountFields({ ...args, context, hydratedFields });
	applyDealLenderField({ ...args, context, hydratedFields });
	applyDealBrokerFields({ ...args, context, hydratedFields });
	applyDealBorrowerFields({ ...args, context, hydratedFields });

	return hydratedFields;
}

async function hydrateDealRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const shouldHydrateMortgageSummary = shouldHydrateField(
		args,
		"mortgageSummary"
	);
	const shouldHydrateLoanAmount = shouldHydrateField(args, "loanAmount");
	const shouldHydrateFractionAmount = shouldHydrateField(
		args,
		"fractionAmount"
	);
	const shouldHydrateLenderSummary = shouldHydrateField(args, "lenderSummary");
	const shouldHydrateBrokerSummary = shouldHydrateField(args, "brokerSummary");
	const shouldHydrateBorrowerSummary = shouldHydrateField(
		args,
		"borrowerSummary"
	);
	const flags: DealHydrationFlags = {
		shouldHydrateBorrowerSummary,
		shouldHydrateBrokerSummary,
		shouldHydrateFractionAmount,
		shouldHydrateLenderSummary,
		shouldHydrateLoanAmount,
		shouldHydrateMortgageSummary,
	};
	const shouldLoadMortgage =
		shouldHydrateMortgageSummary ||
		shouldHydrateLoanAmount ||
		shouldHydrateFractionAmount ||
		shouldHydrateBrokerSummary ||
		shouldHydrateBorrowerSummary;
	const mortgageIds = shouldLoadMortgage
		? args.records.flatMap((record) =>
				typeof record.fields.mortgageId === "string"
					? [record.fields.mortgageId]
					: []
			)
		: [];
	const lenderIds = shouldHydrateLenderSummary
		? args.records.flatMap((record) =>
				typeof record.fields.lenderId === "string"
					? [record.fields.lenderId]
					: []
			)
		: [];
	const buyerAuthIds = shouldHydrateLenderSummary
		? args.records.flatMap((record) =>
				typeof record.fields.buyerId === "string" ? [record.fields.buyerId] : []
			)
		: [];

	const [mortgagesById, lendersById, buyerUsersByAuthId] = await Promise.all([
		shouldLoadMortgage
			? loadLinkedMortgagesById(args.ctx, mortgageIds)
			: Promise.resolve(new Map<string, MortgageDoc>()),
		shouldHydrateLenderSummary
			? loadLenderDocsByRecordIds(args.ctx, lenderIds)
			: Promise.resolve(new Map<string, LenderDoc>()),
		shouldHydrateLenderSummary
			? loadUsersByAuthId(args.ctx, buyerAuthIds)
			: Promise.resolve(new Map<string, UserDoc>()),
	]);
	const propertiesById = shouldHydrateMortgageSummary
		? await loadPropertiesById(
				args.ctx,
				[...mortgagesById.values()].map((mortgage) =>
					String(mortgage.propertyId)
				)
			)
		: new Map<string, PropertyDoc>();
	const borrowerLinksByMortgageId = shouldHydrateBorrowerSummary
		? await loadMortgageBorrowerLinksByMortgageId(args.ctx, mortgageIds)
		: new Map<string, MortgageBorrowerDoc[]>();
	const borrowerIds = shouldHydrateBorrowerSummary
		? [...borrowerLinksByMortgageId.values()].flatMap((links) =>
				links.map((link) => String(link.borrowerId))
			)
		: [];
	const brokerIds = shouldHydrateBrokerSummary
		? [...mortgagesById.values()].map((mortgage) =>
				String(mortgage.brokerOfRecordId)
			)
		: [];
	const [borrowersById, brokersById] = await Promise.all([
		shouldHydrateBorrowerSummary
			? loadLinkedBorrowersById(args.ctx, borrowerIds)
			: Promise.resolve(new Map<string, BorrowerDoc>()),
		shouldHydrateBrokerSummary
			? loadLinkedBrokersById(args.ctx, brokerIds)
			: Promise.resolve(new Map<string, BrokerDoc>()),
	]);
	const [borrowerUsersById, brokerUsersById, lenderUsersById] =
		await Promise.all([
			shouldHydrateBorrowerSummary
				? loadUsersById(
						args.ctx,
						[...borrowersById.values()].map((borrower) =>
							String(borrower.userId)
						)
					)
				: Promise.resolve(new Map<string, UserDoc>()),
			shouldHydrateBrokerSummary
				? loadUsersById(
						args.ctx,
						[...brokersById.values()].map((broker) => String(broker.userId))
					)
				: Promise.resolve(new Map<string, UserDoc>()),
			shouldHydrateLenderSummary
				? loadUsersById(
						args.ctx,
						[...lendersById.values()].map((lender) => String(lender.userId))
					)
				: Promise.resolve(new Map<string, UserDoc>()),
		]);

	const maps: DealHydrationMaps = {
		borrowerLinksByMortgageId,
		borrowersById,
		borrowerUsersById,
		brokersById,
		brokerUsersById,
		buyerUsersByAuthId,
		lendersById,
		lenderUsersById,
		mortgagesById,
		propertiesById,
	};

	return args.records.map((record) =>
		mergeHydratedFields(
			record,
			buildDealHydratedFields({
				flags,
				maps,
				record,
			})
		)
	);
}

async function hydrateBorrowerRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const shouldHydrateBorrowerName = shouldHydrateField(args, "borrowerName");
	const userIds = shouldHydrateBorrowerName
		? args.records.flatMap((record) =>
				typeof record.fields.userId === "string" ? [record.fields.userId] : []
			)
		: [];
	const usersById = shouldHydrateBorrowerName
		? await loadUsersById(args.ctx, userIds)
		: new Map<string, UserDoc>();

	return args.records.map((record) => {
		const userId =
			typeof record.fields.userId === "string"
				? record.fields.userId
				: undefined;

		return mergeHydratedFields(record, {
			...(shouldHydrateBorrowerName
				? {
						borrowerName: buildUserDisplayName(
							userId ? usersById.get(userId) : undefined
						),
					}
				: {}),
		});
	});
}

async function hydrateLenderRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const lenderDocsByRecordId = await loadLenderDocsByRecordIds(
		args.ctx,
		args.records.map((record) => record._id)
	);

	const mergedRecords = args.records.map((record) => {
		const doc = lenderDocsByRecordId.get(record._id);
		if (!doc) {
			return record;
		}

		return mergeHydratedFields(record, {
			userId: String(doc.userId),
			brokerId: String(doc.brokerId),
			orgId: doc.orgId,
		});
	});

	const userIds = mergedRecords.flatMap((record) =>
		typeof record.fields.userId === "string" ? [record.fields.userId] : []
	);
	const brokerIds = mergedRecords.flatMap((record) =>
		typeof record.fields.brokerId === "string" ? [record.fields.brokerId] : []
	);
	const orgIds = mergedRecords.flatMap((record) =>
		typeof record.fields.orgId === "string" ? [record.fields.orgId] : []
	);

	const [usersById, brokersById, organizationsByWorkosId] = await Promise.all([
		loadUsersById(args.ctx, userIds),
		loadBrokersById({
			ctx: args.ctx,
			orgId: args.orgId,
			recordIds: brokerIds,
		}),
		loadOrganizationsByWorkosIds(args.ctx, orgIds),
	]);

	return mergedRecords.map((record) => {
		const userId =
			typeof record.fields.userId === "string"
				? record.fields.userId
				: undefined;
		const brokerId =
			typeof record.fields.brokerId === "string"
				? record.fields.brokerId
				: undefined;
		const orgId =
			typeof record.fields.orgId === "string" ? record.fields.orgId : undefined;

		const user = userId ? usersById.get(userId) : undefined;
		const broker = brokerId ? brokersById.get(brokerId) : undefined;
		const organization = orgId ? organizationsByWorkosId.get(orgId) : undefined;

		return mergeHydratedFields(record, {
			lenderName: buildUserDisplayName(user),
			contactEmail: user?.email,
			contactPhone: user?.phoneNumber,
			brokerSummary: buildBrokerRollupSummary(broker),
			organizationName: organization?.name,
		});
	});
}

async function hydrateBrokerRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	const brokerDocsByRecordId = await loadBrokerDocsByRecordIds(
		args.ctx,
		args.records.map((record) => record._id)
	);

	const mergedRecords = args.records.map((record) => {
		const doc = brokerDocsByRecordId.get(record._id);
		if (!doc) {
			return record;
		}

		return mergeHydratedFields(record, {
			userId: String(doc.userId),
			orgId: doc.orgId,
		});
	});

	const userIds = mergedRecords.flatMap((record) =>
		typeof record.fields.userId === "string" ? [record.fields.userId] : []
	);
	const orgIds = mergedRecords.flatMap((record) =>
		typeof record.fields.orgId === "string" ? [record.fields.orgId] : []
	);

	const [usersById, organizationsByWorkosId] = await Promise.all([
		loadUsersById(args.ctx, userIds),
		loadOrganizationsByWorkosIds(args.ctx, orgIds),
	]);

	return mergedRecords.map((record) => {
		const userId =
			typeof record.fields.userId === "string"
				? record.fields.userId
				: undefined;
		const orgId =
			typeof record.fields.orgId === "string" ? record.fields.orgId : undefined;

		const user = userId ? usersById.get(userId) : undefined;
		const organization = orgId ? organizationsByWorkosId.get(orgId) : undefined;

		return mergeHydratedFields(record, {
			brokerContactName: buildUserDisplayName(user),
			contactEmail: user?.email,
			contactPhone: user?.phoneNumber,
			organizationName: organization?.name,
		});
	});
}

async function hydrateRecordsForEntity(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	switch (args.adapterContract.entityType) {
		case "listings":
			return hydrateListingRecords(args);
		case "mortgages":
			return hydrateMortgageRecords(args);
		case "obligations":
			return hydrateObligationRecords(args);
		case "deals":
			return hydrateDealRecords(args);
		case "borrowers":
			return hydrateBorrowerRecords(args);
		case "lenders":
			return hydrateLenderRecords(args);
		case "brokers":
			return hydrateBrokerRecords(args);
		default:
			return [...args.records];
	}
}

export async function materializeEntityViewRecords(
	args: EntityViewHydrationArgs
): Promise<UnifiedRecord[]> {
	if (args.records.length === 0) {
		return [];
	}

	const hydratedRecords = await hydrateRecordsForEntity(args);
	return hydratedRecords.map((record) => ({
		...record,
		fields: applyComputedFieldValues({
			adapterContract: args.adapterContract,
			fieldValues: record.fields,
		}),
	}));
}
