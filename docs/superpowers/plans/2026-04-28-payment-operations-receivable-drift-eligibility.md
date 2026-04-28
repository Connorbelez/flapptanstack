# Payment Operations Receivable Drift Eligibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize when obligations are receivable-drift eligible so future `upcoming` obligations from admin seeding no longer show false `journal drift` badges.

**Architecture:** Add a small shared backend helper in the payment obligation domain that defines the canonical receivable-accrual eligibility rule. Use that helper from the payment operations dashboard query and the orphaned-obligation reconciliation check so both surfaces share the same lifecycle boundary.

**Tech Stack:** Convex, TypeScript, Vitest, convex-test, Bun, Biome, GitNexus, Graphite.

---

## File Structure

- Create: `convex/payments/obligations/accrualEligibility.ts`
  - Owns the canonical `BORROWER_RECEIVABLE` accrual-required status list and predicates.
  - Keeps unknown string statuses non-eligible until explicitly added.

- Create: `convex/payments/obligations/__tests__/accrualEligibility.test.ts`
  - Unit tests for every current lifecycle status in the helper.
  - Documents expected behavior for unknown statuses.

- Modify: `convex/payments/adminDashboard/queries.ts`
  - Imports `obligationIsReceivableDriftEligible`.
  - Gates `hasJournalDrift` behind the shared eligibility predicate.

- Modify: `convex/payments/adminDashboard/__tests__/queries.test.ts`
  - Adds dashboard-level regression tests for upcoming false positives and due matching/mismatching receivables.

- Modify: `convex/payments/cashLedger/reconciliationSuite.ts`
  - Imports `OBLIGATION_STATUSES_REQUIRING_ACCRUAL`.
  - Removes the private status list for orphaned-obligation checks.

- Modify: `convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts`
  - Adds coverage proving `checkOrphanedObligations` still excludes `upcoming`.

- Modify: `docs/superpowers/specs/2026-04-28-payment-operations-receivable-drift-eligibility-design.md`
  - Only if implementation discovers a necessary clarification. The current design is already approved.

---

## Task 1: Add Shared Accrual Eligibility Helper

**Files:**
- Create: `convex/payments/obligations/accrualEligibility.ts`
- Create: `convex/payments/obligations/__tests__/accrualEligibility.test.ts`

- [ ] **Step 1: Run GitNexus impact before editing new obligation-domain surface**

Run:

```bash
npx gitnexus impact --repo nt1n obligationRequiresReceivableAccrual
```

Expected: GitNexus may report no existing symbol because this is a new helper. Record that in the implementation notes and proceed.

- [ ] **Step 2: Write the failing helper test**

Create `convex/payments/obligations/__tests__/accrualEligibility.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
	OBLIGATION_STATUSES_REQUIRING_ACCRUAL,
	obligationIsReceivableDriftEligible,
	obligationRequiresReceivableAccrual,
} from "../accrualEligibility";

describe("obligation receivable accrual eligibility", () => {
	it.each([
		["upcoming", false],
		["due", true],
		["overdue", true],
		["partially_settled", true],
		["settled", true],
		["waived", true],
		["cancelled", false],
		["unknown_future_status", false],
	] as const)(
		"returns %s accrual eligibility as %s",
		(status, expected) => {
			expect(obligationRequiresReceivableAccrual(status)).toBe(expected);
			expect(
				obligationIsReceivableDriftEligible({
					status,
				})
			).toBe(expected);
		}
	);

	it("exports the canonical accrual-required status set", () => {
		expect([...OBLIGATION_STATUSES_REQUIRING_ACCRUAL]).toEqual([
			"due",
			"overdue",
			"partially_settled",
			"settled",
			"waived",
		]);
	});
});
```

- [ ] **Step 3: Run the helper test to verify it fails**

Run:

```bash
bun run test -- convex/payments/obligations/__tests__/accrualEligibility.test.ts
```

Expected: FAIL because `../accrualEligibility` does not exist.

- [ ] **Step 4: Implement the shared helper**

Create `convex/payments/obligations/accrualEligibility.ts` with:

```ts
import type { Doc } from "../../_generated/dataModel";

export const OBLIGATION_STATUSES_REQUIRING_ACCRUAL = [
	"due",
	"overdue",
	"partially_settled",
	"settled",
	"waived",
] as const;

export type ObligationStatusRequiringAccrual =
	(typeof OBLIGATION_STATUSES_REQUIRING_ACCRUAL)[number];

const OBLIGATION_STATUSES_REQUIRING_ACCRUAL_SET: ReadonlySet<string> = new Set(
	OBLIGATION_STATUSES_REQUIRING_ACCRUAL
);

/**
 * BORROWER_RECEIVABLE is expected only after obligation accrual.
 * Future upcoming obligations are scheduled but not accrued, so a missing
 * receivable balance is not drift.
 */
export function obligationRequiresReceivableAccrual(
	status: string
): status is ObligationStatusRequiringAccrual {
	return OBLIGATION_STATUSES_REQUIRING_ACCRUAL_SET.has(status);
}

export function obligationIsReceivableDriftEligible(
	obligation: Pick<Doc<"obligations">, "status">
) {
	return obligationRequiresReceivableAccrual(obligation.status);
}
```

- [ ] **Step 5: Run the helper test to verify it passes**

Run:

```bash
bun run test -- convex/payments/obligations/__tests__/accrualEligibility.test.ts
```

Expected: PASS.

---

## Task 2: Fix Payment Operations Journal Drift Eligibility

**Files:**
- Modify: `convex/payments/adminDashboard/queries.ts`
- Modify: `convex/payments/adminDashboard/__tests__/queries.test.ts`

- [ ] **Step 1: Run GitNexus impact before modifying `buildObligationRows`**

Run:

```bash
npx gitnexus impact --repo nt1n buildObligationRows
```

Expected: Review the direct callers and affected process list. If GitNexus reports HIGH or CRITICAL risk, pause and tell the user before editing. Otherwise continue.

- [ ] **Step 2: Add failing dashboard regression tests**

In `convex/payments/adminDashboard/__tests__/queries.test.ts`, add these tests after the existing `"marks journal drift and missing transfer ledger links in the payment operations snapshot"` test:

```ts
	it("does not mark upcoming obligations without receivable accounts as journal drift", async () => {
		const t = createBackendTestConvex();
		const borrowerId = await seedBorrowerProfile(t);
		const mortgageId = await seedMortgage(t);
		const obligationId = await seedObligation(t, mortgageId, borrowerId, {
			status: "upcoming",
		});

		const snapshot = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.adminDashboard.queries
					.getPaymentOperationsDashboardSnapshot,
				{}
			);

		const obligationRow = snapshot.obligations.find(
			(row) => row.obligationId === String(obligationId)
		);
		expect(obligationRow?.status).toBe("upcoming");
		expect(obligationRow?.projectedOutstandingBalance).toBe(300_000);
		expect(obligationRow?.journalOutstandingBalance).toBe(0);
		expect(obligationRow?.hasJournalDrift).toBe(false);
	});

	it("does not mark due obligations as journal drift when receivable balance matches projected outstanding", async () => {
		const t = createBackendTestConvex();
		const borrowerId = await seedBorrowerProfile(t);
		const mortgageId = await seedMortgage(t);
		const obligationId = await seedObligation(t, mortgageId, borrowerId, {
			status: "due",
		});
		await ensureBorrowerReceivableAccount(t, {
			initialDebitBalance: 300_000n,
			obligationId,
		});

		const snapshot = await t
			.withIdentity(FAIRLEND_ADMIN)
			.query(
				api.payments.adminDashboard.queries
					.getPaymentOperationsDashboardSnapshot,
				{}
			);

		const obligationRow = snapshot.obligations.find(
			(row) => row.obligationId === String(obligationId)
		);
		expect(obligationRow?.status).toBe("due");
		expect(obligationRow?.projectedOutstandingBalance).toBe(300_000);
		expect(obligationRow?.journalOutstandingBalance).toBe(300_000);
		expect(obligationRow?.hasJournalDrift).toBe(false);
	});
```

- [ ] **Step 3: Run dashboard tests to verify the upcoming regression fails**

Run:

```bash
bun run test -- convex/payments/adminDashboard/__tests__/queries.test.ts
```

Expected: FAIL on the new upcoming-obligation test because current `hasJournalDrift` compares projected `300_000` with journal `0`.

- [ ] **Step 4: Import the shared helper**

In `convex/payments/adminDashboard/queries.ts`, add this import near the other payment imports:

```ts
import { obligationIsReceivableDriftEligible } from "../obligations/accrualEligibility";
```

- [ ] **Step 5: Gate `hasJournalDrift` behind receivable eligibility**

In `buildObligationRows`, replace:

```ts
				hasJournalDrift:
					projectedOutstandingBalance !== journalOutstandingBalance,
```

with:

```ts
				hasJournalDrift:
					obligationIsReceivableDriftEligible(obligation) &&
					projectedOutstandingBalance !== journalOutstandingBalance,
```

- [ ] **Step 6: Run dashboard tests to verify they pass**

Run:

```bash
bun run test -- convex/payments/adminDashboard/__tests__/queries.test.ts
```

Expected: PASS.

---

## Task 3: Standardize Reconciliation Accrual Status Semantics

**Files:**
- Modify: `convex/payments/cashLedger/reconciliationSuite.ts`
- Modify: `convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts`

- [ ] **Step 1: Run GitNexus impact before modifying `checkOrphanedObligations`**

Run:

```bash
npx gitnexus impact --repo nt1n checkOrphanedObligations
```

Expected: Review the direct callers and affected process list. If GitNexus reports HIGH or CRITICAL risk, pause and tell the user before editing. Otherwise continue.

- [ ] **Step 2: Add failing-proof regression test for upcoming orphan exclusion**

In `convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts`, add this test immediately after `"checkOrphanedObligations flags due obligations missing OBLIGATION_ACCRUED"`:

```ts
	it("checkOrphanedObligations ignores upcoming obligations without OBLIGATION_ACCRUED", async () => {
		const t = createHarness(modules);
		const seeded = await seedMinimalEntities(t);

		await t.run(async (ctx) => {
			await ctx.db.insert("obligations", {
				status: "upcoming",
				machineContext: {},
				lastTransitionAt: Date.now(),
				mortgageId: seeded.mortgageId,
				borrowerId: seeded.borrowerId,
				paymentNumber: 3,
				type: "regular_interest",
				amount: 50_000,
				amountSettled: 0,
				dueDate: Date.parse("2026-06-01T00:00:00Z"),
				gracePeriodEnd: Date.parse("2026-06-08T00:00:00Z"),
				createdAt: Date.now(),
			});
		});

		const result = await t.run(async (ctx) => checkOrphanedObligations(ctx));
		expect(result.items.some((i) => i.status === "upcoming")).toBe(false);
	});
```

- [ ] **Step 3: Run reconciliation tests before refactor**

Run:

```bash
bun run test -- convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts
```

Expected: PASS. This test documents existing behavior before replacing the private status list.

- [ ] **Step 4: Import the shared status list**

In `convex/payments/cashLedger/reconciliationSuite.ts`, add:

```ts
import {
	OBLIGATION_STATUSES_REQUIRING_ACCRUAL,
	type ObligationStatusRequiringAccrual,
} from "../obligations/accrualEligibility";
```

- [ ] **Step 5: Remove the private status list and alias the shared type**

Replace this block:

```ts
const OBLIGATION_STATUS_VALUES = [
	"due",
	"overdue",
	"partially_settled",
	"settled",
	"waived",
] as const;

/** Valid statuses that require an OBLIGATION_ACCRUED journal entry. */
export const STATES_REQUIRING_ACCRUAL = new Set(OBLIGATION_STATUS_VALUES);

export type ObligationStatus = (typeof OBLIGATION_STATUS_VALUES)[number];
```

with:

```ts
/** Valid statuses that require an OBLIGATION_ACCRUED journal entry. */
export const STATES_REQUIRING_ACCRUAL = new Set(
	OBLIGATION_STATUSES_REQUIRING_ACCRUAL
);

export type ObligationStatus = ObligationStatusRequiringAccrual;
```

- [ ] **Step 6: Run reconciliation tests after refactor**

Run:

```bash
bun run test -- convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts
```

Expected: PASS.

---

## Task 4: Full Validation And Scope Audit

**Files:**
- Read-only verification across changed files.

- [ ] **Step 1: Run focused test set**

Run:

```bash
bun run test -- convex/payments/obligations/__tests__/accrualEligibility.test.ts convex/payments/adminDashboard/__tests__/queries.test.ts convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run formatter/linter first, per repo instructions**

Run:

```bash
bun check
```

Expected: PASS or auto-fixes only in files touched by this work. If it changes files, inspect the diff before continuing.

- [ ] **Step 3: Run type checking**

Run:

```bash
bun typecheck
```

Expected: PASS.

- [ ] **Step 4: Regenerate/check Convex codegen**

Run:

```bash
bunx convex codegen
```

Expected: PASS. Generated files may update if Convex sees new import references; inspect any generated diff.

- [ ] **Step 5: Run GitNexus change detection before recording work**

Run:

```bash
npx gitnexus status
```

Then call the GitNexus MCP tool:

```ts
gitnexus_detect_changes({ repo: "nt1n" })
```

Expected: Index is up to date, and detected changes are limited to the new accrual eligibility helper, payment operations dashboard drift eligibility, orphaned-obligation reconciliation status sharing, and tests.

- [ ] **Step 6: Inspect final diff**

Run:

```bash
git diff -- convex/payments/obligations/accrualEligibility.ts convex/payments/obligations/__tests__/accrualEligibility.test.ts convex/payments/adminDashboard/queries.ts convex/payments/adminDashboard/__tests__/queries.test.ts convex/payments/cashLedger/reconciliationSuite.ts convex/payments/cashLedger/__tests__/reconciliationSuite.test.ts docs/superpowers/specs/2026-04-28-payment-operations-receivable-drift-eligibility-design.md
```

Expected: Diff only contains the planned helper, imports, predicate wiring, tests, and any necessary spec clarification.

- [ ] **Step 7: Record the change with Graphite**

If this is the first tracked change on a new branch, run:

```bash
gt create -am "fix: standardize receivable drift eligibility"
```

If already on a tracked Graphite branch, run:

```bash
gt modify -am "fix: standardize receivable drift eligibility"
```

Expected: Graphite records the implementation changes. Do not include unrelated dirty worktree changes.

---

## Implementation Notes

- The worktree currently contains many pre-existing unrelated changes. Do not revert them.
- Use `git diff -- <path>` before and after edits to keep this change scoped.
- Do not change admin settings seeding. The seeded catalog is correctly creating future scheduled obligations.
- Do not post accrual entries for future `upcoming` obligations. That would violate the documented ledger lifecycle.
- If `bun check` formats unrelated files, stop and inspect before staging or recording.
