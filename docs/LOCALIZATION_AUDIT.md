# Localization Audit — `src/commands/`, `src/config/`, `src/domain/`, `src/database/`

Report of hardcoded strings that can be centralized in `src/config/` for reuse across the app.

**Implementation status:** Sections 1–4 (commands) have been implemented. Sections 7–9 (config, domain, database) are audit findings for future work.

---

## 1. Already in config (reference these)

| Source | Export | Usage |
|--------|--------|-------|
| `config/commandNames.ts` | `COMMAND_NAMES` | Used in historial, forzar_ascenso, registrar_suceso |
| `config/activityRewards.ts` | `CURACION_PR_BY_SEVERITY`, `MISSION_MAX_RANK_BY_CARGO`, `LOGRO_GENERAL_CATALOG`, `LOGRO_REPUTACION_CATALOG` | Domain data |
| `config/salaryConfig.ts` | `BASE_SALARIES` (keys = rank names) | Salary logic |
| `config/historicalNarrations.ts` | `NARRATION_PREFIX_BY_TYPE`, `HISTORICAL_NARRATIONS` | registrar_suceso |
| `config/requirements.ts` | `OPTIONAL_REQUIREMENTS` | Promotion logic |
| `services/ResourceAdjustmentService.ts` | `RESOURCE_LABEL_MAP` | historial, ficha |

---

## 2. Duplicates to remove (use existing config)

**Status:** ✅ Implemented (ajustar_recursos, tienda, listar_tienda, registrar_suceso, ascender).

### 2.1 Resource labels — use `RESOURCE_LABEL_MAP`

| File | Local duplicate | Replace with |
|------|-----------------|--------------|
| `staff/ajustar_recursos.ts` | `RESOURCE_CHOICE_LABELS` (lines 18–27) | `RESOURCE_LABEL_MAP` from `ResourceAdjustmentService` |
| `tienda/listar_tienda.ts` | `{ name: 'Ryou', value: 'RYOU' }` etc. | Build from `RESOURCE_LABEL_MAP` or new `STORE_CURRENCY_CHOICES` |
| `tienda/tienda.ts` | Same currency choices | Same |

### 2.2 Wound severity — use `CURACION_PR_BY_SEVERITY`

| File | Local duplicate | Replace with |
|------|-----------------|--------------|
| `registro-sucesos/registrar_suceso.ts` | `SEVERIDAD_CHOICES` (lines 74–80) | Derive from `Object.keys(CURACION_PR_BY_SEVERITY)` in `activityRewards.ts` |

### 2.3 Rank/cargo choices — use `MISSION_MAX_RANK_BY_CARGO` or `BASE_SALARIES`

| File | Local duplicate | Replace with |
|------|-----------------|--------------|
| `gestion-fichas/ascender.ts` | `CARGO_CHOICES` (lines 16–25) | Derive from `BASE_SALARIES` or new `CARGO_CHOICES` in config |

---

## 3. New constants to add in `src/config/`

### 3.1 `src/config/uiStrings.ts` (new file)

```ts
/** Date format hint for slash command options. Used in ~10 commands. */
export const DATE_OPTION_DESCRIPTION = 'Fecha (en formato DD/MM/YYYY o escribe "hoy").';

/** Variants for specific contexts */
export const DATE_OPTION_VARIANTS = {
  actividad: 'Fecha de la actividad (en formato DD/MM/YYYY o escribe "hoy").',
  ascenso: 'Fecha del ascenso (en formato DD/MM/YYYY o escribe "hoy").',
  compra: 'Fecha de la compra (en formato DD/MM/YYYY o escribe "hoy").',
  creacion: 'Fecha de creación de la ficha (en formato DD/MM/YYYY o escribe "hoy").',
  inversion: 'Fecha de la inversión (en formato DD/MM/YYYY o escribe "hoy").',
  lunes: 'Fecha del lunes (formato DD/MM/YYYY o "hoy")',
  transferencia: 'Fecha de la transferencia (en formato DD/MM/YYYY o escribe "hoy").',
  venta: 'Fecha de la venta (en formato DD/MM/YYYY o escribe "hoy").'
} as const;

/** Error: invalid date format */
export const ERROR_INVALID_DATE = '⛔ Fecha inválida.';

/** Error: date format hint for validation */
export const ERROR_DATE_FORMAT_HINT = 'Debes indicar una fecha válida (DD/MM/YYYY o "hoy").';
```

### 3.2 Staff error messages

| String | Suggested key | Files |
|--------|---------------|-------|
| `"⛔ Solo staff puede ver el historial de otros personajes."` | `ERROR_STAFF_ONLY_HISTORIAL` | historial |
| `"⛔ Solo el propietario configurado puede usar este comando."` | `ERROR_OWNER_ONLY` | bienvenida |
| `"⛔ Este comando es exclusivo de Staff."` | `ERROR_STAFF_ONLY` | forzar_ascenso |
| `"⛔ El usuario X no tiene ficha registrada."` | `ERROR_NO_CHARACTER` (template) | forzar_ascenso |
| `"⛔ X no tiene un personaje registrado."` | Same | historial |

### 3.3 Embed field labels (reused across salary/transfer)

| String | Suggested key | Files |
|--------|---------------|-------|
| `"Correspondiente a la semana del"` | `FIELD_WEEK_OF` | cobrar_sueldo, forzar_sueldo |
| `"Sueldo Base"` | `FIELD_BASE_SALARY` | cobrar_sueldo, forzar_sueldo |
| `"Bonos de Origen"` | `FIELD_ORIGIN_BONUS` | cobrar_sueldo, forzar_sueldo |
| `"Multiplicador de Balance"` | `FIELD_BALANCE_MULTIPLIER` | cobrar_sueldo, forzar_sueldo |
| `"Balance Final"` | `FIELD_FINAL_BALANCE` | cobrar_sueldo, forzar_sueldo |
| `"Ryou Neto"` | `FIELD_NET_RYOU` | forzar_sueldo |
| `"Bono EXP Semanal"` | `FIELD_WEEKLY_EXP_BONUS` | cobrar_sueldo |
| `"EXP Otorgado"` | `FIELD_EXP_GRANTED` | forzar_sueldo |
| `"SP Acumulados"` | `FIELD_SP_GRANTED` | forzar_ascenso |
| `"Compensación de Base (Para alcanzar el mínimo del nivel)"` | `FIELD_BASE_COMPENSATION` | forzar_ascenso |

### 3.4 Historial-specific strings

| String | Suggested key | File |
|--------|---------------|------|
| `"Sin eventos registrados en el historial."` | `HISTORIAL_EMPTY` | historial |
| `"...continuación del historial..."` | `HISTORIAL_CONTINUATION` | historial |
| `"Eliminar mensaje"` | `BUTTON_DELETE_MESSAGE` | historial |
| `"Error al obtener historial."` | `ERROR_HISTORIAL_FETCH` | historial |

### 3.5 Audit/evidence placeholder

| String | Suggested key | Files |
|--------|---------------|-------|
| `"Sin evidencia adjunta"` | `PLACEHOLDER_NO_EVIDENCE` | ajustar_recursos |

### 3.6 Mission/combat result choices

| String | Suggested key | File |
|--------|---------------|------|
| `"Exitosa"` / `"Fallida"` | `RESULTADO_MISION_*` | registrar_suceso |
| `"Victoria"` / `"Derrota"` / `"Empate"` | `RESULTADO_COMBATE_*` | registrar_suceso |
| `"Destacado"` / `"Participación"` | `RESULTADO_NARRACION_*` | registrar_suceso |

→ These map to `ActivityResult` in `domain/activityDomain.ts`; consider exporting display labels from there or from config.

### 3.7 Otorgamiento types (otorgar_habilidad)

| String | Suggested key | File |
|--------|---------------|------|
| `"Desarrollo"` / `"Deseo Normal"` / `"Deseo Especial"` | `TIPO_OTORGAMIENTO_*` | otorgar_habilidad |

### 3.8 Store currency choices (tienda, listar_tienda)

| String | Suggested key | Files |
|--------|---------------|-------|
| `{ name: 'Ryou', value: 'RYOU' }` etc. | `STORE_CURRENCY_CHOICES` | tienda, listar_tienda |

→ Derive from `RESOURCE_LABEL_MAP` or define in `config/activityRewards.ts` / new `config/storeConfig.ts`.

---

## 4. Summary of recommended config changes

### New config file: `src/config/uiStrings.ts`

```ts
// Date format hints
export const DATE_OPTION_DESCRIPTION = 'Fecha (en formato DD/MM/YYYY o escribe "hoy").';
export const DATE_OPTION_VARIANTS = { ... };

// Errors
export const ERROR_INVALID_DATE = '⛔ Fecha inválida.';
export const ERROR_STAFF_ONLY = '⛔ Este comando es exclusivo de Staff.';
export const ERROR_STAFF_ONLY_HISTORIAL = '⛔ Solo staff puede ver el historial de otros personajes.';
export const ERROR_OWNER_ONLY = '⛔ Solo el propietario configurado puede usar este comando.';
export const ERROR_NO_CHARACTER = (username: string) => `⛔ ${username} no tiene un personaje registrado.`;
export const ERROR_NO_CHARACTER_FICHA = (username: string) => `⛔ El usuario ${username} no tiene ficha registrada.`;

// Embed fields (salary)
export const FIELD_WEEK_OF = 'Correspondiente a la semana del';
export const FIELD_BASE_SALARY = 'Sueldo Base';
export const FIELD_ORIGIN_BONUS = 'Bonos de Origen';
export const FIELD_BALANCE_MULTIPLIER = 'Multiplicador de Balance';
export const FIELD_FINAL_BALANCE = 'Balance Final';
export const FIELD_NET_RYOU = 'Ryou Neto';
export const FIELD_WEEKLY_EXP_BONUS = 'Bono EXP Semanal';
export const FIELD_EXP_GRANTED = 'EXP Otorgado';
export const FIELD_SP_GRANTED = 'SP Acumulados';
export const FIELD_BASE_COMPENSATION = 'Compensación de Base (Para alcanzar el mínimo del nivel)';

// Historial
export const HISTORIAL_EMPTY = 'Sin eventos registrados en el historial.';
export const HISTORIAL_CONTINUATION = '...continuación del historial...';
export const BUTTON_DELETE_MESSAGE = 'Eliminar mensaje';
export const ERROR_HISTORIAL_FETCH = 'Error al obtener historial.';

// Placeholders
export const PLACEHOLDER_NO_EVIDENCE = 'Sin evidencia adjunta';
```

### New config file: `src/config/choices.ts` (or extend existing)

```ts
// Derive from activityRewards
export const SEVERIDAD_CHOICES = Object.entries(CURACION_PR_BY_SEVERITY).map(([k, v]) => ({ name: k, value: k }));

// Derive from BASE_SALARIES or MISSION_MAX_RANK_BY_CARGO
export const CARGO_CHOICES = [...];

// Store currency
export const STORE_CURRENCY_CHOICES = [
  { name: 'Ryou', value: 'RYOU' },
  { name: 'EXP', value: 'EXP' },
  { name: 'PR', value: 'PR' }
];
```

### Code changes

1. **ajustar_recursos.ts**: Remove `RESOURCE_CHOICE_LABELS`, use `RESOURCE_LABEL_MAP` from `ResourceAdjustmentService`.
2. **registrar_suceso.ts**: Replace `SEVERIDAD_CHOICES` with derivation from `CURACION_PR_BY_SEVERITY`; use `fechaDesc` from `uiStrings`.
3. **ascender.ts**: Replace `CARGO_CHOICES` with import from config.
4. **tienda.ts**, **listar_tienda.ts**: Use `STORE_CURRENCY_CHOICES` from config.
5. **All date options**: Use `DATE_OPTION_VARIANTS.*` from `uiStrings`.
6. **historial.ts**: Use `HISTORIAL_EMPTY`, `HISTORIAL_CONTINUATION`, `BUTTON_DELETE_MESSAGE`, `ERROR_HISTORIAL_FETCH` from `uiStrings`.
7. **cobrar_sueldo.ts**, **forzar_sueldo.ts**: Use salary field labels from `uiStrings`.

---

## 5. Files with most hardcoded strings

| File | Priority | Notes |
|------|----------|-------|
| `registrar_suceso.ts` | High | Many option descriptions, result choices, embed labels |
| `registro.ts` | High | Many option descriptions, error messages |
| `ascender.ts` | Medium | CARGO_CHOICES, field labels |
| `cobrar_sueldo.ts` | Medium | Salary field labels |
| `forzar_sueldo.ts` | Medium | Salary field labels |
| `historial.ts` | Medium | Empty/continuation messages |
| `ajustar_recursos.ts` | Low | Duplicate RESOURCE_CHOICE_LABELS |
| `tienda.ts`, `listar_tienda.ts` | Low | Currency choices |
| `otorgar_habilidad.ts` | Low | Tipo otorgamiento choices |
| `bienvenida.ts` | Low | Long embed content (may stay as-is for now) |

---

## 6. Not recommended for config

- **Embed content in bienvenida.ts**: Long, narrative text; localization could be a separate phase.
- **Dynamic strings** with interpolated values (e.g. `Ficha de ${character.name}`): keep as template literals; only extract shared patterns if needed.
- **Discord option names** (e.g. `usuario`, `fecha`, `cargo`): internal IDs; keep as-is unless you want i18n for all options.

---

## 7. `src/config/` — Audit findings

### 7.1 Cross-references and inconsistencies

| Issue | Location | Notes |
|-------|----------|-------|
| **Cronica vs Crónica** | `activityRewards.ts` (STANDARD_NARRATION_REWARDS), `historicalNarrations.ts` (NARRATION_PREFIX_BY_TYPE) | `STANDARD_NARRATION_REWARDS` uses `Cronica` (no accent); `NARRATION_PREFIX_BY_TYPE` uses `Crónica`. `ActivityType.CRONICA` = `'Crónica'`. Align keys for consistency. |
| **CARGO_CHOICES duplication** | `choices.ts` | CARGO_CHOICES is manually maintained. Could derive from `Object.keys(BASE_SALARIES).filter(k => k !== 'Genin')` to avoid drift. |
| **Herido Critico display** | `choices.ts` | One-off `key === 'Herido Critico' ? 'Herido Crítico' : key` for display. Consider `SEVERIDAD_DISPLAY_MAP` if more accents/variants needed. |

### 7.2 Strings that could be extracted (low priority)

| File | String(s) | Suggested key | Notes |
|------|-----------|---------------|-------|
| `activityRewards.ts` | `'Iniciales' \| 'Libres' \| 'Maestria' \| 'Dados'` | `LOGRO_CATEGORIES` | LogroGeneralEntry category type; used in catalog. Extract only if shown in UI. |
| `activityRewards.ts` | Notes in LOGRO_GENERAL_CATALOG | — | e.g. `'Recompensa variable (+1 EXP por miembro no-NPC).'` — domain content; keep in catalog. |
| `historicalNarrations.ts` | `'Cronica vieja:'`, `'Evento viejo:'`, `'Balance General:'` | — | Already in `NARRATION_PREFIX_BY_TYPE`; used for autocomplete. |

### 7.3 Config files with no localization needs

| File | Reason |
|------|--------|
| `commandNames.ts` | Internal command IDs only. |
| `requirements.ts` | Internal requirement IDs only. |
| `newbieBoost.ts` | Env vars and logic; no user-facing strings. |
| `salaryConfig.ts` | Rank names are domain keys; already centralized. |
| `uiStrings.ts` | Already the localization target. |

---

## 8. `src/domain/activityDomain.ts` — Audit findings

### 8.1 Canonical display values

`ActivityType` and `ActivityResult` are the **single source of truth** for activity types and outcomes. They are used as:

- Keys in `config/activityRewards.ts` (ACTIVITY_TIER, WEEKLY_CAPS)
- Input to `canonicalizeActivityType`, `canonicalizeActivityResult`
- Reference in `registrar_suceso.ts` for subcommand mapping

| Export | Values | Localization opportunity |
|--------|--------|---------------------------|
| `ActivityType` | Misión, Combate, Crónica, Evento, Escena, Experimento, Curación, Logro General, etc. | Already canonical. `registrar_suceso` subcommand descriptions could import these for consistency. |
| `ActivityResult` | EXITOSA, FALLIDA, VICTORIA, DERROTA, DESTACADO, PARTICIPACION, EMPATE | **Mismatch:** `registrar_suceso` uses `value: 'Exitosa'` (capitalized) for choices. Backend may expect different casing. Consider exporting `ACTIVITY_RESULT_CHOICES` from domain or config that maps to these values. |

### 8.2 Suggested addition

```ts
// In activityDomain.ts or config/choices.ts
/** Discord choice format for mission/combat/narration results. */
export const ACTIVITY_RESULT_CHOICES = {
  mision: [
    { name: '✅ Exitosa', value: ActivityResult.EXITOSA },
    { name: '❌ Fallida', value: ActivityResult.FALLIDA }
  ],
  combate: [
    { name: '✅ Victoria', value: ActivityResult.VICTORIA },
    { name: '❌ Derrota', value: ActivityResult.DERROTA },
    { name: '🤝 Empate', value: ActivityResult.EMPATE }
  ],
  narracion: [
    { name: '⭐ Destacado', value: ActivityResult.DESTACADO },
    { name: '📝 Participación', value: ActivityResult.PARTICIPACION }
  ]
} as const;
```

**Note:** `registrar_suceso` currently uses `value: 'Exitosa'` but `ActivityResult.EXITOSA` is `'EXITOSA'`. The `canonicalizeActivityResult` normalizes input to uppercase. Verify backend expects normalized values before changing.

### 8.3 Internal maps (no change needed)

`ACTIVITY_TYPE_NORMALIZED_MAP`, `ACTIVITY_STATUS_NORMALIZED_MAP`, `ACTIVITY_RESULT_NORMALIZED_MAP` — internal normalization; keep as-is.

---

## 9. `src/database/` — Audit findings

### 9.1 AuditLog category constant

The string `'Ascenso'` is used in:

- `backfillGradationHistory.ts` — `where: { category: 'Ascenso' }`
- `historial.ts` — `formatAuditLine` checks `log.category.includes('Ascenso')`, `log.category.includes('Sueldo')`, etc.

| Suggested constant | Value | Used in |
|--------------------|-------|---------|
| `AUDIT_LOG_CATEGORY` | `{ ASCENSO: 'Ascenso', ACTIVIDAD: 'Actividad', RASGO: 'Rasgo', STATS: 'Stats', RECURSOS: 'Recursos', SUELDO: 'Sueldo', HABILIDAD: 'Habilidad', CREACION_FICHA: 'Creación de Ficha', ... }` | historial, backfillGradationHistory, services that write AuditLog |

**Priority:** Medium. Reduces typos and centralizes category names.

### 9.2 Backfill / parsing strings

`backfillGradationHistory.ts` parses `AuditLog.detail` with regexes matching:

- `'Ascenso de nivel:'`
- `'Nivel:'`
- `'Objetivo:'`

These must match what `PromotionService` and `LevelUpService` write. **Do not localize** — they are part of the audit format contract. If changed, backfill would break. Document in code comments.

### 9.3 VALID_LEVELS in backfillGradationHistory

```ts
const VALID_LEVELS = new Set(['D2', 'D3', 'C1', 'C2', 'C3', 'B1', 'B2', 'B3', 'A1', 'A2', 'A3', 'S1', 'S2']);
```

**Suggestion:** Import from `StatValidatorService.getLevelExpRequirements()` keys or a shared `LEVEL_ORDER` constant to avoid drift.

### 9.4 Console / log messages (developer-facing)

| File | Strings | Priority |
|------|---------|----------|
| `auditPlazaTraitInheritance.ts` | `'🔎 Auditando consistencia...'`, `'❌ Plazas referenciadas...'`, `'✅ OK. X relaciones...'`, `'Accion sugerida: ejecutar...'` | Low — dev-only |
| `seedRasgo.ts` | `'🚀 [PRISMA 7] Iniciando...'`, `'✅ X sincronizado.'`, `'🎉 SEED COMPLETADO'` | Low — dev-only |
| `seedPlazas.ts` | `'✅ Guía sincronizada:'`, `'🔗 Creating Plaza-to-Plaza...'`, `'⚠️ Parent plaza...'` | Low — dev-only |
| `seedMercados.ts` | `'🚀 Iniciando seed de mercados...'`, `'✅ Item sincronizado:'`, `'🎉 Seed de mercados completado.'` | Low — dev-only |
| `backfillGradationHistory.ts` | `'📦 Backfilling GradationHistory...'`, `'✅ Backfill complete:'` | Low — dev-only |

**Recommendation:** Optional `src/database/scriptStrings.ts` for consistency. Low priority since these are CLI/dev output.

### 9.5 seedMercados — catalog data

`MERCADO_NINJA`, `TIENDA_PR`, `TIENDA_EXP` contain item names and types (e.g. `'Kit Ninja'`, `'Corta Distancia'`, `'Servicios'`). These are **product catalog data** stored in the DB. Keep in seed file or move to `prisma/seed-data/` JSON. No localization needed for the seed itself.

**Naming note:** Médico services use `'Herida Leve'`, `'Herida Grave'`, `'Herida Crítica'` (wound). `CURACION_PR_BY_SEVERITY` uses `'Herido Leve'`, `'Herido Grave'`, `'Herido Critico'` (wounded person). Different concepts; no change needed.

### 9.6 Error messages in database scripts

| File | String | Suggestion |
|------|--------|------------|
| `seedRasgo.ts` | `"Falta DATABASE_URL en .env"` | Could use shared `ERROR_MISSING_DATABASE_URL` if other scripts need it. |
| `seedMercados.ts` | `'Falta DATABASE_URL en el entorno.'`, `'Error desconocido en seedMercados.'` | Same. |
| `auditPlazaTraitInheritance.ts` | `'❌ Error durante la auditoria:'` | Low priority. |

---

## 10. Summary — config / domain / database

| Area | Action | Priority |
|------|--------|----------|
| **activityDomain** | Export `ACTIVITY_RESULT_CHOICES` for registrar_suceso (after verifying value casing) | Medium |
| **config** | Align `Cronica`/`Crónica` in STANDARD_NARRATION_REWARDS and NARRATION_PREFIX_BY_TYPE | Low |
| **config** | Derive CARGO_CHOICES from BASE_SALARIES | Low |
| **database** | Add `AUDIT_LOG_CATEGORY` constant; use in historial, backfill | Medium |
| **database** | Import VALID_LEVELS from StatValidatorService in backfillGradationHistory | Low |
| **database** | Optional scriptStrings.ts for console messages | Low |
