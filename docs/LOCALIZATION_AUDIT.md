# Localization Audit — `src/commands/`, `src/config/`, `src/domain/`, `src/database/`, `src/services/`, `src/index.ts`, `src/utils/`

Report of hardcoded strings that can be centralized in `src/config/` for reuse across the app.

**Implementation status:** Sections 1–4 (commands), Section 10 (services), and Section 12 (index, utils) have been implemented. Sections 7–9 (config, domain, database) are audit findings for future work.

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

## 10. `src/services/` — Audit findings

Services contain the highest density of user-facing error messages and audit-log strings. These should be centralized in `src/config/` for consistency and reuse.

### 10.1 AuditLog categories (extend `auditLogCategories.ts`)

| Category string | Current location | Suggested key |
|-----------------|------------------|---------------|
| `'Ajuste Staff de Recursos'` | ResourceAdjustmentService, PromotionService | `AJUSTE_RECURSOS` |
| `'Compra (Mercado)'` | TransactionService | `COMPRA_MERCADO` |
| `'Venta (Mercado)'` | TransactionService | `VENTA_MERCADO` |
| `'Intercambio'` | TransactionService | `INTERCAMBIO` |
| `'Aprobación de Actividad'` | ActivityApprovalService | `APROBACION_ACTIVIDAD` |
| `'NPC Lifecycle'` | NpcService | `NPC_LIFECYCLE` |
| `'Sueldo Semanal'` | LevelUpService, SalaryService | Already covered by `SUELDO` |
| `'Gestor Habilidades'` | PlazaService | Already covered by `GESTOR` |
| `'Rasgo Asignado'` / `'Rasgo Removido'` | CharacterService | `RASGO_ASIGNADO`, `RASGO_REMOVIDO` |
| `'Creación de Ficha'` | CharacterService | Already in `CREACION_FICHA` |

### 10.2 Evidence strings (audit log `evidence` field)

| String | Files | Suggested key |
|--------|-------|---------------|
| `'Sin evidencia adjunta'` | ResourceAdjustmentService | `PLACEHOLDER_NO_EVIDENCE` (already in uiStrings) |
| `'Sistema Automatizado'` | LevelUpService, SalaryService | `EVIDENCE_SISTEMA_AUTOMATIZADO` |
| `'Sistema de Transacciones'` | TransactionService | `EVIDENCE_SISTEMA_TRANSACCIONES` |
| `'Comando /ascender'` | LevelUpService, PromotionService | `EVIDENCE_COMANDO_ASCENDER` |
| `'Comando /forzar_ascenso'` | PromotionService | `EVIDENCE_COMANDO_FORZAR_ASCENSO` |
| `'Comando /registro'` | CharacterService | `EVIDENCE_COMANDO_REGISTRO` |
| `'Comando /otorgar_rasgo'` | CharacterService | `EVIDENCE_COMANDO_OTORGAR_RASGO` |
| `'Comando /retirar_habilidad'` | PlazaService | `EVIDENCE_COMANDO_RETIRAR_HABILIDAD` |
| `'Comando /npc crear'` | NpcService | `EVIDENCE_COMANDO_NPC_CREAR` |
| `'Comando /npc retirar'` | NpcService | `EVIDENCE_COMANDO_NPC_RETIRAR` |

### 10.3 Error messages — reusable across services

| String | Suggested key | Files |
|--------|---------------|-------|
| `'Personaje no encontrado.'` | `ERROR_CHARACTER_NOT_FOUND` | LevelUpService, PromotionService, SalaryService, TransactionService, PlazaService, CharacterService |
| `'⛔ ACCIÓN PROHIBIDA: Personaje no encontrado.'` | `ERROR_ACTION_PROHIBIDA_CHARACTER_NOT_FOUND` | LevelUpService, CharacterService |
| `'⛔ La cantidad debe ser mayor a cero.'` | `ERROR_AMOUNT_MUST_BE_POSITIVE` | ResourceAdjustmentService |
| `'⛔ Debes proporcionar un motivo para el ajuste.'` | `ERROR_REASON_REQUIRED` | ResourceAdjustmentService |
| `'⛔ El usuario objetivo no tiene un personaje registrado.'` | `ERROR_TARGET_NO_CHARACTER` | ResourceAdjustmentService |
| `'⛔ Debes proporcionar un nombre de NPC válido.'` | `ERROR_NPC_NAME_REQUIRED` | NpcService |
| `'⛔ Debes indicar el NPC a retirar por ID o nombre.'` | `ERROR_NPC_RETIRE_REFERENCE_REQUIRED` | NpcService |
| `'⛔ Debes indicar el motivo del retiro.'` | `ERROR_NPC_RETIRE_REASON_REQUIRED` | NpcService |
| `'No puedes cobrar sueldos de fechas anteriores a la creación de tu personaje.'` | `ERROR_SALARY_BEFORE_CREATION` | SalaryService |
| `'⛔ Ya cobraste el sueldo semanal. Intenta nuevamente más tarde.'` | `ERROR_SALARY_ALREADY_CLAIMED` | LevelUpService |
| `'Rango no válido: ${target}'` | `ERROR_INVALID_RANK` (template) | PromotionService |
| `'⛔ Nivel inválido: ${targetLevel}'` | `ERROR_INVALID_LEVEL` (template) | PromotionService |
| `'⛔ El personaje ya es ${level}. No puedes forzar un ascenso a un nivel igual o inferior.'` | `ERROR_FORCE_ASCENSO_SAME_OR_LOWER` (template) | PromotionService |
| `'Ninguno de los ítems existe en el Mercado.'` / `'Ninguno de los ítems existe en el catálogo.'` | `ERROR_ITEMS_NOT_IN_CATALOG` | TransactionService |
| `'El ítem \'${name}\' no existe en el catálogo.'` | `ERROR_ITEM_NOT_FOUND` (template) | TransactionService |
| `'⛔ FONDOS: Necesitas ${cost} Ryou, tienes ${have}.'` (and EXP/PR variants) | `ERROR_FUNDS_INSUFFICIENT` (template) | TransactionService |
| `'⛔ RESTRICCIÓN DE RASGO: Debes mantener al menos ${min} Ryou intactos en tu ficha.'` | `ERROR_TRAIT_MIN_BALANCE` (template) | TransactionService |
| `'⛔ RESTRICCIÓN DE RASGO: Tienes prohibido ceder dinero voluntariamente a otros personajes.'` | `ERROR_TRAIT_BLOCKS_TRANSFER` | TransactionService |
| `'⛔ No tienes suficientes Ryou para transferir.'` | `ERROR_INSUFFICIENT_RYOU_TRANSFER` | TransactionService |
| `'Remitente no encontrado.'` | `ERROR_SENDER_NOT_FOUND` | TransactionService |
| `'⛔ El mensaje de aprobación no pertenece a un servidor.'` | `ERROR_APPROVAL_MESSAGE_NO_GUILD` | BuildApprovalService |
| `'⛔ No se pudo extraer "Nombre del Keko" del mensaje aprobado.'` | `ERROR_APPROVAL_MESSAGE_NO_KEKO` | BuildApprovalService |

### 10.4 RewardCalculatorService — strings

| String | Suggested key | Notes |
|--------|---------------|-------|
| `'Bono Novato'` | `BONUS_NEWBIE` | Used in reward detail source |
| `'⛔ La misión no tiene rango definido.'` | `ERROR_MISSION_NO_RANK` | |
| `'⛔ El rango de misión \'${rank}\' no es válido para recompensas.'` | `ERROR_MISSION_RANK_INVALID` (template) | |
| `'⛔ El combate no tiene rango del oponente definido.'` | `ERROR_COMBAT_NO_ENEMY_RANK` | |
| `'⛔ El rango actual del personaje (\'${level}\') no es válido.'` | `ERROR_CHARACTER_LEVEL_INVALID` (template) | |
| `'⛔ El rango del oponente (\'${rank}\') no es válido.'` | `ERROR_ENEMY_RANK_INVALID` (template) | |
| `'⛔ La curación no tiene severidad de herida definida.'` | `ERROR_CURACION_NO_SEVERITY` | |
| `'⛔ La severidad \'${severidad}\' no es válida.'` | `ERROR_SEVERITY_INVALID` (template) | |
| `'⛔ El nivel \'${level}\' no es válido para Desarrollo Personal.'` | `ERROR_LEVEL_INVALID_DESARROLLO` (template) | |
| `'⛔ El logro general seleccionado no existe en el catálogo.'` | `ERROR_LOGRO_GENERAL_NOT_FOUND` | |
| `'⛔ El logro de reputación seleccionado no existe en el catálogo.'` | `ERROR_LOGRO_REPUTACION_NOT_FOUND` | |

### 10.5 ResourceAdjustmentService — move RESOURCE_LABEL_MAP to config

`RESOURCE_LABEL_MAP` is defined in `ResourceAdjustmentService.ts` (lines 64–72) but is used by historial and ficha. **Move to `src/config/resourceLabels.ts`** (or `config/activityRewards.ts` if related) and import from there.

### 10.6 LevelUpService / PromotionService — requirement messages

`LevelUpService` contains ~60+ hardcoded requirement messages (e.g. `Falta al menos 1 misión Rango B`, `EXP insuficiente`, `Cumple validaciones automáticas, pero faltan requisitos manuales.`). These are **domain-specific** and highly repetitive. **Recommendation:** Create `src/config/requirementMessages.ts` with template functions:

```ts
export const ERROR_EXP_INSUFFICIENT = (current: number, required: number) =>
  `- EXP insuficiente (${current}/${required}).`;
export const ERROR_PR_INSUFFICIENT = (current: number, required: number) =>
  `- PR insuficiente (${current}/${required}).`;
export const REASON_MANUAL_REQUIREMENTS = 'Cumple validaciones automáticas, pero faltan requisitos manuales.';
// ... etc.
```

### 10.7 CharacterService / PlazaService — conflict and validation errors

| String pattern | Suggested key |
|---------------|---------------|
| `'⛔ ACCIÓN PROHIBIDA: El Keko \'${name}\' o el usuario de Discord ya posee una ficha registrada.'` | `ERROR_KEKO_OR_DISCORD_ALREADY_REGISTERED` |
| `'⛔ CONFLICTO: Uno o más rasgos proporcionados no existen en el sistema IZANAGI.'` | `ERROR_TRAITS_NOT_IN_SYSTEM` |
| `'⛔ CONFLICTO: El rasgo ${trait} es incompatible con el rasgo ${other}. Elimina uno de los dos.'` | `ERROR_TRAIT_INCOMPATIBLE` |
| `'⛔ CONFLICTO: RC inválido al crear la ficha: ${rc}. Ajusta la selección de rasgos.'` | `ERROR_RC_INVALID_AT_CREATION` |
| `'⛔ CONFLICTO: El rasgo \'${name}\' no existe en el sistema.'` | `ERROR_TRAIT_NOT_FOUND` |
| `'⛔ CONFLICTO: El personaje ya posee el rasgo \'${name}\'.'` | `ERROR_CHARACTER_ALREADY_HAS_TRAIT` |
| `'⛔ CONFLICTO: \'${name}\' es incompatible con \'${other}\'.'` | `ERROR_TRAIT_INCOMPATIBLE_WITH` |
| `'⛔ No hay suficientes RC. Necesitas ${need}, tienes ${have}.'` | `ERROR_RC_INSUFFICIENT` |
| Plaza `'⛔ La guía/plaza \'${name}\' no existe en el sistema.'` | `ERROR_PLAZA_NOT_FOUND` |
| `'⛔ El personaje ya posee la habilidad \'${name}\'.'` | `ERROR_CHARACTER_ALREADY_HAS_PLAZA` |
| `'⛔ No quedan plazas para \'${name}\'. Cupo máximo: ${max}.'` | `ERROR_PLAZA_CUPOS_EXCEEDED` |
| `'⛔ No puedes pagar con BTS y BES al mismo tiempo.'` | `ERROR_BTS_BES_MUTEX` |
| `'⛔ REGLA DE DESARROLLO: \'${cat}\' no puede tomarse como habilidad inicial.'` | `ERROR_PLAZA_INITIAL_CATEGORY` |
| `'⛔ Este personaje ya consumió su único Deseo Especial.'` | `ERROR_DESEO_ESPECIAL_ALREADY_USED` | etc. |

### 10.8 StatValidatorService / SkillRankValidator / ActivityCapService

These contain many validation and limit errors. Extract to `config/validationErrors.ts` or extend `uiStrings.ts` with an `ERROR_VALIDATION_*` section.

### 10.9 Suggested new config files

| File | Purpose |
|------|---------|
| `config/auditLogCategories.ts` | Extend with `AJUSTE_RECURSOS`, `COMPRA_MERCADO`, `VENTA_MERCADO`, `INTERCAMBIO`, `APROBACION_ACTIVIDAD`, `NPC_LIFECYCLE`, `RASGO_ASIGNADO`, `RASGO_REMOVIDO` |
| `config/evidenceStrings.ts` | Audit evidence strings (`EVIDENCE_SISTEMA_AUTOMATIZADO`, `EVIDENCE_COMANDO_*`, etc.) |
| `config/serviceErrors.ts` | Shared error messages (character not found, funds, etc.) |
| `config/requirementMessages.ts` | LevelUpService requirement templates |
| `config/resourceLabels.ts` | Move `RESOURCE_LABEL_MAP` from ResourceAdjustmentService |

### 10.10 Services by priority

| Service | Priority | Notes |
|---------|----------|-------|
| ResourceAdjustmentService | High | `PLACEHOLDER_NO_EVIDENCE`, audit category, errors; move RESOURCE_LABEL_MAP |
| RewardCalculatorService | High | `BONUS_NEWBIE`, errors |
| TransactionService | High | Many errors, audit categories, evidence |
| CharacterService | High | Many errors, audit categories |
| LevelUpService / PromotionService | Medium | Requirement messages, audit categories |
| SalaryService | Medium | Errors, evidence |
| PlazaService | Medium | Many errors |
| ActivityApprovalService | Low | Audit category only |
| NpcService | Low | Errors, audit categories |
| StatValidatorService, SkillRankValidator, ActivityCapService | Low | Validation errors |

---

## 11. Summary — config / domain / database / services

| Area | Action | Priority |
|------|--------|----------|
| **activityDomain** | Export `ACTIVITY_RESULT_CHOICES` for registrar_suceso (after verifying value casing) | Medium |
| **config** | Align `Cronica`/`Crónica` in STANDARD_NARRATION_REWARDS and NARRATION_PREFIX_BY_TYPE | Low |
| **config** | Derive CARGO_CHOICES from BASE_SALARIES | Low |
| **database** | Add `AUDIT_LOG_CATEGORY` constant; use in historial, backfill | Medium |
| **database** | Import VALID_LEVELS from StatValidatorService in backfillGradationHistory | Low |
| **database** | Optional scriptStrings.ts for console messages | Low |
| **services** | Extend `auditLogCategories.ts`; add `evidenceStrings.ts`, `serviceErrors.ts` | High |
| **services** | Move `RESOURCE_LABEL_MAP` to config; add `requirementMessages.ts` | Medium |

---

## 12. `src/index.ts` and `src/utils/` — Audit findings (implemented)

### 12.1 index.ts — user-facing strings

| String | Suggested key | Context |
|--------|---------------|---------|
| `'⛔ Solo el autor del historial o staff puede eliminar este mensaje.'` | `ERROR_HISTORIAL_DELETE_AUTH` | historial_delete button |
| `'❌ No se pudo eliminar el mensaje.'` | `ERROR_DELETE_MESSAGE_FAILED` | historial delete fail |
| `'⛔ Solo el autor de la ficha, el dueño del post o staff puede eliminar este mensaje.'` | `ERROR_FICHA_DELETE_AUTH` | ficha_delete button |
| `'❌ No se pudo eliminar el mensaje de ficha.'` | `ERROR_FICHA_DELETE_FAILED` | ficha delete fail |
| `'⛔ Solo puedes cambiar la imagen de tu propio personaje.'` | `ERROR_FICHA_IMAGE_OWNER_ONLY` | ficha_change_image |
| `'Cambiar imagen del personaje'` | `MODAL_FICHA_IMAGE_TITLE` | Modal title |
| `'URL de la imagen'` | `MODAL_FICHA_IMAGE_LABEL` | Modal input label |
| `'https://ejemplo.com/imagen.png'` | `MODAL_FICHA_IMAGE_PLACEHOLDER` | Modal placeholder |
| `'⛔ Error interno.'` | `ERROR_INTERNAL` | Modal submit error |
| `'⛔ La URL debe comenzar con https:// o http://'` | `ERROR_URL_MUST_START_HTTPS` | URL validation |
| `'⛔ La URL debe ser de una imagen (jpg, png, gif, webp) o de un host conocido (imgur, Discord CDN).'` | `ERROR_URL_MUST_BE_IMAGE` | URL validation |
| `'✅ Imagen del personaje actualizada. Usa \`/ficha\` para ver el cambio.'` | `SUCCESS_FICHA_IMAGE_UPDATED` | Success reply |
| `'❌ Error al ejecutar el comando'` | `ERROR_COMMAND_EXECUTION` | Command catch-all |

### 12.2 index.ts — console logs (optional, dev-only)

| String | Suggested key |
|--------|---------------|
| `'✅ Aprobación procesada desde reacción en mensaje ${id}'` | `LOG_APPROVAL_PROCESSED` |
| `'❌ Error procesando aprobación por reacción:'` | `LOG_ERROR_REACTION_APPROVAL` |
| `'✅ Sistema IZANAGI en línea. Bot: ${tag}'` | `LOG_BOT_READY` |
| `'📦 Loaded ${n} commands'` | `LOG_COMMANDS_LOADED` |
| `'🛑 ${signal} received. Shutting down gracefully...'` | `LOG_SHUTDOWN_START` |
| etc. | → `config/logStrings.ts` |

### 12.3 utils/staffGuards.ts

| String | Suggested key |
|--------|---------------|
| `'⛔ Este comando solo puede usarse dentro de un servidor.'` | `ERROR_GUILD_ONLY` |
| `'⛔ No tienes permisos de staff para usar este comando.'` | `ERROR_STAFF_PERMISSION` |
| `'⛔ Configuración inválida: falta cliente de base de datos para validación de NPC.'` | `ERROR_NPC_VALIDATION_NO_PRISMA` |
| `'⛔ Tu ficha no tiene habilitado el permiso canCreateNPC para gestionar NPCs.'` | `ERROR_NPC_CAN_CREATE_REQUIRED` |

### 12.4 utils/channelGuards.ts

| String | Suggested key |
|--------|---------------|
| `'⛔ Usa este comando dentro de un post de foro (thread), no en un canal de texto normal.'` | `ERROR_FORUM_THREAD_REQUIRED` |
| `'⛔ Este comando solo está permitido en threads que pertenezcan a canales tipo foro.'` | `ERROR_FORUM_CHANNEL_REQUIRED` |
| `'⛔ No tienes el rol permitido para usar este comando en el flujo de pruebas.'` | `ERROR_FORUM_ROLE_REQUIRED` |
| `'⛔ Este foro no está habilitado para comandos de ficha...'` | `ERROR_FORUM_NOT_ENABLED` |
| `'⛔ Debes usar tu propio post del foro para ejecutar comandos de ficha.'` | `ERROR_FORUM_OWN_POST_REQUIRED` |

### 12.5 utils/dateParser.ts

| String | Suggested key |
|--------|---------------|
| `'Formato de fecha inválido. Usa DD/MM/YYYY (ej: 15/01/2025) o "hoy".'` | `ERROR_DATE_FORMAT_INVALID` |
| `'Mes inválido. Debe estar entre 01 y 12.'` | `ERROR_DATE_MONTH_INVALID` |
| `'Fecha inválida (ej: 31/02 no existe).'` | `ERROR_DATE_INVALID` |
| `'La fecha no puede ser futura.'` | `ERROR_DATE_FUTURE` |
| `'La fecha no puede ser hace más de ${n} días (${y} años).'` | `ERROR_DATE_TOO_OLD` (template) |

### 12.6 utils/commandThrottle.ts

| String | Suggested key |
|--------|---------------|
| `'⏳ Comando en enfriamiento. Intenta nuevamente en ${s}s.'` | `ERROR_COOLDOWN` (template) |

### 12.7 utils/errorHandler.ts

| String | Suggested key |
|--------|---------------|
| `'↩️ Tip: Presiona Ctrl+Z...'` | `DEFAULT_RECOVERY_TIP` |
| `'## :x: Operacion cancelada'` | `ERROR_PANEL_TITLE` |
| `'Ya existe un registro con esos datos únicos.'` | `ERROR_PRISMA_P2002` |
| `'No se encontró el registro solicitado.'` | `ERROR_PRISMA_P2025` |
| `'Ocurrió un error al procesar la base de datos. Intenta nuevamente.'` | `ERROR_PRISMA_GENERIC` |
| `'Error del sistema. Intenta nuevamente.'` | `ERROR_SYSTEM_FALLBACK` |
| `'Intenta de nuevo en ${s}s.'` | `COOLDOWN_DETAIL` (template) |
