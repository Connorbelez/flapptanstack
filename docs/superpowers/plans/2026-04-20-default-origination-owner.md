# Default Origination Owner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every newly originated mortgage mint into treasury and immediately issue its full share supply to the FairLend MIC lender/vehicle pair configured in platform settings, with idempotent seeding and auditable governance changes.

**Architecture:** Keep `lender` as the canonical operational owner and layer `investmentVehicle` plus `investmentVehicleWorkspace` on top of it. Introduce a narrow `platformSettings` singleton for the default origination owner, seed the FairLend MIC pair explicitly, and resolve that pair inside `activateMortgageAggregate` immediately after `mintMortgageHandler`.

**Tech Stack:** Convex, fluent-convex, Vitest, convex-test, Bun, WorkOS-backed user records, existing audit journal and ledger primitives.

---

## File Structure

- Create: `convex/platform/defaultOriginationOwner.ts`
  Responsibility: canonical resolver for `platformSettings["default"]`, validation of the lender/vehicle/workspace/trust-account link, admin read/update functions, and governance audit writes.

- Create: `convex/seed/seedPlatformOwnership.ts`
  Responsibility: idempotently seed the FairLend MIC lender + investment vehicle + investmentVehicleWorkspace + trust bank account + `platformSettings` row.

- Create: `src/test/convex/platform/defaultOriginationOwner.test.ts`
  Responsibility: prove missing settings fail closed, inconsistent pairs are rejected, and admin updates write the expected audit journal entry.

- Create: `src/test/convex/seed/seedPlatformOwnership.test.ts`
  Responsibility: prove the platform ownership seed is idempotent and wires the expected pair plus trust account into `platformSettings`.

- Modify: `convex/schema.ts:236-279`, `convex/schema.ts:2324-2363`
  Responsibility: add `platformSettings`, `investmentVehicles`, `investmentVehicleWorkspaces`, and the stub settings tables without introducing a generic blob.

- Modify: `convex/engine/types.ts:1-23`, `convex/engine/validators.ts:22-42`
  Responsibility: extend audit entity typing so `platformSetting`, `investmentVehicle`, and `investmentVehicleWorkspace` can write journal rows through the normal audit path.

- Modify: `convex/seed/seedAll.ts:1-140`
  Responsibility: call `seedPlatformOwnership` and aggregate its counts into `seedAll`’s summary.

- Modify: `convex/seed/seedLender.ts:16-101`
  Responsibility: remove the fake Maple MIC seed from the generic lender pool so there is only one canonical MIC seed path.

- Modify: `convex/mortgages/activateMortgageAggregate.ts:495-511`
  Responsibility: resolve the configured default owner after mint and issue `TOTAL_SUPPLY` via `issueSharesHandler`.

- Modify: `src/test/convex/seed/seedAll.test.ts:36-240`
  Responsibility: assert the new ownership tables and singleton row are seeded idempotently alongside the existing data.

- Modify: `src/test/convex/admin/origination/commit.test.ts:33-148`, `src/test/convex/admin/origination/commit.test.ts:714-728`
  Responsibility: seed the default origination owner in the commit harness and assert `SHARES_ISSUED` plus the default lender position after commit.

- Modify: `convex/test/moduleMaps.ts`
  Responsibility: register any new Convex modules so the in-memory test harness can call them through `api.*`.

---

### Task 1: Add Platform Ownership Tables And Resolver

**Files:**
- Create: `convex/platform/defaultOriginationOwner.ts`
- Modify: `convex/schema.ts:236-279`
- Modify: `convex/schema.ts:2324-2363`
- Modify: `convex/engine/types.ts:1-23`
- Modify: `convex/engine/validators.ts:22-42`
- Modify: `convex/test/moduleMaps.ts`
- Test: `src/test/convex/platform/defaultOriginationOwner.test.ts`

- [ ] **Step 1: Add the schema scaffold and regenerate Convex types**

```ts
// convex/schema.ts
platformSettings: defineTable({
  key: v.string(),
  defaultOriginationLenderId: v.id("lenders"),
  defaultOriginationInvestmentVehicleId: v.id("investmentVehicles"),
  defaultOriginationWorkspaceId: v.optional(v.id("investmentVehicleWorkspaces")),
  defaultFairlendTrustBankAccountId: v.optional(v.id("bankAccounts")),
  updatedBy: v.string(),
  changeReason: v.string(),
  source: v.union(
    v.literal("seed"),
    v.literal("admin_mutation"),
    v.literal("migration")
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_key", ["key"]),

investmentVehicles: defineTable({
  lenderId: v.id("lenders"),
  name: v.string(),
  legalName: v.string(),
  entityType: v.union(
    v.literal("mic"),
    v.literal("corporation"),
    v.literal("trust"),
    v.literal("partnership")
  ),
  status: v.union(v.literal("active"), v.literal("inactive")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_lender", ["lenderId"]),

investmentVehicleWorkspaces: defineTable({
  investmentVehicleId: v.id("investmentVehicles"),
  name: v.string(),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_vehicle", ["investmentVehicleId"]),

lenderSettings: defineTable({
  lenderId: v.id("lenders"),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_lender", ["lenderId"]),

brokerSettings: defineTable({
  brokerId: v.id("brokers"),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_broker", ["brokerId"]),

investmentVehicleWorkspaceSettings: defineTable({
  investmentVehicleWorkspaceId: v.id("investmentVehicleWorkspaces"),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_workspace", ["investmentVehicleWorkspaceId"]),
```

Run: `bunx convex codegen`
Expected: command exits 0 and regenerates `_generated` types including the new tables.

- [ ] **Step 2: Write the failing platform ownership tests**

```ts
// src/test/convex/platform/defaultOriginationOwner.test.ts
import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";
import { getRequiredDefaultOriginationOwner } from "../../../../convex/platform/defaultOriginationOwner";

describe("default origination owner", () => {
  it("fails closed when the singleton settings row is missing", async () => {
    const t = createTestConvex();
    await ensureSeededIdentity(t, FAIRLEND_ADMIN);

    await expect(
      t.run((ctx) => getRequiredDefaultOriginationOwner(ctx))
    ).rejects.toMatchObject(
      new ConvexError({
        code: "DEFAULT_ORIGINATION_OWNER_MISSING",
      })
    );
  });

  it("writes a governance audit entry when the default pair changes", async () => {
    const t = createTestConvex();
    await ensureSeededIdentity(t, FAIRLEND_ADMIN);

    const { lenderId, vehicleId, workspaceId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        authId: "seed_fairlend_mic_user",
        email: "fairlend.mic+lender@fairlend.ca",
        firstName: "FairLend",
        lastName: "MIC",
      });
      const brokerId = await ctx.db.insert("brokers", {
        createdAt: Date.now(),
        lastTransitionAt: Date.now(),
        onboardedAt: Date.now(),
        orgId: "org_fairlend_brokerage",
        status: "active",
        userId,
      });
      const lenderId = await ctx.db.insert("lenders", {
        accreditationStatus: "exempt",
        brokerId,
        createdAt: Date.now(),
        onboardingEntryPath: "admin_dashboard",
        orgId: "org_fairlend_brokerage",
        status: "active",
        userId,
      });
      const vehicleId = await ctx.db.insert("investmentVehicles", {
        lenderId,
        name: "FairLend MIC",
        legalName: "FairLend MIC",
        entityType: "mic",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const workspaceId = await ctx.db.insert("investmentVehicleWorkspaces", {
        investmentVehicleId: vehicleId,
        name: "FairLend MIC Workspace",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { lenderId, vehicleId, workspaceId };
    });

    const result = await t.withIdentity(FAIRLEND_ADMIN).mutation(
      api.platform.defaultOriginationOwner.setDefaultOriginationOwner,
      {
        changeReason: "Promote FairLend MIC to canonical origination owner",
        defaultOriginationInvestmentVehicleId: vehicleId,
        defaultOriginationLenderId: lenderId,
        defaultOriginationWorkspaceId: workspaceId,
      }
    );

    expect(result.settings.key).toBe("default");
    const auditEntry = await t.run((ctx) =>
      ctx.db
        .query("auditJournal")
        .withIndex("by_entity", (q) =>
          q.eq("entityType", "platformSetting").eq("entityId", String(result.settings._id))
        )
        .first()
    );
    expect(auditEntry?.eventType).toBe("DEFAULT_ORIGINATION_OWNER_SET");
  });
});
```

- [ ] **Step 3: Run the new test file to confirm it fails for the missing implementation**

Run: `bun run test -- src/test/convex/platform/defaultOriginationOwner.test.ts`
Expected: FAIL because `convex/platform/defaultOriginationOwner.ts` and the registered API export do not exist yet.

- [ ] **Step 4: Implement the resolver, validation, and audited admin mutation**

```ts
// convex/platform/defaultOriginationOwner.ts
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { adminMutation, adminQuery } from "../fluent";
import { appendAuditJournalEntry } from "../engine/auditJournal";

const PLATFORM_SETTINGS_KEY = "default";

type DbCtx = Pick<QueryCtx | MutationCtx, "db">;

export async function getRequiredDefaultOriginationOwner(ctx: DbCtx) {
  const settings = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
    .unique();

  if (!settings) {
    throw new ConvexError({
      code: "DEFAULT_ORIGINATION_OWNER_MISSING",
      message: "platformSettings.default has not been configured",
    });
  }

  const [lender, vehicle, workspace, trustBankAccount] = await Promise.all([
    ctx.db.get(settings.defaultOriginationLenderId),
    ctx.db.get(settings.defaultOriginationInvestmentVehicleId),
    settings.defaultOriginationWorkspaceId
      ? ctx.db.get(settings.defaultOriginationWorkspaceId)
      : null,
    settings.defaultFairlendTrustBankAccountId
      ? ctx.db.get(settings.defaultFairlendTrustBankAccountId)
      : null,
  ]);

  if (!lender || lender.status !== "active") {
    throw new ConvexError({
      code: "DEFAULT_ORIGINATION_OWNER_INVALID",
      message: "Configured lender is missing or inactive",
    });
  }
  if (!vehicle || vehicle.lenderId !== lender._id) {
    throw new ConvexError({
      code: "DEFAULT_ORIGINATION_OWNER_INVALID",
      message: "Configured investment vehicle is not linked to the configured lender",
    });
  }
  if (workspace && workspace.investmentVehicleId !== vehicle._id) {
    throw new ConvexError({
      code: "DEFAULT_ORIGINATION_OWNER_INVALID",
      message: "Configured workspace is not linked to the configured investment vehicle",
    });
  }
  if (
    trustBankAccount &&
    !(
      trustBankAccount.ownerType === "trust" &&
      trustBankAccount.ownerId === String(vehicle._id)
    )
  ) {
    throw new ConvexError({
      code: "DEFAULT_ORIGINATION_OWNER_INVALID",
      message: "Configured trust account is not owned by the configured vehicle",
    });
  }

  return { lender, settings, investmentVehicle: vehicle, workspace, trustBankAccount };
}

export const getDefaultOriginationOwner = adminQuery.handler(async (ctx) => {
  return getRequiredDefaultOriginationOwner(ctx);
}).public();

export async function upsertDefaultOriginationOwner(
  ctx: MutationCtx,
  args: {
    actorId: string;
    actorType: "admin" | "system";
    changeReason: string;
    defaultOriginationInvestmentVehicleId: Id<"investmentVehicles">;
    defaultOriginationLenderId: Id<"lenders">;
    defaultOriginationWorkspaceId?: Id<"investmentVehicleWorkspaces">;
    defaultFairlendTrustBankAccountId?: Id<"bankAccounts">;
    source: "seed" | "admin_mutation" | "migration";
  }
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("platformSettings")
    .withIndex("by_key", (q) => q.eq("key", PLATFORM_SETTINGS_KEY))
    .unique();

  const lender = await ctx.db.get(args.defaultOriginationLenderId);
  if (!lender) {
    throw new ConvexError({ code: "DEFAULT_ORIGINATION_OWNER_INVALID", message: "Lender not found" });
  }

  const patchDoc = {
    key: PLATFORM_SETTINGS_KEY,
    defaultOriginationLenderId: args.defaultOriginationLenderId,
    defaultOriginationInvestmentVehicleId: args.defaultOriginationInvestmentVehicleId,
    defaultOriginationWorkspaceId: args.defaultOriginationWorkspaceId,
    defaultFairlendTrustBankAccountId: args.defaultFairlendTrustBankAccountId,
    updatedBy: args.actorId,
    changeReason: args.changeReason,
    source: args.source,
    updatedAt: now,
  };

  const settingsId = existing
    ? (await ctx.db.patch(existing._id, patchDoc), existing._id)
    : await ctx.db.insert("platformSettings", { ...patchDoc, createdAt: now });

  await appendAuditJournalEntry(ctx, {
    actorId: args.actorId,
    actorType: args.actorType,
    channel: "admin_dashboard",
    entityId: String(settingsId),
    entityType: "platformSetting",
    eventCategory: "configuration",
    eventType: "DEFAULT_ORIGINATION_OWNER_SET",
    newState: "configured",
    previousState: existing ? "configured" : "none",
    outcome: "transitioned",
    organizationId: lender.orgId,
    payload: {
      after: patchDoc,
      before: existing
        ? {
            lenderId: existing.defaultOriginationLenderId,
            investmentVehicleId: existing.defaultOriginationInvestmentVehicleId,
            workspaceId: existing.defaultOriginationWorkspaceId,
            trustBankAccountId: existing.defaultFairlendTrustBankAccountId,
          }
        : null,
    },
    timestamp: now,
  });

  return {
    settings: await ctx.db.get(settingsId as Id<"platformSettings">),
  };
}

export const setDefaultOriginationOwner = adminMutation
  .input({
    changeReason: v.string(),
    defaultOriginationInvestmentVehicleId: v.id("investmentVehicles"),
    defaultOriginationLenderId: v.id("lenders"),
    defaultOriginationWorkspaceId: v.optional(v.id("investmentVehicleWorkspaces")),
    defaultFairlendTrustBankAccountId: v.optional(v.id("bankAccounts")),
  })
  .handler(async (ctx, args) =>
    upsertDefaultOriginationOwner(ctx, {
      ...args,
      actorId: "admin",
      actorType: "admin",
      source: "admin_mutation",
    })
  )
  .public();
```

Also extend the audit entity unions:

```ts
// convex/engine/types.ts + convex/engine/validators.ts
| "investmentVehicle"
| "investmentVehicleWorkspace"
| "platformSetting"
```

And register the new module in the test harness:

```ts
// convex/test/moduleMaps.ts
"/convex/platform/defaultOriginationOwner.ts": async () =>
  await import("./../platform/defaultOriginationOwner.ts"),
```

- [ ] **Step 5: Run the platform ownership tests again**

Run: `bun run test -- src/test/convex/platform/defaultOriginationOwner.test.ts`
Expected: PASS

- [ ] **Step 6: Record the change**

```bash
gt create -am "feat: add default origination owner settings"
```

---

### Task 2: Seed The FairLend MIC Pair And Wire `seedAll`

**Files:**
- Create: `convex/seed/seedPlatformOwnership.ts`
- Modify: `convex/seed/seedAll.ts:1-140`
- Modify: `convex/seed/seedLender.ts:16-101`
- Modify: `src/test/convex/seed/seedAll.test.ts:36-240`
- Test: `src/test/convex/seed/seedPlatformOwnership.test.ts`
- Test: `src/test/convex/seed/seedAll.test.ts`
- Modify: `convex/test/moduleMaps.ts`

- [ ] **Step 1: Write the failing seed tests**

```ts
// src/test/convex/seed/seedPlatformOwnership.test.ts
import { describe, expect, it } from "vitest";
import { api } from "../../../../convex/_generated/api";
import { createTestConvex, ensureSeededIdentity } from "../../auth/helpers";
import { FAIRLEND_ADMIN } from "../../auth/identities";

describe("seedPlatformOwnership", () => {
  it("creates one canonical lender/vehicle/workspace/settings pair and reuses it on replay", async () => {
    const t = createTestConvex();
    await ensureSeededIdentity(t, FAIRLEND_ADMIN);

    const brokers = await t.withIdentity(FAIRLEND_ADMIN).mutation(
      api.seed.seedBroker.seedBroker,
      {}
    );

    const first = await t.withIdentity(FAIRLEND_ADMIN).mutation(
      api.seed.seedPlatformOwnership.seedPlatformOwnership,
      { brokerId: brokers.brokerIds[0] }
    );
    const second = await t.withIdentity(FAIRLEND_ADMIN).mutation(
      api.seed.seedPlatformOwnership.seedPlatformOwnership,
      { brokerId: brokers.brokerIds[0] }
    );

    expect(first.defaultOriginationLenderId).toBe(second.defaultOriginationLenderId);
    expect(first.defaultOriginationInvestmentVehicleId).toBe(
      second.defaultOriginationInvestmentVehicleId
    );
    expect(first.created).toMatchObject({
      investmentVehicles: 1,
      investmentVehicleWorkspaces: 1,
      platformSettings: 1,
    });
    expect(second.reused.platformSettings).toBe(1);
  });
});
```

Augment `src/test/convex/seed/seedAll.test.ts` to verify the new records:

```ts
expect(firstRun.summary.created).toMatchObject({
  lenders: 3,
  investmentVehicles: 1,
  investmentVehicleWorkspaces: 1,
  platformSettings: 1,
});

const platformArtifacts = await t.run(async (ctx) => ({
  platformSettings: await ctx.db.query("platformSettings").collect(),
  investmentVehicles: await ctx.db.query("investmentVehicles").collect(),
  investmentVehicleWorkspaces: await ctx.db.query("investmentVehicleWorkspaces").collect(),
}));

expect(platformArtifacts.platformSettings).toHaveLength(1);
expect(platformArtifacts.investmentVehicles).toHaveLength(1);
expect(platformArtifacts.investmentVehicleWorkspaces).toHaveLength(1);
```

- [ ] **Step 2: Run the seed tests to confirm they fail**

Run: `bun run test -- src/test/convex/seed/seedPlatformOwnership.test.ts src/test/convex/seed/seedAll.test.ts`
Expected: FAIL because the mutation and the new summary fields do not exist yet.

- [ ] **Step 3: Implement `seedPlatformOwnership.ts`**

```ts
// convex/seed/seedPlatformOwnership.ts
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { adminMutation } from "../fluent";
import { FAIRLEND_BROKERAGE_ORG_ID } from "../constants";
import {
  ensureUserByEmail,
  SEED_SOURCE,
  seedAuthIdFromEmail,
  seedTimestamp,
  writeCreationJournalEntry,
} from "./seedHelpers";
import { upsertDefaultOriginationOwner } from "../platform/defaultOriginationOwner";

async function upsertFairlendMicLender(
  ctx: MutationCtx,
  args: { brokerId: Id<"brokers">; createdAt: number; userId: Id<"users"> }
) {
  const existing = await ctx.db
    .query("lenders")
    .withIndex("by_user", (q) => q.eq("userId", args.userId))
    .unique();
  if (existing) {
    return { lenderId: existing._id, wasCreated: false };
  }

  const lenderId = await ctx.db.insert("lenders", {
    accreditationStatus: "exempt",
    brokerId: args.brokerId,
    createdAt: args.createdAt,
    kycStatus: "approved",
    onboardingEntryPath: "admin_dashboard",
    orgId: FAIRLEND_BROKERAGE_ORG_ID,
    status: "active",
    userId: args.userId,
  });

  await writeCreationJournalEntry(ctx, {
    entityId: String(lenderId),
    entityType: "lender",
    initialState: "active",
    organizationId: FAIRLEND_BROKERAGE_ORG_ID,
    source: SEED_SOURCE,
    timestamp: args.createdAt,
  });

  return { lenderId, wasCreated: true };
}

async function upsertFairlendMicVehicle(
  ctx: MutationCtx,
  args: { createdAt: number; lenderId: Id<"lenders"> }
) {
  const existing = await ctx.db
    .query("investmentVehicles")
    .withIndex("by_lender", (q) => q.eq("lenderId", args.lenderId))
    .unique();
  if (existing) {
    return { investmentVehicleId: existing._id, wasCreated: false };
  }

  const investmentVehicleId = await ctx.db.insert("investmentVehicles", {
    lenderId: args.lenderId,
    name: "FairLend MIC",
    legalName: "FairLend MIC",
    entityType: "mic",
    status: "active",
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  });

  await writeCreationJournalEntry(ctx, {
    entityId: String(investmentVehicleId),
    entityType: "investmentVehicle",
    initialState: "active",
    organizationId: FAIRLEND_BROKERAGE_ORG_ID,
    source: SEED_SOURCE,
    timestamp: args.createdAt,
  });

  return { investmentVehicleId, wasCreated: true };
}

async function upsertFairlendMicWorkspace(
  ctx: MutationCtx,
  args: { createdAt: number; investmentVehicleId: Id<"investmentVehicles"> }
) {
  const existing = await ctx.db
    .query("investmentVehicleWorkspaces")
    .withIndex("by_vehicle", (q) => q.eq("investmentVehicleId", args.investmentVehicleId))
    .unique();
  if (existing) {
    return { workspaceId: existing._id, wasCreated: false };
  }

  const workspaceId = await ctx.db.insert("investmentVehicleWorkspaces", {
    investmentVehicleId: args.investmentVehicleId,
    name: "FairLend MIC Workspace",
    status: "active",
    createdAt: args.createdAt,
    updatedAt: args.createdAt,
  });

  await writeCreationJournalEntry(ctx, {
    entityId: String(workspaceId),
    entityType: "investmentVehicleWorkspace",
    initialState: "active",
    organizationId: FAIRLEND_BROKERAGE_ORG_ID,
    source: SEED_SOURCE,
    timestamp: args.createdAt,
  });

  return { workspaceId, wasCreated: true };
}

async function upsertFairlendMicTrustAccount(
  ctx: MutationCtx,
  args: { createdAt: number; investmentVehicleId: Id<"investmentVehicles"> }
) {
  const existing = await ctx.db
    .query("bankAccounts")
    .withIndex("by_owner", (q) =>
      q.eq("ownerType", "trust").eq("ownerId", String(args.investmentVehicleId))
    )
    .unique();
  if (existing) {
    return { trustBankAccountId: existing._id, wasCreated: false };
  }

  const trustBankAccountId = await ctx.db.insert("bankAccounts", {
    accountLast4: "2401",
    country: "CA",
    createdAt: args.createdAt,
    currency: "CAD",
    institutionNumber: "001",
    mandateStatus: "not_required",
    ownerId: String(args.investmentVehicleId),
    ownerType: "trust",
    status: "validated",
    transitNumber: "00011",
    updatedAt: args.createdAt,
    validationMethod: "manual",
  });

  return { trustBankAccountId, wasCreated: true };
}

export const seedPlatformOwnership = adminMutation
  .input({ brokerId: v.optional(v.id("brokers")) })
  .handler(async (ctx, args) => {
    const createdAt = seedTimestamp(18_000_000);
    const { userId } = await ensureUserByEmail(ctx, {
      authId: seedAuthIdFromEmail("fairlend.mic+lender@fairlend.ca"),
      email: "fairlend.mic+lender@fairlend.ca",
      firstName: "FairLend",
      lastName: "MIC",
      phoneNumber: "+1-416-555-0199",
    });

    const brokerId = args.brokerId ?? (
      await ctx.db
        .query("brokers")
        .withIndex("by_org", (q) => q.eq("orgId", FAIRLEND_BROKERAGE_ORG_ID))
        .first()
    )?._id;

    if (!brokerId) {
      throw new Error("FairLend broker must exist before seedPlatformOwnership");
    }

    const lender = await upsertFairlendMicLender(ctx, { brokerId, createdAt, userId });
    const vehicle = await upsertFairlendMicVehicle(ctx, {
      createdAt,
      lenderId: lender.lenderId,
    });
    const workspace = await upsertFairlendMicWorkspace(ctx, {
      createdAt,
      investmentVehicleId: vehicle.investmentVehicleId,
    });
    const trustBankAccount = await upsertFairlendMicTrustAccount(ctx, {
      createdAt,
      investmentVehicleId: vehicle.investmentVehicleId,
    });
    const existingSettings = await ctx.db
      .query("platformSettings")
      .withIndex("by_key", (q) => q.eq("key", "default"))
      .unique();

    const settings = await upsertDefaultOriginationOwner(ctx, {
      actorId: "seed",
      actorType: "system",
      changeReason: "Seed canonical FairLend MIC origination owner",
      defaultOriginationInvestmentVehicleId: vehicle.investmentVehicleId,
      defaultOriginationLenderId: lender.lenderId,
      defaultOriginationWorkspaceId: workspace.workspaceId,
      defaultFairlendTrustBankAccountId: trustBankAccount.trustBankAccountId,
      source: "seed",
    });

    return {
      defaultOriginationLenderId: lender.lenderId,
      defaultOriginationInvestmentVehicleId: vehicle.investmentVehicleId,
      defaultOriginationWorkspaceId: workspace.workspaceId,
      defaultFairlendTrustBankAccountId: trustBankAccount.trustBankAccountId,
      settingsId: settings.settings?._id,
      created: {
        lenders: lender.wasCreated ? 1 : 0,
        investmentVehicles: vehicle.wasCreated ? 1 : 0,
        investmentVehicleWorkspaces: workspace.wasCreated ? 1 : 0,
        bankAccounts: trustBankAccount.wasCreated ? 1 : 0,
        platformSettings: existingSettings ? 0 : 1,
      },
      reused: {
        lenders: lender.wasCreated ? 0 : 1,
        investmentVehicles: vehicle.wasCreated ? 0 : 1,
        investmentVehicleWorkspaces: workspace.wasCreated ? 0 : 1,
        bankAccounts: trustBankAccount.wasCreated ? 0 : 1,
        platformSettings: existingSettings ? 1 : 0,
      },
    };
  })
  .public();
```

- [ ] **Step 4: Wire `seedAll` and remove the fake MIC from the generic lender fixtures**

```ts
// convex/seed/seedAll.ts
interface SeedPlatformOwnershipResult {
  created: {
    bankAccounts: number;
    investmentVehicles: number;
    investmentVehicleWorkspaces: number;
    lenders: number;
    platformSettings: number;
  };
  defaultOriginationInvestmentVehicleId: Id<"investmentVehicles">;
  defaultOriginationLenderId: Id<"lenders">;
  defaultOriginationWorkspaceId?: Id<"investmentVehicleWorkspaces">;
  defaultFairlendTrustBankAccountId?: Id<"bankAccounts">;
  reused: {
    bankAccounts: number;
    investmentVehicles: number;
    investmentVehicleWorkspaces: number;
    lenders: number;
    platformSettings: number;
  };
  settingsId?: Id<"platformSettings">;
}

const seedPlatformOwnershipRef = makeFunctionReference<
  "mutation",
  { brokerId?: Id<"brokers"> },
  SeedPlatformOwnershipResult
>("seed/seedPlatformOwnership:seedPlatformOwnership");

const brokers = await ctx.runMutation(seedBrokerRef, {});
const borrowers = await ctx.runMutation(seedBorrowerRef, {});
const lenders = await ctx.runMutation(seedLenderRef, { brokerIds: brokers.brokerIds });
const platformOwnership = await ctx.runMutation(seedPlatformOwnershipRef, {
  brokerId: brokers.brokerIds[0],
});

summary: {
  created: {
    lenders: lenders.created.lenders + platformOwnership.created.lenders,
    investmentVehicles: platformOwnership.created.investmentVehicles,
    investmentVehicleWorkspaces: platformOwnership.created.investmentVehicleWorkspaces,
    platformSettings: platformOwnership.created.platformSettings,
  },
  reused: {
    lenders: lenders.reused.lenders + platformOwnership.reused.lenders,
    investmentVehicles: platformOwnership.reused.investmentVehicles,
    investmentVehicleWorkspaces: platformOwnership.reused.investmentVehicleWorkspaces,
    platformSettings: platformOwnership.reused.platformSettings,
  },
}
```

```ts
// convex/seed/seedLender.ts
// Delete the third object literal from LENDER_FIXTURES:
// the one with email "maple.mic+lender@fairlend.ca".
// Leave the existing Grace Wilson and Summit Credit fixtures unchanged.
```

Register the new seed module in `convex/test/moduleMaps.ts`:

```ts
"/convex/seed/seedPlatformOwnership.ts": async () =>
  await import("./../seed/seedPlatformOwnership.ts"),
```

- [ ] **Step 5: Run the seed tests again**

Run: `bun run test -- src/test/convex/seed/seedPlatformOwnership.test.ts src/test/convex/seed/seedAll.test.ts`
Expected: PASS

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: seed canonical fairlend mic owner"
```

---

### Task 3: Issue New Mortgage Shares To The Configured Default Owner

**Files:**
- Modify: `convex/mortgages/activateMortgageAggregate.ts:495-511`
- Modify: `src/test/convex/admin/origination/commit.test.ts:33-148`
- Modify: `src/test/convex/admin/origination/commit.test.ts:714-728`
- Modify: `convex/test/moduleMaps.ts` if the new platform module is not already registered from Task 1
- Test: `src/test/convex/admin/origination/commit.test.ts`

- [ ] **Step 1: Add a helper to seed the default owner inside the origination commit harness**

```ts
// src/test/convex/admin/origination/commit.test.ts
async function seedDefaultOriginationOwner(
  t: ReturnType<typeof createTestConvex>,
  brokerId: Id<"brokers">
) {
  return t.withIdentity(FAIRLEND_ADMIN).mutation(
    api.seed.seedPlatformOwnership.seedPlatformOwnership,
    { brokerId }
  );
}
```

- [ ] **Step 2: Write the failing origination assertions**

```ts
it("mints and immediately issues the full supply to the configured default origination lender", async () => {
  const t = createTestConvex();
  await ensureSeededIdentity(t, FAIRLEND_ADMIN);
  const brokerOfRecordId = await seedBrokerRecord(t);
  const defaultOwner = await seedDefaultOriginationOwner(t, brokerOfRecordId);
  setWorkosProvisioningForTests(createProvisioningMock());

  const caseId = await stageCommitReadyCase(t, { brokerOfRecordId });
  const firstResult = await t.withIdentity(FAIRLEND_ADMIN).action(
    api.admin.origination.commit.commitCase,
    { caseId }
  );
  const artifacts = await t.run(async (ctx) => ({
    ledgerAccounts: await ctx.db
      .query("ledger_accounts")
      .withIndex("by_mortgage", (query) =>
        query.eq("mortgageId", firstResult.committedMortgageId)
      )
      .collect(),
    ledgerEntries: await ctx.db
      .query("ledger_journal_entries")
      .withIndex("by_mortgage_and_time", (query) =>
        query.eq("mortgageId", firstResult.committedMortgageId)
      )
      .collect(),
  }));

  expect(
    artifacts.ledgerEntries.some((entry) => entry.entryType === "MORTGAGE_MINTED")
  ).toBe(true);
  expect(
    artifacts.ledgerEntries.some((entry) => entry.entryType === "SHARES_ISSUED")
  ).toBe(true);
  expect(
    artifacts.ledgerAccounts.some(
      (account) =>
        account.type === "POSITION" &&
        account.lenderId === String(defaultOwner.defaultOriginationLenderId)
    )
  ).toBe(true);
});

it("fails closed when the default origination owner is not configured", async () => {
  const t = createTestConvex();
  await ensureSeededIdentity(t, FAIRLEND_ADMIN);
  const brokerOfRecordId = await seedBrokerRecord(t);
  setWorkosProvisioningForTests(createProvisioningMock());

  const caseId = await stageCommitReadyCase(t, { brokerOfRecordId });

  await expect(
    t.withIdentity(FAIRLEND_ADMIN).action(api.admin.origination.commit.commitCase, { caseId })
  ).rejects.toMatchObject({
    data: { code: "DEFAULT_ORIGINATION_OWNER_MISSING" },
  });
});
```

- [ ] **Step 3: Run the origination commit test file to confirm the new assertions fail**

Run: `bun run test -- src/test/convex/admin/origination/commit.test.ts`
Expected: FAIL because admin origination still stops after `mintMortgageHandler`.

- [ ] **Step 4: Resolve the default owner after mint and issue the full supply**

```ts
// convex/mortgages/activateMortgageAggregate.ts
import { TOTAL_SUPPLY } from "../ledger/constants";
import { issueSharesHandler, mintMortgageHandler } from "../ledger/mutations";
import { getRequiredDefaultOriginationOwner } from "../platform/defaultOriginationOwner";

await mintMortgageHandler(ctx, {
  effectiveDate: mortgageInputs.termStartDate ?? toBusinessDate(args.now),
  idempotencyKey: `${args.source.workflowSourceKey}:ledger-genesis`,
  metadata: {
    caseId: args.source.originatingWorkflowId,
    orgId: args.orgId,
    stagedCollectionMode: args.collectionsDraft?.mode,
  },
  mortgageId: String(mortgageId),
  source: {
    type: "user",
    actor: args.actorAuthId,
    channel: "admin_origination",
  },
});

const defaultOwner = await getRequiredDefaultOriginationOwner(ctx);

await issueSharesHandler(ctx, {
  amount: Number(TOTAL_SUPPLY),
  effectiveDate: mortgageInputs.termStartDate ?? toBusinessDate(args.now),
  idempotencyKey: `${args.source.workflowSourceKey}:initial-owner-issue`,
  lenderId: String(defaultOwner.lender._id),
  metadata: {
    caseId: args.source.originatingWorkflowId,
    investmentVehicleId: String(defaultOwner.investmentVehicle._id),
    platformSettingsId: String(defaultOwner.settings._id),
  },
  mortgageId: String(mortgageId),
  source: {
    type: "user",
    actor: args.actorAuthId,
    channel: "admin_origination",
  },
});
```

- [ ] **Step 5: Run the origination commit tests again**

Run: `bun run test -- src/test/convex/admin/origination/commit.test.ts`
Expected: PASS

- [ ] **Step 6: Record the change**

```bash
gt modify -am "feat: issue new mortgages to default owner"
```

---

### Task 4: Run The Full Verification Pass

**Files:**
- Test: `src/test/convex/platform/defaultOriginationOwner.test.ts`
- Test: `src/test/convex/seed/seedPlatformOwnership.test.ts`
- Test: `src/test/convex/seed/seedAll.test.ts`
- Test: `src/test/convex/admin/origination/commit.test.ts`
- Modify if required by failures discovered during verification: the files touched in Tasks 1-3 only

- [ ] **Step 1: Run the targeted regression suite**

Run:

```bash
bun run test -- \
  src/test/convex/platform/defaultOriginationOwner.test.ts \
  src/test/convex/seed/seedPlatformOwnership.test.ts \
  src/test/convex/seed/seedAll.test.ts \
  src/test/convex/admin/origination/commit.test.ts
```

Expected: PASS

- [ ] **Step 2: Regenerate Convex artifacts one final time**

Run: `bunx convex codegen`
Expected: PASS

- [ ] **Step 3: Run repository checks**

Run: `bun check`
Expected: PASS with no new lint or format errors in the touched files.

- [ ] **Step 4: Run typechecking**

Run: `bun typecheck`
Expected: PASS

- [ ] **Step 5: Record the verification pass**

```bash
gt modify -am "test: verify default origination owner flow"
```

---

## Spec Coverage Notes

- Ownership model is covered by Task 1 schema plus resolver work.
- Platform settings singleton and scope separation are covered by Task 1.
- Seed/bootstrap behavior is covered by Task 2.
- Default issuance during origination is covered by Task 3.
- Governance audit and failure-closed behavior are covered by Task 1 and Task 3.
- Verification commands required by the repo are covered by Task 4.
