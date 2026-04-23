import { makeFunctionReference } from "convex/server";
import { v } from "convex/values";
import { adminAction, requirePermissionAction } from "../../fluent";
import type { FsraSourceRecord } from "./fsraFixtures";
import { fsraSourceRecordValidator } from "./validators";

const onboardingManageAction = adminAction.use(
	requirePermissionAction("onboarding:manage")
);

const runFsraImportRefreshRef = makeFunctionReference<
	"action",
	{ records?: FsraSourceRecord[]; trigger: "cron" | "manual" },
	Promise<{
		createdCount: number;
		failedCount: number;
		recordCount: number;
		runId: string;
		status: "failed" | "success";
		updatedCount: number;
	}>
>("onboarding/verification/fsraImport:runFsraImportRefresh");

export const refreshFsraImportedDataNow = onboardingManageAction
	.input({
		records: v.optional(v.array(fsraSourceRecordValidator)),
	})
	.handler((ctx, args) =>
		ctx.runAction(runFsraImportRefreshRef, {
			records: args.records,
			trigger: "manual",
		})
	)
	.public();
