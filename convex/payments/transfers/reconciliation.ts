/**
 * Legacy transfer reconciliation entry point.
 *
 * The production-safe implementation lives in
 * `convex/payments/cashLedger/transferReconciliationCron.ts`.
 * Keep this export as a thin delegate so older callers do not retain the
 * query-level multi-pagination anti-pattern.
 */

import { internal } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import type { TransferHealingResult } from "../cashLedger/transferHealingTypes";

const ORPHAN_THRESHOLD_MS = 5 * 60 * 1000;

/** Returns true if the transfer is too fresh to be considered orphaned. */
export function isFreshTransfer(
	transfer: { settledAt?: number; createdAt: number },
	threshold: number = Date.now() - ORPHAN_THRESHOLD_MS
): boolean {
	if (transfer.settledAt && transfer.settledAt > threshold) {
		return true;
	}
	return transfer.createdAt > threshold;
}

export const transferReconciliationCron = internalAction({
	handler: async (ctx): Promise<TransferHealingResult> => {
		return ctx.runAction(
			internal.payments.cashLedger.transferReconciliationCron
				.transferReconciliationCron,
			{}
		);
	},
});
