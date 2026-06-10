import { Migrations } from "@convex-dev/migrations";
import { components, internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { adminMutation, adminQuery } from "../fluent";

const migrations = new Migrations<DataModel>(components.migrations);

const migrationRefs = internal as unknown as {
	deals: {
		migrations: {
			clearLegacyDealAccessProjectionFields: never;
			normalizeLegacyDealPaymentProofSubmitterRoles: never;
		};
	};
};

function isLawyerAccessRole(role: DataModel["dealAccess"]["document"]["role"]) {
	return role === "platform_lawyer" || role === "guest_lawyer";
}

export const clearLegacyDealAccessProjectionFields = migrations.define({
	table: "dealAccess",
	migrateOne: async (ctx, access) => {
		if (access.persona === undefined && access.lawyerSource === undefined) {
			return;
		}

		await ctx.db.patch(access._id, {
			lawyerSource: undefined,
			persona: undefined,
		});
	},
});

export const runClearLegacyDealAccessProjectionFields = adminMutation
	.input({})
	.handler(async (ctx) => {
		await migrations.runOne(
			ctx,
			migrationRefs.deals.migrations.clearLegacyDealAccessProjectionFields
		);
	})
	.public();

export const getLegacyDealAccessProjectionFieldStatus = adminQuery
	.input({})
	.handler(async (ctx) => {
		const accessRows = await ctx.db.query("dealAccess").collect();
		const rowsWithLegacyProjectionFields = accessRows.filter(
			(access) =>
				access.persona !== undefined || access.lawyerSource !== undefined
		);

		return {
			dealAccessCount: accessRows.length,
			legacyProjectionFieldCount: rowsWithLegacyProjectionFields.length,
			legacyProjectionFieldIds: rowsWithLegacyProjectionFields.map(
				(access) => access._id
			) as Id<"dealAccess">[],
		};
	})
	.public();

export const normalizeLegacyDealPaymentProofSubmitterRoles = migrations.define({
	table: "dealPaymentProofs",
	migrateOne: async (ctx, proof) => {
		if (
			proof.submittedByRole !== "primary_lawyer" &&
			proof.submittedByPersona === undefined
		) {
			return;
		}

		if (proof.submittedByRole !== "primary_lawyer") {
			await ctx.db.patch(proof._id, { submittedByPersona: undefined });
			return;
		}

		const accessRows = await ctx.db
			.query("dealAccess")
			.withIndex("by_user_and_deal", (query) =>
				query.eq("userId", proof.submittedBy).eq("dealId", proof.dealId)
			)
			.collect();
		const accessRole = accessRows
			.filter((access) => access.status === "active")
			.map((access) => access.role)
			.find(isLawyerAccessRole);

		await ctx.db.patch(proof._id, {
			submittedByPersona: undefined,
			submittedByRole: accessRole ?? "guest_lawyer",
		});
	},
});

export const runNormalizeLegacyDealPaymentProofSubmitterRoles = adminMutation
	.input({})
	.handler(async (ctx) => {
		await migrations.runOne(
			ctx,
			migrationRefs.deals.migrations
				.normalizeLegacyDealPaymentProofSubmitterRoles
		);
	})
	.public();

export const getLegacyDealPaymentProofSubmitterRoleStatus = adminQuery
	.input({})
	.handler(async (ctx) => {
		const proofs = await ctx.db.query("dealPaymentProofs").collect();
		const legacyProofs = proofs.filter(
			(proof) =>
				proof.submittedByRole === "primary_lawyer" ||
				proof.submittedByPersona !== undefined
		);

		return {
			dealPaymentProofCount: proofs.length,
			legacySubmitterRoleCount: legacyProofs.length,
			legacySubmitterRoleIds: legacyProofs.map(
				(proof) => proof._id
			) as Id<"dealPaymentProofs">[],
		};
	})
	.public();
