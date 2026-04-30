import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type UserDoc = Doc<"users">;
type UserReaderCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;
type UserWriterCtx = Pick<MutationCtx, "db">;

interface UserReferenceSummary {
	readonly borrowerCount: number;
	readonly brokerCount: number;
	readonly lenderCount: number;
	readonly total: number;
}

interface RankedUser {
	readonly references: UserReferenceSummary;
	readonly user: UserDoc;
}

function normalizeEmail(value: string) {
	return value.trim().toLowerCase();
}

async function loadUserReferenceSummary(
	ctx: UserReaderCtx,
	userId: Id<"users">
): Promise<UserReferenceSummary> {
	const [borrowers, brokers, lenders] = await Promise.all([
		ctx.db
			.query("borrowers")
			.withIndex("by_user", (query) => query.eq("userId", userId))
			.collect(),
		ctx.db
			.query("brokers")
			.withIndex("by_user", (query) => query.eq("userId", userId))
			.collect(),
		ctx.db
			.query("lenders")
			.withIndex("by_user", (query) => query.eq("userId", userId))
			.collect(),
	]);
	return {
		borrowerCount: borrowers.length,
		brokerCount: brokers.length,
		lenderCount: lenders.length,
		total: borrowers.length + brokers.length + lenders.length,
	};
}

function compareRankedUsers(left: RankedUser, right: RankedUser) {
	if (left.references.total !== right.references.total) {
		return right.references.total - left.references.total;
	}
	if (Boolean(left.user.homePortalId) !== Boolean(right.user.homePortalId)) {
		return left.user.homePortalId ? -1 : 1;
	}
	if (Boolean(left.user.phoneNumber) !== Boolean(right.user.phoneNumber)) {
		return left.user.phoneNumber ? -1 : 1;
	}
	if (left.user._creationTime !== right.user._creationTime) {
		return left.user._creationTime - right.user._creationTime;
	}
	return String(left.user._id).localeCompare(String(right.user._id));
}

async function rankUsersByAuthId(ctx: UserReaderCtx, authId: string) {
	const users = await ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.collect();

	const rankedUsers = await Promise.all(
		users.map(async (user) => ({
			references: await loadUserReferenceSummary(ctx, user._id),
			user,
		}))
	);
	rankedUsers.sort(compareRankedUsers);
	return rankedUsers;
}

function buildUserInsert(args: {
	email: string;
	firstName?: string;
	lastName?: string;
	phoneNumber?: string;
}) {
	const normalizedEmail = normalizeEmail(args.email);
	return {
		email: normalizedEmail,
		normalizedEmail,
		firstName: args.firstName ?? "",
		lastName: args.lastName ?? "",
		...(args.phoneNumber !== undefined
			? { phoneNumber: args.phoneNumber }
			: {}),
	};
}

function buildUserPatch(args: {
	email: string;
	firstName?: string;
	lastName?: string;
	phoneNumber?: string;
}) {
	const normalizedEmail = normalizeEmail(args.email);
	const patch: {
		email: string;
		firstName?: string;
		lastName?: string;
		normalizedEmail: string;
		phoneNumber?: string;
	} = {
		email: normalizedEmail,
		normalizedEmail,
	};
	if (args.firstName !== undefined) {
		patch.firstName = args.firstName;
	}
	if (args.lastName !== undefined) {
		patch.lastName = args.lastName;
	}
	if (args.phoneNumber !== undefined) {
		patch.phoneNumber = args.phoneNumber;
	}
	return patch;
}

export async function findCanonicalUserByAuthId(
	ctx: UserReaderCtx,
	authId: string
): Promise<{
	readonly canonicalUser: UserDoc | null;
	readonly duplicateUsers: readonly UserDoc[];
}> {
	const rankedUsers = await rankUsersByAuthId(ctx, authId);
	return {
		canonicalUser: rankedUsers[0]?.user ?? null,
		duplicateUsers: rankedUsers.slice(1).map((entry) => entry.user),
	};
}

export async function deleteOrphanUsersByAuthId(
	ctx: UserWriterCtx,
	args: {
		authId: string;
		keepUserId?: Id<"users">;
	}
): Promise<{
	readonly blockedUserIds: readonly Id<"users">[];
	readonly deletedUserIds: readonly Id<"users">[];
}> {
	const rankedUsers = await rankUsersByAuthId(ctx, args.authId);
	const blockedUserIds: Id<"users">[] = [];
	const deletedUserIds: Id<"users">[] = [];

	for (const rankedUser of rankedUsers) {
		if (rankedUser.user._id === args.keepUserId) {
			continue;
		}
		if (rankedUser.references.total > 0) {
			blockedUserIds.push(rankedUser.user._id);
			continue;
		}
		// Deletion disabled until loadUserReferenceSummary checks all tables
		// that may reference users (audit, admin, documents, etc.).
		blockedUserIds.push(rankedUser.user._id);
	}

	return {
		blockedUserIds,
		deletedUserIds,
	};
}

export async function upsertUserByAuthId(
	ctx: UserWriterCtx,
	args: {
		authId: string;
		email: string;
		firstName?: string;
		lastName?: string;
		phoneNumber?: string;
	}
): Promise<{
	readonly canonicalUser: UserDoc;
	readonly deletedDuplicateUserIds: readonly Id<"users">[];
	readonly survivingDuplicateUserIds: readonly Id<"users">[];
	readonly wasCreated: boolean;
}> {
	const { canonicalUser, duplicateUsers } = await findCanonicalUserByAuthId(
		ctx,
		args.authId
	);

	if (!canonicalUser) {
		const userId = await ctx.db.insert("users", {
			authId: args.authId,
			...buildUserInsert(args),
		});
		const createdUser = await ctx.db.get(userId);
		if (!createdUser) {
			throw new Error(`User insert disappeared for authId ${args.authId}`);
		}
		return {
			canonicalUser: createdUser,
			deletedDuplicateUserIds: [],
			survivingDuplicateUserIds: [],
			wasCreated: true,
		};
	}

	await ctx.db.patch(canonicalUser._id, buildUserPatch(args));

	const deletedDuplicateUserIds: Id<"users">[] = [];
	const survivingDuplicateUserIds: Id<"users">[] = [];
	for (const duplicateUser of duplicateUsers) {
		// Deletion disabled until loadUserReferenceSummary checks all tables
		// that may reference users (audit, admin, documents, etc.).
		survivingDuplicateUserIds.push(duplicateUser._id);
	}

	const updatedUser = await ctx.db.get(canonicalUser._id);
	if (!updatedUser) {
		throw new Error(`Canonical user disappeared for authId ${args.authId}`);
	}

	return {
		canonicalUser: updatedUser,
		deletedDuplicateUserIds,
		survivingDuplicateUserIds,
		wasCreated: false,
	};
}
