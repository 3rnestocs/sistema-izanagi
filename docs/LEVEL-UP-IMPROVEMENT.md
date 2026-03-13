# Level-Up / Ascenso Improvement Plan

## Problem Summary

1. **Incorrect optional requirement thresholds across all levels.** Every level checks `if (optionalMet < 1)` (requiring only 1 optional to pass). Rules demand 2 or 3 depending on the level. This makes promotions far too easy.

2. **EXP/SP mismatches in `StatValidatorService.LEVEL_PROGRESSION`:**
   - B2: code says 325 EXP, rules say 350 EXP.
   - B3: code says 400 EXP, rules say 450 EXP.
   - S1: code says 1 SP, rules say 2 SP.

3. **Combat rank requirement for A1 is wrong.** Rules say "ganar 3 vs potencial **B o superior**" (vs B/A/S wins). Code checks `combatWinsVsAOrHigher` (only A/S wins). The metric `combatWinsVsBOrHigher` doesn't exist in `buildMetrics`.

4. **Mission equivalence for B1 is overly generous.** Code counts A and S missions at 2x value. Rules only specify B missions count as 2 C. (Lower priority, but technically incorrect.)

5. **"Curar a N usuarios diferentes"** is pushed unconditionally to `manualRequirements` in 6 level-up cases (C2/C3, B1, B2/B3, A1, A2/A3, S2). Because `buildFailure` returns `passed: false` when `manualRequirements.length > 0`, **every promotion that includes this check is permanently blocked** — even when the character satisfies all automatic requirements.

6. The error message shown to users is the generic `"Cumple validaciones automáticas, pero faltan requisitos manuales."` — cryptic and uninformative when real failures also exist, and blocking when they don't.

7. `/validar_ascenso` exists as a read-only diagnostic but is redundant; its logic is already embedded in `/ascender`'s pre-check. It should be removed.

8. The success response in `/ascender` is a plain text reply. It should use a Discord rich embed and include the promotion date.

9. **Cures are not tracked.** Although `/registrar_suceso curacion` exists and activities are auto-approved, `buildMetrics` never counts them. This makes cure requirements permanently untraceable.

---

## Task 0 — Fix Data & Metrics Bugs

Before Tasks 1–4, fix the foundational bugs in `LevelUpService` and `StatValidatorService`.

### 0.1 — Correct Optional Thresholds in `LevelUpService`

**Problem:** Every level checks `if (optionalMet < 1)` (requires only 1), but rules demand 2 or 3.

**Per-level fixes:**

| Level | Current | Rules say | Fix |
|---|---|---|---|
| C1 | `< 1` | ≥ 2 of 4 optionals | Change to `if (optionalMet < 2)` |
| C2/C3 | `< 1` | ≥ 2 of 5 optionals | Change to `if (optionalMet < 2)` |
| B1 | `< 1` | ≥ 3 of 5 optionals | Change to `if (optionalMet < 3)` |
| B2/B3 | `< 1` | ≥ 2 of 5 optionals | Change to `if (optionalMet < 2)` |
| A1 | `< 1` | ≥ 3 of 5 optionals | Change to `if (optionalMet < 3)` |
| A2/A3 | `< 1` | ≥ 2 of 6 optionals | Change to `if (optionalMet < 2)` |
| S2 | `< 1` | ≥ 2 of 4 optionals | Change to `if (optionalMet < 2)` |

**Files changed:** `src/services/LevelUpService.ts` — lines 545, 574, 604, 634, 665, 696, 750.

### 0.2 — Fix EXP/SP Constants in `StatValidatorService`

**Problem:** Three values in `LEVEL_PROGRESSION` are wrong.

**Fixes:**

| Level | Current | Rules | Fix |
|---|---|---|---|
| B2 | 325 EXP | 350 EXP | Change line 51: `B2: { rankLetter: 'B', expRequired: 350, spGranted: 1 }` |
| B3 | 400 EXP | 450 EXP | Change line 52: `B3: { rankLetter: 'B', expRequired: 450, spGranted: 1 }` |
| S1 | 1 SP | 2 SP | Change line 56: `S1: { rankLetter: 'S', expRequired: 1000, spGranted: 2 }` |

**Files changed:** `src/services/StatValidatorService.ts` — lines 51, 52, 56.

### 0.3 — Add `combatWinsVsBOrHigher` Metric

**Problem:** A1 requires "ganar 3 vs potencial B o superior" (wins vs B/A/S). Code checks only A/S wins via `combatWinsVsAOrHigher`. The metric doesn't exist.

**Solution:**

In `buildMetrics` (after line 258), add:

```ts
const combatWinsVsBOrHigher = approved.filter((activity) => {
  if (!this.isCombatType(activity.type) || !this.isVictory(activity.result)) {
    return false;
  }
  const rank = activity.rank?.toUpperCase();
  return rank === 'B' || rank === 'A' || rank === 'S';
}).length;
```

Add to the return object (line 265+):

```ts
combatWinsVsBOrHigher,
```

**Update A1 check:** Change line 661 from `metrics.combatWinsVsAOrHigher >= 3` to `metrics.combatWinsVsBOrHigher >= 3`.

**Update `RequirementCheck.snapshot` interface:** Add `combatWinsVsBOrHigher: number;` to the snapshot type definition (after line 36).

**Files changed:** `src/services/LevelUpService.ts` — lines 12–39, 252–283, 661.

### 0.4 — Fix B1 Mission Equivalence (Optional)

**Problem:** Code counts A/S missions at 2x. Rules only specify B counts as 2 C.

**Decision:** This is a generous-but-defensible interpretation (A/S > C so counting higher ranks more is arguably fair). Prioritize this as **low priority** unless the user explicitly wants strict rule adherence.

**If fixing:** Change line 596 from `(metrics.missionB * 2) + (metrics.missionA * 2) + (metrics.missionS * 2)` to just `(metrics.missionB * 2)`, adjusting the threshold from 4 to something appropriate.

---

## Task 1 — Convert "Curar" to an Optional Requirement



### Current Behavior

Each affected case unconditionally pushes a `manualRequirements` entry:

```ts
manualRequirements.push('Manual parcial: curar a 5 usuarios diferentes no es trazable con el schema actual.');
```

This forces `passed: false` regardless of automatic checks.

### Desired Behavior

- Convert "curar a N usuarios diferentes" into an **optional requirement** in each case where it appears, merged into the existing `optionalMet` array.
- Rename the text from `"curar a N usuarios diferentes"` → `"Curar a N personajes"`.
- Since the system cannot track this, model it as an always-`false` optional entry. This way it appears in the optional pool and failure message so users know it exists, but it doesn't block promotion by itself — the user can satisfy another optional instead.
- **Remove the `manualRequirements.push(...)` line** for every "curar" entry.

### Files Changed

- `src/services/LevelUpService.ts` — 6 locations (lines 564, 590, 623, 650, 684, 741).

### Per-case changes

| Case | Current `manualRequirements` text | Action |
|---|---|---|
| C2/C3 (L564) | `curar a 2 usuarios diferentes` | Add `false` to `optionalMet`. Remove `manualRequirements.push(...)`. Update failure message to include "Curar a 2 personajes". |
| B1 (L590) | `curar a 5 usuarios diferentes` | Same pattern. "Curar a 5 personajes". |
| B2/B3 (L623) | `curar a 2 usuarios diferentes` | Same pattern. "Curar a 2 personajes". |
| A1 (L650) | `curar a 10 usuarios diferentes` | Same pattern. "Curar a 10 personajes". |
| A2/A3 (L684) | `curar a 2 usuarios diferentes` | Same pattern. "Curar a 2 personajes". |
| S2 (L741) | `curar a 5 usuarios diferentes` | Same pattern. "Curar a 5 personajes". |

### Example (B1)

Before:
```ts
manualRequirements.push('Manual parcial: curar a 5 usuarios diferentes no es trazable con el schema actual.');

const optionalMet = [
  metrics.narrations >= 3,
  metrics.highlightedNarrations >= 2,
  missionEquivalent >= 4,
  metrics.combatsVsCOrHigher >= 2
].filter(Boolean).length;

if (optionalMet < 1) {
  missingRequirements.push('Falta al menos 1 requisito adicional para B1 (narraciones, destacados, misiones equivalentes C o combates vs C+).');
}
```

After:
```ts
const optionalMet = [
  metrics.narrations >= 3,
  metrics.highlightedNarrations >= 2,
  missionEquivalent >= 4,
  metrics.combatsVsCOrHigher >= 2,
  false // Curar a 5 personajes (no trazable automáticamente)
].filter(Boolean).length;

if (optionalMet < 1) {
  missingRequirements.push('Falta al menos 1 requisito adicional para B1 (3 narraciones, 2 destacados, misiones equivalentes C ≥ 4, 2 combates vs C+ o curar a 5 personajes).');
}
```

### Note on A2/A3 "obtener 300 PR durante la gradación anterior"

Line 685 has a second `manualRequirements.push` for "300 PR durante la gradación anterior". This is genuinely untraceable without a per-period PR ledger and is **not** converted to optional — it remains as a `manualRequirements` entry. A2/A3 will still enter the `PENDING_STAFF` state (see Task 2) when all traceable checks pass, which is the correct behavior.

---

## Task 2 — Two-Phase Promotion Gate (Traceable vs. Manual) with Detailed Optional Progress

### Current Behavior

`LevelUpService.buildFailure` returns `passed: false` for both:
- Traceable failures (`missingRequirements` non-empty) — the user genuinely hasn't done enough.
- Untraceable manual requirements (`manualRequirements` non-empty, `missingRequirements` empty) — the user may have already met everything but the system can't verify it.

`ascender.ts` treats both identically: `throw new Error(...)` with a single cryptic line. Optional requirements are not broken down by progress.

### Desired Behavior

Introduce a **three-state result** from `checkLevelRequirements` / `checkRankRequirements`:

| State | Condition | Meaning |
|---|---|---|
| `APPROVED` | `missingRequirements` empty AND `manualRequirements` empty | Apply promotion immediately. |
| `PENDING_STAFF` | `missingRequirements` empty BUT `manualRequirements` non-empty | All traceable requirements met; staff must verify the rest. |
| `BLOCKED` | `missingRequirements` non-empty | User has work to do. |

#### Changes to `LevelUpService` / `PromotionService`

**Expand `RequirementCheck` interface:**

```ts
interface OptionalRequirement {
  description: string;           // e.g., "3 narraciones"
  status: 'COMPLETADO' | 'PARCIAL' | 'SIN_PROGRESO';
  current?: number;              // current count (if applicable)
  required?: number;             // required count (if applicable)
}

interface RequirementCheck {
  passed: boolean;
  promotionState?: 'APPROVED' | 'PENDING_STAFF' | 'BLOCKED';
  reason?: string;
  missingRequirements?: string[];
  manualRequirements?: string[];
  optionalRequirements?: OptionalRequirement[]; // NEW: track each optional with progress
  snapshot: { /* ... */ };
}
```

**Build `optionalRequirements` in each level/rank case:**

For each optional in the pool, calculate:
- `status`: `COMPLETADO` if requirement met, `PARCIAL` if partially met (progress > 0), `SIN_PROGRESO` if 0.
- `current` and `required`: the actual numbers so the user sees "2/3" or "1/4".

Example (B1):
```ts
const optionalRequirements: OptionalRequirement[] = [
  {
    description: '3 narraciones',
    status: metrics.narrations >= 3 ? 'COMPLETADO' : metrics.narrations > 0 ? 'PARCIAL' : 'SIN_PROGRESO',
    current: metrics.narrations,
    required: 3
  },
  {
    description: '2 destacados',
    status: metrics.highlightedNarrations >= 2 ? 'COMPLETADO' : metrics.highlightedNarrations > 0 ? 'PARCIAL' : 'SIN_PROGRESO',
    current: metrics.highlightedNarrations,
    required: 2
  },
  {
    description: 'Misiones C ≥ 4 (B cuenta como 2)',
    status: missionEquivalent >= 4 ? 'COMPLETADO' : missionEquivalent > 0 ? 'PARCIAL' : 'SIN_PROGRESO',
    current: missionEquivalent,
    required: 4
  },
  {
    description: '2 combates vs C+',
    status: metrics.combatsVsCOrHigher >= 2 ? 'COMPLETADO' : metrics.combatsVsCOrHigher > 0 ? 'PARCIAL' : 'SIN_PROGRESO',
    current: metrics.combatsVsCOrHigher,
    required: 2
  },
  {
    description: 'Curar a 5 personajes',
    status: 'SIN_PROGRESO', // always false optional
    current: 0,
    required: 5
  }
];
```

- Add a `promotionState: 'APPROVED' | 'PENDING_STAFF' | 'BLOCKED'` field based on `missingRequirements` and `manualRequirements`.
- `buildFailure` sets `PENDING_STAFF` when `missingRequirements` is empty; `BLOCKED` otherwise. Keep `passed: false` for both so `applyPromotion` still guards correctly.
- Expose `promotionState` and `optionalRequirements` in return values.

#### Changes to `ascender.ts`

**Case `BLOCKED`:** reply with a red `EmbedBuilder` (ephemeral) showing:
- Title: `❌ No cumples los requisitos`
- Character info + target.
- Field **"Requisitos faltantes"** (only if `missingRequirements.length > 0`): full bullet list of `missingRequirements` — never just the first one.
- Field **"Requisitos opcionales (cumple al menos 1)"**: list each optional with status and progress:
  ```
  3 narraciones (✅ COMPLETADO)
  2 destacados (⚠️ PARCIAL 1/2)
  Misiones C ≥ 4 (⚠️ PARCIAL 3/4)
  2 combates vs C+ (❌ SIN_PROGRESO)
  Curar a 5 personajes (❌ SIN_PROGRESO)
  ```
- Do **not** `throw` — use `editReply` and `return`.

**Case `PENDING_STAFF`:** instead of blocking, post a **non-ephemeral embed** (visible to staff in the channel) showing:
- Title: `⏳ Ascenso pendiente de validación`
- Color: yellow (`0xFEE75C`).
- Character info + target + full stats snapshot (same metrics shown in the old `/validar_ascenso`).
- Field **"Verificación manual requerida"**: bullet list of `manualRequirements`.
- Field **"Requisitos opcionales (completados)"**: list each optional with status for context.
- Footer: `"Un miembro del Staff debe verificar los requisitos anteriores y aplicar el ascenso con /ascender si procede."`
- This embed is posted to the channel (not ephemeral) so staff can see it without the user having to tag anyone.

**Case `APPROVED`:** proceed to `applyPromotion` as today.

#### Staff workflow for `PENDING_STAFF`

No new command is needed. Staff reads the embed, verifies off-system (e.g., reviews cure logs or RP thread), then runs `/ascender usuario:<user> objetivo:<target> fecha:<date>` themselves. Because staff have `Administrator`, the permission check at line 74 of `ascender.ts` already allows this. `checkLevelRequirements` will return `PENDING_STAFF` again for the staff-initiated call — so the command must also allow applying the promotion when the caller is staff and the state is `PENDING_STAFF` (bypass the gate for staff on manual cases).

Specifically, the logic in `ascender.ts` becomes:

```ts
if (check.promotionState === 'BLOCKED') {
  // show red embed with optionals progress, return
} else if (check.promotionState === 'PENDING_STAFF') {
  if (!isStaff) {
    // show yellow "pending" embed with optionals for context, return (inform user, wait for staff)
  }
  // isStaff === true: fall through to applyPromotion (staff is confirming)
}
// APPROVED or staff-confirmed PENDING_STAFF: apply promotion
```

### Files Changed

- `src/services/LevelUpService.ts` — `RequirementCheck` interface + `OptionalRequirement` type + `buildFailure` + build `optionalRequirements` in each case.
- `src/services/PromotionService.ts` — propagate `promotionState` and `optionalRequirements` from `LevelUpService`.
- `src/commands/gestion-fichas/ascender.ts` — replace throw blocks with embed logic per state; format optionals with progress indicator.

---

## Task 3 — Delete `/validar_ascenso`

With Task 2 in place, `/ascender` itself surfaces full diagnostic info on both failure states. `/validar_ascenso` becomes fully redundant.

### Files to Delete

- `src/commands/gestion-fichas/validar_ascenso.ts`

### References to Remove

| File | Location | Content |
|---|---|---|
| `src/config/commandNames.ts` | line 25 | `validar_ascenso: 'validar_ascenso',` |
| `src/commands/gestion-fichas/ascender.ts` | lines 92, 97 | Fallback text `'Revisa con /validar_ascenso.'` — remove entirely (the new embeds render the detail inline). |
| `docs/ARCHITECTURE.md` | line 90 | Tree entry for `validar_ascenso.ts` |
| `docs/QUICK_REFERENCE.md` | line 45 | `- /validar_ascenso` |
| `README.md` | line 120 | `- /validar_ascenso — Validate promotion (staff)` |

Verify no dynamic command loaders reference `validar_ascenso` beyond `commandNames.ts`.

---

## Task 4 — Rich Embed for Success + Include Fecha

### Current Behavior

`ascender.ts` replies with a plain-text `editReply` (lines 109–120).

### Desired Behavior

Replace with an `EmbedBuilder`:
- **Title:** `✅ Ascenso aplicado`
- **Color:** green (`0x57F287`)
- **Fields:**
  - `Personaje` — character name
  - `Objetivo` — target level/rank
  - `Nivel anterior` — `character.level`
  - `Cargo anterior` — `character.rank`
  - `SP otorgados` — only if `result.spGranted !== undefined`
  - `Fecha` — promotion date from the `fecha` option, formatted as `DD/MM/YYYY`
- **Ephemeral:** yes (current behavior via `defer: { ephemeral: true }`)

### Files Changed

- `src/commands/gestion-fichas/ascender.ts` — replace lines 109–120 with embed construction. Import `EmbedBuilder` from `discord.js`.

---

## Execution Order

1. **Task 0** — Fix all data bugs first. These are blocking bugs:
   - **0.1:** Correct optional thresholds (highest impact — makes promotions too easy currently).
   - **0.2:** Fix EXP/SP constants (integrity).
   - **0.3:** Add `combatWinsVsBOrHigher` metric (correctness for A1).
   - **0.4:** Optionally fix B1 mission equivalence (lower priority).
   
2. **Task 1** — Convert "curar" from hard blocker to optional (unblocks promotions).

3. **Task 2** — Implement three-state gate + detailed optional progress embeds (UX improvement).

4. **Task 3** — Delete `/validar_ascenso` (cleanup, depends on Task 2).

5. **Task 4** — Success embed with fecha (UI polish, independent).
