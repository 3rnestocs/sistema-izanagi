# Registrar Suceso — Reward Field & Display Improvements

## Goal
1. Align `/registrar_suceso` subcommand option fields with the actual reward model of each activity type: remove dead inputs, add missing ones, and support hybrid AUTO/MANUAL approval for `balance_general`.
2. Show a detailed reward breakdown in embeds: base value + trait bonus (with trait name) when multipliers apply.
3. Skip zero-value reward lines entirely.
4. Fix two bugs where traits are incorrectly applied to activity rewards.

---

## Part A — Subcommand Field Changes

### Changes Overview

| # | Subcommand | Action |
|---|---|---|
| 1 | `desarrollo_personal` | No change (AUTO, rank-based EXP) |
| 2 | `logro_general` | Keep exp/pr/ryou fields; improve description to clarify they only apply to exception logros |
| 3 | `logro_reputacion` | **Remove** exp/pr/ryou options (all entries have fixed rewards, no exceptions) |
| 4 | `logro_saga` | No change (already has EXP req + PR/Ryou optional) |
| 5 | `timeskip` | **Add** RC, Cupos, BTS optional integer fields |
| 6 | `balance_general` | **Add** EXP, PR, Ryou, RC, Cupos, BTS optional integer fields; hybrid approval |

### 2. `logro_general` — Clarify manual-exception fields

**File:** `src/commands/registro-sucesos/registrar_suceso.ts`

- Update the `.setDescription()` of the `exp`, `pr`, `ryou` options to make it obvious they only matter for logros marked as excepción manual (e.g. "Forma un grupo", "Maestro especialista", "Cientifico de elite").
- Suggested descriptions:
  - `exp`: `"EXP (solo para logros de excepción manual)"`
  - `pr`: `"PR (solo para logros de excepción manual)"`
  - `ryou`: `"Ryou (solo para logros de excepción manual)"`

### 3. `logro_reputacion` — Remove dead fields

**File:** `src/commands/registro-sucesos/registrar_suceso.ts`

- Remove the three `addIntegerOption` calls for `exp`, `pr`, `ryou` from the `logro_reputacion` subcommand builder (lines 289-297).
- No service-layer change needed — the generic `claimedExp/claimedPr/claimedRyou` read at execution still works; they'll just always be `null`.

### 5. `timeskip` — Add RC, Cupos, BTS fields

**File:** `src/commands/registro-sucesos/registrar_suceso.ts`

- Add three optional `addIntegerOption` calls after the existing `ryou` option:
  - `rc` — `"RC (opcional)"`, minValue 0
  - `cupos` — `"Cupos de habilidad (opcional)"`, minValue 0
  - `bts` — `"Bonos de Técnica Superior (opcional)"`, minValue 0

### 6. `balance_general` — Add reward fields + hybrid approval

**File:** `src/commands/registro-sucesos/registrar_suceso.ts`

- Add six optional `addIntegerOption` calls:
  - `exp` — `"EXP (opcional)"`, minValue 0
  - `pr` — `"PR (opcional)"`, minValue 0
  - `ryou` — `"Ryou (opcional)"`, minValue 0
  - `rc` — `"RC (opcional)"`, minValue 0
  - `cupos` — `"Cupos de habilidad (opcional)"`, minValue 0
  - `bts` — `"Bonos de Técnica Superior (opcional)"`, minValue 0

**Hybrid approval logic** (in `execute`):
- If **any** of the six reward fields is provided → treat as MANUAL: persist claimed values, bypass auto-approval, emit pending embed with "Recompensa Reclamada".
- If **none** provided and `nombre_actividad` matched a catalog entry → keep current AUTO flow (standard or historical narration rewards).
- If **none** provided and no catalog match → treat as zero-reward MANUAL (current behavior for non-catalog balance general without manual fields).

---

## Part B — Trait Multiplier Bugfixes

### Bug 1: Tonto `expMultiplier: 2` applied as reward gain

**Location:** `RewardCalculatorService.applyTraitMultipliers` (line ~305)

**Problem:** The method reads `mechanics.expMultiplier` and applies it as a reward multiplier. For Tonto (`expMultiplier: 2`), this **doubles EXP gains** on every activity. But Tonto's actual effect is: *"Duplica la EXP necesaria para legalizar experimentos y la Tienda de EXP"* — it's a **cost** multiplier, not a reward multiplier.

**Fix:** Rename the field in `traits.json` from `expMultiplier` to `expCostMultiplier` for Tonto. Update `applyTraitMultipliers` to **only** read `mechanics.expRewardMultiplier` (or keep `expMultiplier` but exclude Tonto via the new field name). The cost multiplier would be consumed by the experiment/shop services instead.

**Affected trait data:**
```json
// Before (traits.json)
{"name": "Tonto", ..., "mechanics": {"expMultiplier": 2}}

// After
{"name": "Tonto", ..., "mechanics": {"expCostMultiplier": 2}}
```

**Traits that legitimately use `expMultiplier` as a reward multiplier** (keep as-is):
- Presteza: `expMultiplier: 1.5` (+50% EXP gain) ✅
- Arrepentimiento: `expMultiplier: 0.5` (-50% EXP gain) ✅

### Bug 2: Ambicioso `multiplierGanancia` applied to activity Ryou

**Location:** `RewardCalculatorService.applyTraitMultipliers` (line ~297)

**Problem:** The method reads `trait.multiplierGanancia` and uses it as `ryouMultiplier` on every activity reward. For Ambicioso (`multiplierGanancia: 1.5`), this incorrectly gives +50% Ryou on all activities. But Ambicioso's actual effect is: *"Cada lunes aumentas x1.5 la cantidad de Ryou que tengas en la ficha"* — it only applies to the Monday salary cron, not activity rewards.

**Fix:** Remove `multiplierGanancia` from `applyTraitMultipliers` entirely. This field should only be consumed by the Monday salary/cron job logic.

```ts
// Remove from applyTraitMultipliers:
if (trait.multiplierGanancia && typeof trait.multiplierGanancia === 'number') {
  ryouMultiplier *= trait.multiplierGanancia;  // DELETE
}
```

No Ryou reward multiplier traits exist for activity rewards currently.

### Correct trait-to-activity-reward mapping (after fixes)

| Trait | Mechanics Field | Multiplier | Reward Affected |
|---|---|---|---|
| Presteza | `expMultiplier` | 1.5x | +50% EXP |
| Arrepentimiento | `expMultiplier` | 0.5x | -50% EXP |
| Leyenda | `prMultiplier` | 1.25x | +25% PR |
| Cínico | `prMultiplier` | 0.9x | -10% PR |
| Presionado | `prMultiplier` | 0.75x | -25% PR |

Tonto and Ambicioso are **excluded** from this pipeline.

---

## Part C — Detailed Reward Breakdown in Embeds

### New return type: `DetailedRewardBreakdown`

**File:** `src/config/activityRewards.ts` (or new type file)

```ts
interface RewardDetail {
  base: number;
  bonus: number;    // base * multiplier - base (can be negative for debuffs)
  total: number;    // Math.floor(base * multiplier)
  source?: string;  // Trait name, e.g. "Presteza", "Leyenda"
}

interface DetailedRewardBreakdown {
  exp:  RewardDetail;
  pr:   RewardDetail;
  ryou: RewardDetail;
  rc?:  number;
  cupos?: number;
  bts?: number;
}
```

### Service change: `RewardCalculatorService`

Add a new public method `calculateDetailedRewards(character, activity)` that:
1. Computes base rewards (same logic as `calculateRewards`).
2. Extracts per-resource multipliers and source trait names from `character.traits`.
3. Returns `DetailedRewardBreakdown` with base, bonus, total, and source for each resource.

The existing `calculateRewards` can delegate to this method and flatten the result, preserving backward compatibility.

### Embed format

**When a trait multiplier applies** (bonus ≠ 0):
```
✨ EXP: 25 (Base) + 13 (Presteza) [38 EXP Totales]
🏆 PR: 50 (Base) + 13 (Leyenda) [63 PR Totales]
```

**When a trait gives a debuff** (bonus < 0):
```
✨ EXP: 25 (Base) - 13 (Arrepentimiento) [12 EXP Totales]
🏆 PR: 50 (Base) - 13 (Presionado) [37 PR Totales]
```

**When no multiplier applies** (bonus = 0):
```
✨ EXP: +25
🏆 PR: +50
```

**When value is 0:** Line is **omitted entirely**.

This applies to both auto-approved and pending embeds.

### Zero-value line suppression

Currently EXP/PR/Ryou always display even when 0, while RC/Cupos already skip when 0. Unify behavior: **skip any reward line where total = 0**, for all resource types (EXP, PR, Ryou, RC, Cupos, BTS).

---

## Schema Migration

**File:** `prisma/schema.prisma` — model `ActivityRecord`

Add three nullable Int columns after `claimedRyou`:

```prisma
claimedRc    Int?
claimedCupos Int?
claimedBts   Int?
```

Then run `npx prisma migrate dev --name add_claimed_rc_cupos_bts`.

---

## Service Layer Updates

### `registrar_suceso.ts` — execute handler

1. Read the three new options (`rc`, `cupos`, `bts`) from `interaction.options.getInteger(...)`.
2. Include them in `activityCreateData` when the activity is manual-tier (or hybrid-manual for balance_general).
3. Use `calculateDetailedRewards` instead of `calculateRewards` for embed display.
4. Build reward lines using the detailed breakdown format (base + bonus with trait name).
5. Skip any line where total = 0.
6. For the hybrid `balance_general` check: determine `isManualOverride` = any of `[claimedExp, claimedPr, claimedRyou, claimedRc, claimedCupos, claimedBts]` is non-null. If true, skip auto-approval even though `ACTIVITY_TIER` says AUTO.

### `ActivityApprovalService.ts` — approveActivityByMessageId

1. Extend the rewards object type to include `bts?: number`.
2. When reading claimed values, also read `claimedRc`, `claimedCupos`, `claimedBts`:
   ```ts
   rewards = {
     exp: activityRecord.claimedExp ?? 0,
     pr: activityRecord.claimedPr ?? 0,
     ryou: activityRecord.claimedRyou ?? 0,
     rc: activityRecord.claimedRc ?? 0,
     cupos: activityRecord.claimedCupos ?? 0,
     bts: activityRecord.claimedBts ?? 0
   };
   ```
3. Apply `bts` increment to `character.update` alongside `rc`/`cupos`.
4. Include `deltaBts` in audit log data.
5. Update the zero-reward guard to also check `bts`.

### `RewardCalculatorService.ts`

1. **Remove** `multiplierGanancia` from `applyTraitMultipliers` (Bug 2 fix).
2. **Add** `calculateDetailedRewards` method returning `DetailedRewardBreakdown`.
3. Refactor `applyTraitMultipliers` to ignore `expCostMultiplier` (only read `expMultiplier` for reward context).

### `RewardBreakdown` type (`src/config/activityRewards.ts`)

- Add `bts?: number` to `RewardBreakdown` interface.
- Add `DetailedRewardBreakdown` and `RewardDetail` types.

### `traits.json` (seed data)

- Rename Tonto's `"expMultiplier": 2` → `"expCostMultiplier": 2`.

---

## Files Touched (Summary)

| File | Changes |
|---|---|
| `prisma/schema.prisma` | Add `claimedRc`, `claimedCupos`, `claimedBts` to `ActivityRecord` |
| `prisma/seed-data/traits.json` | Rename Tonto's `expMultiplier` → `expCostMultiplier` |
| `src/commands/registro-sucesos/registrar_suceso.ts` | Modify subcommand builders + execute handler + embed formatting |
| `src/services/RewardCalculatorService.ts` | Remove Ambicioso from reward path, add `calculateDetailedRewards`, ignore `expCostMultiplier` |
| `src/services/ActivityApprovalService.ts` | Read and apply new claimed fields on approval |
| `src/config/activityRewards.ts` | Add `bts` to `RewardBreakdown`, add `DetailedRewardBreakdown` type |

---

## Edge Cases

- **Discord option limit:** Each subcommand supports up to 25 options. `balance_general` will have 9 options (fecha, evidencia, nombre_actividad, exp, pr, ryou, rc, cupos, bts) — well within limit.
- **Backward compatibility:** Existing `ActivityRecord` rows will have `NULL` for the three new columns — handled by the `?? 0` fallback.
- **BTS in auto-approved path:** No current AUTO activity awards BTS, so no changes needed in `calculateRewards` unless a future activity type adds it.
- **Tonto rename ripple:** Any code reading `mechanics.expMultiplier` for cost purposes (experiment service, EXP shop) must be updated to read `expCostMultiplier` instead.
- **Multiple EXP traits:** If a character somehow has both Presteza and Arrepentimiento (they're incompatible, but defensively), multipliers stack multiplicatively: `1.5 * 0.5 = 0.75x`. The `source` field in the embed would show the dominant trait or combine names.
- **Claimed rewards + trait display:** For MANUAL activities where the user provides claimed values, the trait breakdown does **not** apply — claimed values are displayed as-is. Traits only affect AUTO-calculated rewards.
