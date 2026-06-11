# Admin Lawyers Review Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the audit gaps for the admin lawyer roster, platform invite flow, deal-level controls, detail sheet, urgency derivation, pagination, and bounded roster projection.

**Architecture:** Keep legal representation invariants in existing Convex helpers and expose admin-specific orchestration through `convex/legalRepresentation/adminLawyers.ts`. The React surface remains a roster-first admin tool with expanded filters, richer row projection, item-scoped deal actions, and platform/audit detail sections.

**Tech Stack:** Convex/fluent-convex, React, TanStack Start route surface, Tailwind, Vitest/RTL, convex-test.

---

### Task 1: Backend Projection And Invite Contracts

**Files:**
- Modify: `convex/legalRepresentation/adminLawyers.ts`
- Modify: `convex/legalRepresentation/__tests__/adminLawyers.test.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Write failing Convex tests** covering roster row bar/jurisdiction and summaries, `representation_override_needed`, platform invite resolution for existing synced users, new platform onboarding invite records, and detail platform/audit/activity sections.
- [ ] **Step 2: Run `bun test convex/legalRepresentation/__tests__/adminLawyers.test.ts`** and verify the new assertions fail for missing behavior.
- [ ] **Step 3: Implement backend support** by adding platform invite tracking, indexed deal lookup helpers, richer roster rows, detail availability/activity projections, and admin wrappers for resend/cancel/replace/verify actions that call canonical management/invitation helpers.
- [ ] **Step 4: Re-run the backend test** and keep the full file green.

### Task 2: Admin Lawyers UI

**Files:**
- Modify: `src/components/admin/lawyers/admin-lawyers-model.ts`
- Modify: `src/components/admin/lawyers/AdminLawyersPage.tsx`
- Modify: `src/components/admin/lawyers/AdminLawyersDetailSheet.tsx`
- Modify: `src/components/admin/lawyers/InvitePlatformLawyerDialog.tsx`
- Modify: `src/test/admin/admin-lawyers-page.test.tsx`

- [ ] **Step 1: Update UI tests** for all required toolbar controls, cursor-stack pagination, richer row cells, platform invite resolution flow, and item-scoped detail actions.
- [ ] **Step 2: Run `bun test src/test/admin/admin-lawyers-page.test.tsx`** and verify the new assertions fail before UI implementation.
- [ ] **Step 3: Implement UI** with required filters/sort, richer roster columns, proper previous-page cursor stack, resolve/designate/create platform invite paths, full detail sections, and wired action dialogs.
- [ ] **Step 4: Re-run the UI test** and keep it green.

### Task 3: Generated Files And Verification

**Files:**
- Modify: `convex/_generated/api.d.ts`
- Modify: `convex/_generated/dataModel.d.ts` if schema generation changes it
- Modify: `convex/test/moduleMaps.ts` only if Convex modules change
- Modify: `.superpowers/verification/admin-lawyers/README.md`

- [ ] **Step 1: Run `bunx convex codegen`** after schema/API changes.
- [ ] **Step 2: Run focused tests** for backend, admin lawyers UI, and admin shell.
- [ ] **Step 3: Run `bun typecheck` and `bun check`** and record any unrelated pre-existing failures with exact files.
- [ ] **Step 4: Run GitNexus change detection if available** and document any CLI limitation.
