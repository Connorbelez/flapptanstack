import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, authedMutation } from "../fluent";
import { unixMsToBusinessDate } from "../lib/businessDates";
import { addBusinessDays } from "../lib/businessDays";
import {
	platformLawyerAvailabilityExceptionKindValidator,
	platformLawyerAvailabilityWindowStatusValidator,
} from "./validators";

type AvailabilityQueryCtx = Pick<QueryCtx, "db">;
type AvailabilityMutationCtx = Pick<MutationCtx, "db">;

const MINUTES_PER_DAY = 24 * 60;
const DEFAULT_PROJECTION_DAYS = 5;

export interface PlatformLawyerAvailabilityDay {
	readonly businessDate: string;
	readonly hasAvailability: boolean;
	readonly isOnHold: boolean;
	readonly label: string;
	readonly windows: readonly string[];
}

function assertMinuteRange(startMinute: number, endMinute: number): void {
	if (
		!(Number.isInteger(startMinute) && Number.isInteger(endMinute)) ||
		startMinute < 0 ||
		endMinute > MINUTES_PER_DAY ||
		startMinute >= endMinute
	) {
		throw new ConvexError(
			"Availability windows must use valid minute offsets within a day"
		);
	}
}

function assertDayOfWeek(dayOfWeek: number): void {
	if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 5) {
		throw new ConvexError("Availability dayOfWeek must be Monday-Friday");
	}
}

function dayOfWeekForBusinessDate(date: string): number {
	const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
	return day === 0 ? 7 : day;
}

function formatWindow(startMinute: number, endMinute: number): string {
	const format = (minute: number) => {
		const hours = Math.floor(minute / 60);
		const minutes = minute % 60;
		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
	};
	return `${format(startMinute)}-${format(endMinute)}`;
}

function summarizeDay(
	businessDate: string,
	windows: Array<{ endMinute: number; startMinute: number }>,
	isOnHold: boolean
): PlatformLawyerAvailabilityDay {
	const formatted = windows.map((window) =>
		formatWindow(window.startMinute, window.endMinute)
	);
	let label = `${businessDate}: unavailable`;
	if (isOnHold) {
		label = `${businessDate}: on hold`;
	} else if (formatted.length > 0) {
		label = `${businessDate}: ${formatted.join(", ")}`;
	}
	return {
		businessDate,
		hasAvailability: formatted.length > 0 && !isOnHold,
		isOnHold,
		label,
		windows: formatted,
	};
}

export async function projectPlatformLawyerAvailability(
	ctx: AvailabilityQueryCtx,
	args: {
		readonly days?: number;
		readonly lawyerProfileId: Id<"lawyerProfiles">;
		readonly now?: number;
	}
): Promise<PlatformLawyerAvailabilityDay[]> {
	const days = args.days ?? DEFAULT_PROJECTION_DAYS;
	if (!Number.isInteger(days) || days < 1 || days > 10) {
		throw new ConvexError(
			"Availability projection days must be between 1 and 10"
		);
	}
	const startDate = unixMsToBusinessDate(args.now ?? Date.now());
	const projectedDates = Array.from({ length: days }, (_, index) =>
		addBusinessDays(startDate, index)
	);
	const windows = await ctx.db
		.query("platformLawyerAvailabilityWindows")
		.withIndex("by_lawyer", (q) =>
			q.eq("lawyerProfileId", args.lawyerProfileId)
		)
		.collect();

	return await Promise.all(
		projectedDates.map(async (businessDate) => {
			const exceptions = await ctx.db
				.query("platformLawyerAvailabilityExceptions")
				.withIndex("by_lawyer_date", (q) =>
					q
						.eq("lawyerProfileId", args.lawyerProfileId)
						.eq("businessDate", businessDate)
				)
				.collect();
			const hold = exceptions.some((exception) => exception.kind === "hold");
			const unavailable = exceptions.some(
				(exception) => exception.kind === "unavailable"
			);
			const explicitAvailable = exceptions
				.filter((exception) => exception.kind === "available")
				.flatMap((exception) =>
					exception.startMinute !== undefined &&
					exception.endMinute !== undefined
						? [
								{
									startMinute: exception.startMinute,
									endMinute: exception.endMinute,
								},
							]
						: []
				);
			const recurring = windows
				.filter(
					(window) =>
						window.status === "active" &&
						window.dayOfWeek === dayOfWeekForBusinessDate(businessDate)
				)
				.map((window) => ({
					startMinute: window.startMinute,
					endMinute: window.endMinute,
				}));
			let dayWindows = recurring;
			if (hold || unavailable) {
				dayWindows = [];
			} else if (explicitAvailable.length > 0) {
				dayWindows = explicitAvailable;
			}
			return summarizeDay(businessDate, dayWindows, hold);
		})
	);
}

async function assertProfileCanManageAvailability(
	ctx: AvailabilityMutationCtx,
	args: {
		readonly actorAuthId: string;
		readonly isAdmin: boolean;
		readonly lawyerProfileId: Id<"lawyerProfiles">;
	}
): Promise<Doc<"lawyerProfiles">> {
	const profile = await ctx.db.get(args.lawyerProfileId);
	if (!profile) {
		throw new ConvexError("Lawyer profile not found");
	}
	if (!(args.isAdmin || profile.authId === args.actorAuthId)) {
		throw new ConvexError("Forbidden: cannot manage this lawyer availability");
	}
	return profile;
}

export const upsertWeeklyAvailabilityWindow = authedMutation
	.input({
		lawyerProfileId: v.id("lawyerProfiles"),
		windowId: v.optional(v.id("platformLawyerAvailabilityWindows")),
		dayOfWeek: v.number(),
		startMinute: v.number(),
		endMinute: v.number(),
		timezone: v.string(),
		status: platformLawyerAvailabilityWindowStatusValidator,
	})
	.handler(async (ctx, args) => {
		assertDayOfWeek(args.dayOfWeek);
		assertMinuteRange(args.startMinute, args.endMinute);
		await assertProfileCanManageAvailability(ctx, {
			actorAuthId: ctx.viewer.authId,
			isAdmin: ctx.viewer.isFairLendAdmin,
			lawyerProfileId: args.lawyerProfileId,
		});
		const now = Date.now();
		if (args.windowId) {
			await ctx.db.patch(args.windowId, {
				dayOfWeek: args.dayOfWeek,
				startMinute: args.startMinute,
				endMinute: args.endMinute,
				timezone: args.timezone,
				status: args.status,
				updatedAt: now,
				updatedBy: ctx.viewer.authId,
			});
			return args.windowId;
		}
		return await ctx.db.insert("platformLawyerAvailabilityWindows", {
			lawyerProfileId: args.lawyerProfileId,
			dayOfWeek: args.dayOfWeek,
			startMinute: args.startMinute,
			endMinute: args.endMinute,
			timezone: args.timezone,
			status: args.status,
			createdAt: now,
			createdBy: ctx.viewer.authId,
			updatedAt: now,
			updatedBy: ctx.viewer.authId,
		});
	})
	.public();

export const upsertAvailabilityException = authedMutation
	.input({
		lawyerProfileId: v.id("lawyerProfiles"),
		exceptionId: v.optional(v.id("platformLawyerAvailabilityExceptions")),
		businessDate: v.string(),
		kind: platformLawyerAvailabilityExceptionKindValidator,
		startMinute: v.optional(v.number()),
		endMinute: v.optional(v.number()),
		reason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		if (args.startMinute !== undefined && args.endMinute !== undefined) {
			assertMinuteRange(args.startMinute, args.endMinute);
		}
		await assertProfileCanManageAvailability(ctx, {
			actorAuthId: ctx.viewer.authId,
			isAdmin: ctx.viewer.isFairLendAdmin,
			lawyerProfileId: args.lawyerProfileId,
		});
		const now = Date.now();
		if (args.exceptionId) {
			await ctx.db.patch(args.exceptionId, {
				businessDate: args.businessDate,
				kind: args.kind,
				startMinute: args.startMinute,
				endMinute: args.endMinute,
				reason: args.reason,
				updatedAt: now,
				updatedBy: ctx.viewer.authId,
			});
			return args.exceptionId;
		}
		return await ctx.db.insert("platformLawyerAvailabilityExceptions", {
			lawyerProfileId: args.lawyerProfileId,
			businessDate: args.businessDate,
			kind: args.kind,
			startMinute: args.startMinute,
			endMinute: args.endMinute,
			reason: args.reason,
			createdAt: now,
			createdBy: ctx.viewer.authId,
			updatedAt: now,
			updatedBy: ctx.viewer.authId,
		});
	})
	.public();

export const adminPlacePlatformLawyerOnHold = adminMutation
	.input({
		lawyerProfileId: v.id("lawyerProfiles"),
		businessDate: v.string(),
		reason: v.optional(v.string()),
	})
	.handler(async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("platformLawyerAvailabilityExceptions", {
			lawyerProfileId: args.lawyerProfileId,
			businessDate: args.businessDate,
			kind: "hold",
			reason: args.reason,
			createdAt: now,
			createdBy: ctx.viewer.authId,
			updatedAt: now,
			updatedBy: ctx.viewer.authId,
		});
	})
	.public();
