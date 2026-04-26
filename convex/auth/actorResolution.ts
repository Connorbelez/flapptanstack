import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

interface ActorReaderCtx {
	db: QueryCtx["db"];
}

export async function getUserByAuthId(
	ctx: ActorReaderCtx,
	authId: string
): Promise<Doc<"users"> | null> {
	return ctx.db
		.query("users")
		.withIndex("authId", (query) => query.eq("authId", authId))
		.unique();
}

export async function getBrokerByAuthId(
	ctx: ActorReaderCtx,
	authId: string
): Promise<Doc<"brokers"> | null> {
	const user = await getUserByAuthId(ctx, authId);
	if (!user) {
		return null;
	}

	return ctx.db
		.query("brokers")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
}

export async function getBorrowerByAuthId(
	ctx: ActorReaderCtx,
	authId: string
): Promise<Doc<"borrowers"> | null> {
	const user = await getUserByAuthId(ctx, authId);
	if (!user) {
		return null;
	}

	return ctx.db
		.query("borrowers")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
}

export async function getLenderByAuthId(
	ctx: ActorReaderCtx,
	authId: string
): Promise<Doc<"lenders"> | null> {
	const user = await getUserByAuthId(ctx, authId);
	if (!user) {
		return null;
	}

	return ctx.db
		.query("lenders")
		.withIndex("by_user", (query) => query.eq("userId", user._id))
		.first();
}

export async function resolveViewerActors(ctx: ActorReaderCtx, authId: string) {
	const user = await getUserByAuthId(ctx, authId);
	if (!user) {
		return {
			user: null,
			broker: null,
			borrower: null,
			lender: null,
		};
	}

	const [broker, borrower, lender] = await Promise.all([
		ctx.db
			.query("brokers")
			.withIndex("by_user", (query) => query.eq("userId", user._id))
			.first(),
		ctx.db
			.query("borrowers")
			.withIndex("by_user", (query) => query.eq("userId", user._id))
			.first(),
		ctx.db
			.query("lenders")
			.withIndex("by_user", (query) => query.eq("userId", user._id))
			.first(),
	]);

	return {
		user,
		broker,
		borrower,
		lender,
	};
}
