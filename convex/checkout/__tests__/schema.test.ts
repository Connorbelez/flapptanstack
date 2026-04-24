import { describe, expect, it } from "vitest";
import schema from "../../schema";

interface SchemaIndexDescriptor {
	readonly fields: readonly string[];
	readonly indexDescriptor: string;
}

interface FieldValidatorDescriptor {
	readonly isOptional: "required" | "optional";
	readonly kind: string;
	readonly tableName?: string;
	readonly value?: unknown;
}

interface ObjectValidatorDescriptor {
	readonly fields: Record<string, FieldValidatorDescriptor>;
	readonly kind: "object";
}

interface TableDescriptor {
	readonly indexes: readonly SchemaIndexDescriptor[];
	readonly validator: ObjectValidatorDescriptor;
}

interface SchemaDescriptor {
	readonly tables: Record<string, TableDescriptor | undefined>;
}

function getCheckoutSessionsTable(): TableDescriptor {
	const table = (schema as unknown as SchemaDescriptor).tables.checkoutSessions;
	if (!table) {
		throw new Error("checkoutSessions table is missing from schema");
	}
	return table;
}

describe("checkoutSessions schema contract", () => {
	it("defines the required indexes", () => {
		const indexes = getCheckoutSessionsTable().indexes.map((index) => ({
			fields: index.fields,
			name: index.indexDescriptor,
		}));

		expect(indexes).toEqual([
			{ name: "by_listing_status", fields: ["listingId", "status"] },
			{ name: "by_lender", fields: ["lenderId", "startedAt"] },
			{ name: "by_reservation", fields: ["reservationId"] },
			{
				name: "by_stripe_checkout_session",
				fields: ["stripeCheckoutSessionId"],
			},
			{ name: "by_status_expires_at", fields: ["status", "expiresAt"] },
			{ name: "by_idempotency", fields: ["idempotencyKey"] },
		]);
	});

	it("defines required foreign-key fields against canonical tables", () => {
		const fields = getCheckoutSessionsTable().validator.fields;

		expect(fields.listingId).toMatchObject({
			isOptional: "required",
			kind: "id",
			tableName: "listings",
		});
		expect(fields.mortgageId).toMatchObject({
			isOptional: "required",
			kind: "id",
			tableName: "mortgages",
		});
		expect(fields.portalId).toMatchObject({
			isOptional: "required",
			kind: "id",
			tableName: "portals",
		});
		expect(fields.lenderId).toMatchObject({
			isOptional: "required",
			kind: "id",
			tableName: "lenders",
		});
		expect(fields.reservationId).toMatchObject({
			isOptional: "required",
			kind: "id",
			tableName: "ledger_reservations",
		});
		expect(fields.lockFeeTransferRequestId).toMatchObject({
			isOptional: "optional",
			kind: "id",
			tableName: "transferRequests",
		});
		expect(fields.dealId).toMatchObject({
			isOptional: "optional",
			kind: "id",
			tableName: "deals",
		});
	});

	it("keeps lock fee amount and currency server-owned literals", () => {
		const fields = getCheckoutSessionsTable().validator.fields;

		expect(fields.lockFeeAmount).toMatchObject({
			isOptional: "required",
			kind: "literal",
			value: 25_000,
		});
		expect(fields.lockFeeCurrency).toMatchObject({
			isOptional: "required",
			kind: "literal",
			value: "CAD",
		});
	});

	it("does not introduce listing-side availability counters", () => {
		const fields = getCheckoutSessionsTable().validator.fields;

		expect(fields.availableFractions).toBeUndefined();
		expect(fields.lockedFractions).toBeUndefined();
		expect(fields.fractionLocks).toBeUndefined();
	});
});
