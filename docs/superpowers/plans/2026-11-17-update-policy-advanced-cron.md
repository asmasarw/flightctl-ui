# Update-Policy Advanced Cron Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Fleet/Device wizards from silently overwriting complex update-policy cron expressions, and let advanced users view/edit the raw cron via an opt-in field.

**Architecture:** Carry the raw cron string and an "advanced" flag per schedule block on `UpdatePolicyForm`. On load, mark a block advanced when its cron can't be represented by the structured controls and preserve the original string; on save, emit the raw string verbatim for advanced blocks so an untouched schedule produces no patch. Add a per-block "Edit as cron expression" toggle to the shared form component. All logic that needs testing lives in pure utils (`time.ts`), since Vitest runs in a `node` environment with no React component tests.

**Tech Stack:** React + TypeScript, Formik, Yup, PatternFly v6, Vitest (node env), i18next.

**Spec:** `docs/superpowers/specs/2026-11-17-update-policy-advanced-cron-design.md`

## Global Constraints

- Do not edit generated files: `libs/types/**` and `libs/i18n/locales/en/translation.json`. New UI strings are added in source via `t('...')` with hardcoded text, then `npm run i18n` regenerates the catalog.
- No new Cypress specs. New coverage is Vitest unit tests only, living beside the code (`*.test.ts`).
- Vitest runs in `node` environment — test pure functions only; no React render tests.
- `metadata.name` may be treated as defined (cast / `|| ''`) per AGENTS.md.
- `UpdatePolicyForm` is consumed as `Required<UpdatePolicyForm>` on save paths; every new field must be populated wherever the form is built — all such places funnel through `getUpdatePolicyValues`, so populating it there suffices.
- Backend cron grammar (authoritative): standard 5-field `robfig/cron/v3` (`* , - /`, numerics, month/day names; no seconds, no `@macros`). Client validation is permissive well-formedness; backend is the authority.
- Before finishing: `npm run lint` and `npm run test` must pass.

## Review Focus

- **Weekday field as a range/step (`0 2 * * 1-5`, `0 2 * * */2`):** must load as advanced with the cron preserved, and survive an unrelated edit unchanged. (Covered: Task 1 predicate test, Task 2 load test, Task 3 preservation test.)
- **Non-`*` day-of-month or month (`0 2 1 * *`, `0 2 * 6 *`):** must be classed non-representable → advanced. (Covered: Task 1 predicate test.)
- **Download/install differ with one representable and one complex schedule:** the complex block goes advanced, the simple one stays structured, independently. (Covered: Task 3 patch test.)
- **Toggling advanced OFF when the cron is representable:** structured controls must be seeded from the cron (no data loss); toggling ON seeds the cron from structured values. (Covered: Task 4 helper tests.)
- **Empty/undefined `at` (no schedule set):** treated as representable (defaults), block not forced advanced. (Covered: Task 1 predicate test.)

---

### Task 1: Representability predicate

**Files:**
- Modify: `libs/ui-components/src/utils/time.ts`
- Test: `libs/ui-components/src/utils/time.test.ts` (create)

**Interfaces:**
- Produces: `isUpdateCronRepresentable(at?: string): boolean` — true iff `at` is empty/undefined, or has exactly 5 whitespace-separated tokens where minutes is an int 0–59, hours is an int 0–23, day-of-month === `*`, month === `*`, and weekday is `*` or a comma-list of ints each 0–6.

- [ ] **Step 1: Write failing tests** in `time.test.ts`:
  - `isUpdateCronRepresentable(undefined)` → `true`; `('')` → `true`.
  - `('0 2 * * *')` → `true`; `('30 14 * * 1,3,5')` → `true`; `('0 0 * * 0,1,2,3,4,5,6')` → `true`.
  - `('0 0-9 * * *')` → `false`; `('0 2 * * 1-5')` → `false`; `('0 2 * * */2')` → `false`.
  - `('0 2 1 * *')` → `false` (dom); `('0 2 * 6 *')` → `false` (month).
  - `('0 2 * * MON')` → `false` (name); `('60 2 * * *')` → `false` (minute out of range); `('0 24 * * *')` → `false` (hour out of range); `('0 2 * *')` → `false` (4 tokens).

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run libs/ui-components/src/utils/time.test.ts`
Expected: FAIL (`isUpdateCronRepresentable` is not exported).

- [ ] **Step 3: Implement `isUpdateCronRepresentable`** in `time.ts`. Split on whitespace; apply the per-token rules above using the existing `CronParts` enum. Weekday: accept `*` or `/^\d+$/`-per-item comma list with each item 0–6.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run libs/ui-components/src/utils/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ui-components/src/utils/time.ts libs/ui-components/src/utils/time.test.ts
git commit -m "feat(update-policy): add isUpdateCronRepresentable predicate"
```

---

### Task 2: Form model + load preserve raw cron

**Files:**
- Modify: `libs/ui-components/src/types/deviceSpec.ts:344-359` (`UpdatePolicyForm`)
- Modify: `libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.ts:70-104` (`getUpdatePolicyValues`)
- Test: `libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.test.ts` (create)

**Interfaces:**
- Consumes: `isUpdateCronRepresentable` (Task 1).
- Produces: `UpdatePolicyForm` gains `downloadIsAdvanced: boolean`, `installIsAdvanced: boolean`, `downloadCron: string`, `installCron: string`. `getUpdatePolicyValues` populates them: `<block>IsAdvanced = !isUpdateCronRepresentable(at)`, `<block>Cron = at ?? ''`.

- [ ] **Step 1: Write failing tests** in `fleetSpecUtils.test.ts` for `getUpdatePolicyValues`:
  - Representable download `{ downloadSchedule: { at: '0 2 * * *' } }` → `downloadIsAdvanced === false`, `downloadCron === '0 2 * * *'`, `downloadStartsAt === '02:00'`.
  - Complex download `{ downloadSchedule: { at: '0 0-9 * * *' } }` → `downloadIsAdvanced === true`, `downloadCron === '0 0-9 * * *'`.
  - `getUpdatePolicyValues(undefined)` → `downloadIsAdvanced === false`, `installIsAdvanced === false`, `downloadCron === ''`, `installCron === ''`, `isCustomized === false`.
  - Differ case: download `'0 2 * * *'` (representable) + update `'0 2 * * 1-5'` (complex) → `downloadAndInstallDiffer === true`, `downloadIsAdvanced === false`, `installIsAdvanced === true`, `installCron === '0 2 * * 1-5'`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.test.ts`
Expected: FAIL (new fields undefined / TS errors).

- [ ] **Step 3: Add the four fields** to `UpdatePolicyForm` in `deviceSpec.ts`, then populate them in `getUpdatePolicyValues` using `isUpdateCronRepresentable` and the schedule `at` values. Leave the existing structured-field parsing unchanged.

- [ ] **Step 4: Run tests + type-check, verify pass**

Run: `npx vitest run libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.test.ts`
Expected: PASS. (Full `npm run test` type-check happens in Task 6; new required fields are supplied only via `getUpdatePolicyValues`, so other builders already compile.)

- [ ] **Step 5: Commit**

```bash
git add libs/ui-components/src/types/deviceSpec.ts libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.ts libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.test.ts
git commit -m "feat(update-policy): preserve raw cron and advanced flag on load"
```

---

### Task 3: Save raw cron verbatim + patch preservation

**Files:**
- Modify: `libs/ui-components/src/utils/patches/patch.ts:151-171` (`updatePolicyFormToApi`)
- Test: `libs/ui-components/src/utils/patches/patch.update-policy.test.ts` (create)

**Interfaces:**
- Consumes: `UpdatePolicyForm` fields from Task 2; `getUpdatePolicyPatches` (unchanged signature).
- Produces: `updatePolicyFormToApi` uses `form.downloadCron` / `form.installCron` verbatim as the schedule `at` when the corresponding `<block>IsAdvanced` is true; otherwise `getUpdateCronExpression(...)` as today.

- [ ] **Step 1: Write failing tests** in `patch.update-policy.test.ts`. Build a `Required<UpdatePolicyForm>` via `getUpdatePolicyValues` from a `currentPolicy`, then call `getUpdatePolicyPatches('/spec/updatePolicy', currentPolicy, form)`:
  - Preservation: `currentPolicy.downloadSchedule.at = '0 0-9 * * *'` (complex, equal download+update); form loaded from it, unchanged → `getUpdatePolicyPatches(...)` returns `[]` (no schedule patch).
  - Advanced edit: same, but set `form.downloadCron = '0 0-12 * * *'` (and install mirrors, differ=false) → a `replace` patch on `/spec/updatePolicy` whose value's `downloadSchedule.at === '0 0-12 * * *'`.
  - Structured still works: representable current `'0 2 * * *'`, form with `downloadStartsAt = '03:00'` → patch with `at === '0 3 * * *'`.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run libs/ui-components/src/utils/patches/patch.update-policy.test.ts`
Expected: FAIL (advanced cron not emitted; preservation test sees a spurious patch).

- [ ] **Step 3: Implement the advanced branch** in `updatePolicyFormToApi`: for each block, `at = form.<block>IsAdvanced ? form.<block>Cron : getUpdateCronExpression(...)`. No change needed in `getUpdatePolicyPatches` — preservation follows from `schedulesAreEqual` on identical `at` strings.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run libs/ui-components/src/utils/patches/patch.update-policy.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ui-components/src/utils/patches/patch.ts libs/ui-components/src/utils/patches/patch.update-policy.test.ts
git commit -m "feat(update-policy): emit raw cron verbatim for advanced blocks"
```

---

### Task 4: Toggle-transition helpers

**Files:**
- Modify: `libs/ui-components/src/utils/time.ts`
- Test: `libs/ui-components/src/utils/time.test.ts`

**Interfaces:**
- Consumes: existing `getTime`, `getWeekDays`, `getEndTime`, `getUpdateCronExpression`.
- Produces:
  - `cronToStructuredSchedule(cron: string, startGraceDuration?: string): { startsAt: string; endsAt: string; weekDays: boolean[]; scheduleMode: UpdateScheduleMode }` — derives structured values from a representable cron (compose existing helpers).
  - `structuredToCron(startsAt: string, scheduleMode: UpdateScheduleMode, weekDays: boolean[]): string` — thin alias/re-export of `getUpdateCronExpression` for naming symmetry (used when toggling advanced ON to seed the cron field).

- [ ] **Step 1: Write failing tests** in `time.test.ts`:
  - `cronToStructuredSchedule('30 14 * * 1,3,5')` → `{ startsAt: '14:30', scheduleMode: Weekly, weekDays: [F,T,F,T,F,T,F] }` (Sun..Sat indices; Mon/Wed/Fri true).
  - `cronToStructuredSchedule('0 2 * * *')` → `scheduleMode: Daily`, `weekDays` all true, `startsAt: '02:00'`.
  - `structuredToCron('02:00', Daily, [all true])` → `'0 2 * * 0,1,2,3,4,5,6'` (equals current `getUpdateCronExpression` output).

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run libs/ui-components/src/utils/time.test.ts`
Expected: FAIL (functions not exported).

- [ ] **Step 3: Implement both helpers** in `time.ts` by composing the existing parsers (`getTime`, `getWeekDays`, `getEndTime`) and `getUpdateCronExpression`.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run libs/ui-components/src/utils/time.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ui-components/src/utils/time.ts libs/ui-components/src/utils/time.test.ts
git commit -m "feat(update-policy): add cron<->structured toggle helpers"
```

---

### Task 5: Advanced-cron validation

**Files:**
- Modify: `libs/ui-components/src/components/form/validations.ts:1378-1395` (`validUpdatePolicySchema`) and nearby helpers
- Test: `libs/ui-components/src/components/form/validations.test.ts` (create, or add to existing validations test if present)

**Interfaces:**
- Consumes: `UpdatePolicyForm` fields from Task 2.
- Produces: `validUpdatePolicySchema` validates `downloadCron`/`installCron` when the block is advanced and the policy is customized (required + permissive 5-field well-formedness); skips `startsAt`/`weekDays` validation for an advanced block.

- [ ] **Step 1: Write failing tests** validating a form object against `validUpdatePolicySchema(t)` (use `.validate` / `.isValid`):
  - Advanced block with `downloadCron = '0 0-9 * * *'` and `isCustomized`/advanced true → valid (no `startsAt`/`weekDays` error).
  - Advanced block with `downloadCron = 'not a cron'` → invalid.
  - Advanced block with `downloadCron = ''` → invalid (required).
  - Non-advanced block → existing structured rules still apply (a Weekly block with no weekdays selected is invalid).

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run libs/ui-components/src/components/form/validations.test.ts`
Expected: FAIL (cron not validated).

- [ ] **Step 3: Implement** a permissive cron test (exactly 5 non-empty tokens, each matching `/^[A-Za-z0-9*,/-]+$/`) and wire it into `validUpdatePolicySchema` with Yup `.when('<block>IsAdvanced', ...)`, gating the structured-field schemas on `!advanced`. Add the new form fields (`downloadIsAdvanced`, `downloadCron`, etc.) to the Yup shape.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run libs/ui-components/src/components/form/validations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/ui-components/src/components/form/validations.ts libs/ui-components/src/components/form/validations.test.ts
git commit -m "feat(update-policy): validate advanced cron field"
```

---

### Task 6: UI toggle + raw cron field + i18n + full verification

**Files:**
- Modify: `libs/ui-components/src/components/Fleet/CreateFleet/steps/UpdateStepUpdatePolicy.tsx` (shared by both wizards)
- Modify: `libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.ts` (`getDownloadPolicyText` / `getInstallPolicyText`) and `libs/ui-components/src/utils/time.ts` (`getScheduleUpdateText`) for advanced display
- Modify: `libs/i18n/locales/en/translation.json` (generated via `npm run i18n`)

**Interfaces:**
- Consumes: `isUpdateCronRepresentable` (Task 1), `cronToStructuredSchedule` / `structuredToCron` (Task 4), form fields (Task 2).

- [ ] **Step 1: Advanced review display.** Extend `getDownloadPolicyText` / `getInstallPolicyText` to, when the block is advanced, return cron-based text — e.g. `t('Cron: {{ cron }} ({{ timeZone }})', { cron, timeZone })` plus the existing grace suffix — instead of the structured "Daily/Weekly…" text. Add a corresponding advanced branch (or a sibling helper) rather than feeding the raw cron through `getScheduleUpdateText`'s structured logic.

- [ ] **Step 2: Add the toggle + field** in `ScheduleBlock` (`UpdateStepUpdatePolicy.tsx`):
  - An "Edit as cron expression" control (match surrounding PatternFly controls — a `Checkbox`/`Switch`) bound to `updatePolicy.<block>IsAdvanced` via Formik.
  - When advanced: render a `TextField` for `updatePolicy.<block>Cron` (placeholder e.g. `0 2 * * 1-5`, helper text describing a 5-field cron); hide the time/mode/weekday controls; keep grace-duration and timezone controls.
  - Toggle guards via `setFieldValue`: ON→OFF allowed only if `isUpdateCronRepresentable(<block>Cron)` — then seed structured fields from `cronToStructuredSchedule`; if not representable, disable the "off" direction with helper/tooltip text `t('This schedule uses an advanced cron expression that can't be shown in the simple editor.')`. OFF→ON always allowed — seed `<block>Cron` from `structuredToCron(current structured values)`.

- [ ] **Step 3: Regenerate i18n**

Run: `npm run i18n`
Expected: `translation.json` updated with new keys, no errors.

- [ ] **Step 4: Full verification**

Run: `npm run test` then `npm run lint`
Expected: both PASS (type-check clean, all unit tests green, i18n check clean).

- [ ] **Step 5: Manual smoke (document result).** With a complex-cron fixture (`0 0-9 * * *`): open the wizard → block shows advanced field with the real cron, toggle locked off; edit an unrelated field + submit → resulting patch leaves `downloadSchedule.at` unchanged.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(update-policy): advanced cron toggle, field, review display, i18n"
```

---

## Notes for the executor

- Run tests with `npx vitest run <path>` for a single file; `npm run test` runs the full type-check + suite (slower) and is the gate in Task 6.
- Keep all new user-facing strings inside `t('literal text', { vars })` so i18n extraction works.
- Do not restructure unrelated code; follow existing patterns in each file.
