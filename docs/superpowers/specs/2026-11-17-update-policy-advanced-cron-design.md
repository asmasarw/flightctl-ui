# Design: Preserve complex update-policy cron expressions via an advanced cron field

Date: 2026-11-17
Status: Approved (2026-11-17) — Open decision resolved as Option 1
Jira: "UI wizard can overwrite complex update-policy cron expressions on unrelated edits"

## Intent and why

The Fleet and Device wizards model a maintenance window as structured controls
(a single start time, a Daily/Weekly mode, and weekday checkboxes). The cron
string stored by the API is lossily parsed *into* those controls on load and
regenerated *from scratch* on save. Any cron the controls can't express — ranges
(`0-9`), steps (`*/2`), weekday ranges (`1-5`), or non-`*` month/day-of-month —
collapses to defaults on load and is silently overwritten on the next submit,
even when the user edited an unrelated field.

This causes two harms:

1. **Silent visual corruption** — the form shows a schedule that isn't the real
   one (e.g. `0 0-9 * * *` shows as "Daily from 00:00").
2. **Silent data loss** — on submit, `getUpdatePolicyPatches` emits a `replace`
   patch that clobbers the real cron with the simplified regenerated one.

We want: never lose a cron the structured form can't represent, show the user
what's really configured, and let advanced users view/edit the raw cron
deliberately.

## Root cause (confirmed)

- `getTime` (`utils/time.ts`) returns `defaultStartTime` ("00:00") when the
  minute/hour fields aren't plain integers.
- `getWeekDays` (`utils/time.ts`) `Number()`-parses the weekday field; ranges/steps
  become `NaN` → all days unselected (or `*` → all days / Daily).
- `getUpdateCronExpression` (`utils/time.ts`) can only emit
  `${minutes} ${hours} * * ${weekdayList}` — ranges/steps are structurally
  impossible.
- `getUpdatePolicyPatches` (`utils/patches/patch.ts`) compares the regenerated
  `at` string against the stored one via `schedulesAreEqual`; because the
  round-trip is lossy, they always differ and a clobbering patch is produced.

Both wizards share one pipeline: `getUpdatePolicyValues` (load,
`Fleet/CreateFleet/fleetSpecUtils.ts`), `UpdateStepUpdatePolicy` (shared UI),
and `getUpdatePolicyPatches` (save). One set of changes fixes both.

## Goals

- An update-policy cron that the structured form cannot represent is **preserved
  byte-for-byte** unless the user deliberately changes it.
- Unrelated edits to a Fleet/Device **never** emit a patch against
  `downloadSchedule`/`updateSchedule` when the schedule wasn't touched.
- The form **shows the real cron** for non-representable schedules instead of a
  misleading structured view.
- Advanced users can **opt into** editing a schedule as a raw cron expression,
  and switch back to the structured editor when the cron is representable
  (approach B).
- Cover the load/save/patch logic and the representability check with Vitest unit
  tests.

## Non-goals / anti-goals

- **Not** building a full cron builder, cron-to-English preview, or validating
  that a cron is "sensible" (approach C was rejected). We validate only that the
  expression is a syntactically well-formed 5-field cron.
- **Not** changing the structured editor's behavior for representable schedules.
- **Not** fixing the pre-existing, semantically-lossless normalization where a
  stored `0 0 * * *` (weekday `*`) is rewritten to `0 0 * * 0,1,2,3,4,5,6` on
  save. That is not data loss and is out of scope (noted as a known wrinkle
  below).
- **Not** adding Cypress specs (per AGENTS.md). New coverage is Vitest only.
- **Not** editing generated files (`libs/types`, `translation.json`); new strings
  are added in source and `npm run i18n` regenerates the catalog.

## Constraints

- `metadata.name` convention and generated-file rules per AGENTS.md.
- `UpdatePolicyForm` is consumed as `Required<UpdatePolicyForm>` in save paths, so
  every new field must be populated in all initial-value builders
  (`fleetSpecUtils.getUpdatePolicyValues`, `Fleet/CreateFleet/utils.ts` defaults,
  Device `EditDeviceWizard`).
- PatternFly v6 components; reuse existing form wrappers (`TextField`,
  `CheckboxField`, `FormGroupWithHelperText`).

## Approaches considered

- **A. Auto-fallback only.** Swap to a raw cron field only when the loaded cron is
  non-representable; no opt-in. Fixes data loss but gives advanced users no way to
  author a raw cron for an otherwise-simple schedule. Rejected: doesn't match the
  teammate's "show a field so advanced users can manage it if wanted."
- **B. Auto-fallback + explicit per-block toggle (CHOSEN).** Same auto-fallback,
  plus an "Edit as cron expression" toggle on each schedule block. Non-representable
  crons force the toggle on and lock it. Directly implements the teammate's
  suggestion; keeps the simple path untouched.
- **C. Cron-first unified field.** Replace the structured controls entirely with a
  cron field + live preview. Rejected: large change, regresses the friendly common
  case, needs full UX redesign — overkill for this bug.

**Decision: B.**

## Design

### Representability predicate (`utils/time.ts`)

Add `isUpdateCronRepresentable(at?: string): boolean`. Returns `true` when `at` is
empty/undefined (the "not set" default case) or matches exactly the shape
`getUpdateCronExpression` can round-trip:

- exactly 5 whitespace-separated tokens;
- minutes: integer 0–59; hours: integer 0–23;
- day-of-month token === `*`; month token === `*`;
- weekday token === `*`, or a comma-separated list of integers each 0–6 (no
  ranges, steps, or names).

This predicate is the single source of truth used by both load and the UI
toggle-lock.

> Known wrinkle (out of scope): a stored `0 0 * * *` is representable but
> `getUpdateCronExpression` emits `0 0 * * 0,1,2,3,4,5,6`, so a representable
> round-trip can still produce a semantically-identical but textually-different
> `at`. This is pre-existing, lossless, and not the reported bug. Left as-is.

### Form model (`types/deviceSpec.ts`)

Extend `UpdatePolicyForm` with, per block:

- `downloadIsAdvanced: boolean`, `installIsAdvanced: boolean` — block is in
  raw-cron mode.
- `downloadCron: string`, `installCron: string` — the raw `at` expression used
  when the block is advanced (also seeded from structured values when toggling
  on).

### Load (`fleetSpecUtils.getUpdatePolicyValues`)

For each schedule's `at`:

- Compute `isAdvanced = !isUpdateCronRepresentable(at)`.
- Set `cron = at ?? ''` (preserve the original string verbatim).
- Structured fields (`startsAt`, `weekDays`, `scheduleMode`, `endsAt`) are parsed
  as today; when advanced they are defaults and simply unused while the block is
  in advanced mode.

`downloadAndInstallDiffer` continues to come from `schedulesAreEqual`, which
compares `at` strings and works unchanged for raw crons.

### Save (`patch.updatePolicyFormToApi`)

For each block: if `isAdvanced`, use `form.<block>Cron` verbatim as `at`;
otherwise `getUpdateCronExpression(...)` as today. `startGraceDuration` and
`timeZone` are handled as today in both modes.

### Patch preservation (`patch.getUpdatePolicyPatches`)

No structural change needed: because an untouched advanced block emits the
original `at` verbatim, `schedulesAreEqual(current, new)` is true and no patch is
produced. This is the core data-loss fix. Existing structured-edit patch logic is
unchanged.

### UI — `UpdateStepUpdatePolicy.tsx` (shared by both wizards)

Per `ScheduleBlock`, add an "Edit as cron expression" toggle
(`updatePolicy.<block>IsAdvanced`):

- **Advanced on:** render a `TextField` bound to `updatePolicy.<block>Cron`
  (placeholder e.g. `0 2 * * 1-5`, helper text explaining 5-field cron). The
  grace-duration and timezone controls remain visible. The time/mode/weekday
  controls are hidden.
- **Advanced off:** current structured controls.
- **Toggle guard:**
  - OFF → ON: always allowed. Seed `<block>Cron` from
    `getUpdateCronExpression(current structured values)` so the field isn't empty.
  - ON → OFF: allowed only if the current `<block>Cron` is representable; then
    seed the structured fields from it (`getTime`/`getWeekDays`/`getEndTime`). If
    not representable, the toggle is disabled (locked on) with a tooltip/helper:
    "This schedule uses an advanced cron expression that can't be shown in the
    simple editor."

### Backend cron grammar (authoritative)

Confirmed against `flightctl` `api/core/v1beta1/validation.go`:
`UpdateSchedule.Validate()` parses `At` with
`cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)`
(`github.com/robfig/cron/v3`). This means the backend accepts a **standard
5-field cron** — `*`, lists `,`, ranges `-`, steps `/`, numerics, and month/day
**names** (e.g. `MON-FRI`, `JAN`) — with **no seconds field and no `@macros`**.
The backend additionally rejects a `startGraceDuration` that exceeds the interval
between scheduled times, and is the authoritative validator (returns
`invalid cron schedule: …`).

Implication for the client: do **not** hand-roll a strict regex that could reject
legitimate robfig expressions. The advanced-field validator is a **permissive
well-formedness check** (see below); deep validity is left to the backend.

### Validation (`components/form/validations.ts`)

Add a conditional to `validUpdatePolicySchema`:

- When `<block>IsAdvanced` is true and the policy is customized: `<block>Cron` is
  required and must pass a **permissive 5-field well-formedness check** — exactly
  5 non-empty whitespace-separated tokens, each matching the robfig-compatible
  charset (`[A-Za-z0-9*,/-]+`). This deliberately accepts names/ranges/steps and
  defers deep validation to the backend. The structured-field validations
  (`startsAt`, `weekDays`) are skipped for that block.
- When advanced is false: validate as today.

### Review display (`fleetSpecUtils.getDownloadPolicyText` / `getInstallPolicyText`
and `getScheduleUpdateText`)

When a block is advanced, show the raw cron (e.g.
`Cron: 0 0-9 * * * (timezone), grace 30m`) instead of the "Daily/Weekly from…"
text. `ReviewUpdatePolicy.tsx` calls these helpers and needs no change beyond the
helpers handling the advanced case.

### Combined block when `downloadAndInstallDiffer === false` (builder call)

When the two schedules are equal only the Download block renders and governs
both; on save `updatePolicyFormToApi` copies download→update as today. Decision:
the **Download** flag/field (`downloadIsAdvanced`/`downloadCron`) drives the
single combined block; `installIsAdvanced`/`installCron` are ignored while
`differ` is false (consistent with the existing copy-on-save behavior). At load,
`isAdvanced`/`cron` are still computed per schedule, but when the schedules are
equal both resolve to the same values, so nothing special is needed. When the
user checks "use different schedules," the install block initializes from its
loaded values exactly as the structured fields do today (for an
originally-equal schedule that means it mirrors the download block, advanced
state included). This matches current UX and avoids a locked-empty install
state.

### Initial-value builders

Populate the new fields (`<block>IsAdvanced: false`, `<block>Cron: ''`) in every
place that builds `UpdatePolicyForm`/`Required<UpdatePolicyForm>`:
`getUpdatePolicyValues`, the Fleet create defaults (`Fleet/CreateFleet/utils.ts`),
and the Device wizard initial values.

## Tests (Vitest)

- `utils/time.test.ts` (new): `isUpdateCronRepresentable` across representable and
  non-representable inputs (ranges, steps, weekday ranges, non-`*` month/dom,
  empty); confirm `getTime`/`getWeekDays`/`getUpdateCronExpression` behavior is
  documented by tests.
- `utils/patches/patch.update-policy.test.ts` (new): a non-representable cron with
  an unrelated form change produces **no** schedule patch; an advanced-cron edit
  produces a `replace`; structured edits still work; download/install differ and
  mode-switch cases.
- `Fleet/CreateFleet/fleetSpecUtils` coverage for `getUpdatePolicyValues`: sets
  `isAdvanced`/`cron` correctly for representable vs non-representable; review text
  for advanced blocks shows the raw cron.

## What's left to the builder

- Exact wording of new UI strings and helper/tooltip text (keep clear, run
  `npm run i18n`).
- The precise cron-validation regex (basic well-formedness; not semantic).
- Component placement/styling of the toggle within `ScheduleBlock` (follow
  existing PatternFly patterns in the file).
- Whether the toggle is a PatternFly `Switch` or a `Checkbox` (match surrounding
  controls).

## Open decision for the approver

**Does Goal #2 ("unrelated edits never emit a schedule patch when the schedule
wasn't touched") have to hold for *representable* `*`-weekday schedules too?**

The chosen preserve-verbatim design suppresses spurious patches for
non-representable crons (the reported data-loss bug). But a stored, representable
`0 0 * * *` is still regenerated as `0 0 * * 0,1,2,3,4,5,6` on save — a
semantically identical, lossless rewrite — so an unrelated edit to such a
fleet/device *does* still emit one cosmetic schedule patch.

- **Option 1 (current design): leave it out of scope.** The Jira is about
  *complex* expressions losing data; this rewrite loses nothing. Smallest change.
- **Option 2: also fix the normalization.** Make `getUpdateCronExpression` emit
  `*` for the weekday field when all seven days are selected, so representable
  schedules round-trip byte-for-byte and Goal #2 holds literally. Cheap (one
  function + a test), but changes existing output (an "all days, Weekly" schedule
  would reload as "Daily") and may touch existing expectations.

Recommendation: **Option 1** unless the stakeholder wants "unrelated edits never
touch the schedule" to be literally true, in which case Option 2 is a cheap
add-on.

**Decision (2026-11-17): Option 1.** The representable `*`-weekday cosmetic
rewrite stays out of scope; only the non-representable data-loss case is fixed.

## Files touched

- `libs/ui-components/src/types/deviceSpec.ts`
- `libs/ui-components/src/utils/time.ts`
- `libs/ui-components/src/utils/patches/patch.ts`
- `libs/ui-components/src/components/Fleet/CreateFleet/fleetSpecUtils.ts`
- `libs/ui-components/src/components/Fleet/CreateFleet/utils.ts`
- `libs/ui-components/src/components/Fleet/CreateFleet/steps/UpdateStepUpdatePolicy.tsx`
- `libs/ui-components/src/components/Device/EditDeviceWizard/EditDeviceWizard.tsx`
- `libs/ui-components/src/components/form/validations.ts`
- `libs/ui-components/src/components/Device/EditDeviceWizard/steps/ReviewUpdatePolicy.tsx` (only if helper signatures change)
- New Vitest test files (above)
- `libs/i18n/locales/en/translation.json` via `npm run i18n` (generated)
