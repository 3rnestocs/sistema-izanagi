# Localization Guide — `src/config/`

Reference for where user-facing strings live and how to find or add them. All localized strings are centralized in `src/config/` for consistency and reuse.

---

## Quick reference: where to find strings

| If you need to change… | File |
|------------------------|------|
| Date option descriptions, embed field labels, historial messages | `uiStrings.ts` |
| Error thrown by a service (e.g. "Personaje no encontrado") | `serviceErrors.ts` |
| Promotion requirement message (e.g. "EXP insuficiente") | `requirementMessages.ts` |
| Audit log category (e.g. "Ascenso", "Sueldo Semanal") | `auditLogCategories.ts` |
| Audit log evidence (e.g. "Comando /ascender") | `evidenceStrings.ts` |
| Audit log detail template (e.g. "Ascenso aplicado por…") | `auditDetailTemplates.ts` |
| Rank display names (Chuunin, Jounin, etc.) | `rankConfig.ts` |
| Salary amounts, cooldown days | `salaryConfig.ts` |
| Resource labels (Ryou, EXP, PR) | `resourceLabels.ts` |
| Slash command choices (severidad, cargo, currency) | `choices.ts` |
| Command names for slash references | `commandNames.ts` |
| Activity rewards, catalogs, tiers | `activityRewards.ts` |
| Narration prefixes, historical rewards | `historicalNarrations.ts` |

---

## Config file inventory

| File | Purpose | Consumers |
|------|---------|-----------|
| **uiStrings.ts** | UI text: date hints, errors, embed fields, historial, modals | commands/*, utils/*, index.ts |
| **serviceErrors.ts** | Service-layer error messages (`throw new Error`) | services/* |
| **requirementMessages.ts** | LevelUpService promotion requirement messages | LevelUpService |
| **auditLogCategories.ts** | AuditLog `category` field values | services/*, historial, backfillGradationHistory |
| **evidenceStrings.ts** | AuditLog `evidence` field values | services/* |
| **auditDetailTemplates.ts** | AuditLog `detail` templates (ascenso, salary) | LevelUpService |
| **rankConfig.ts** | Rank display names, Sannin discount targets | LevelUpService, PromotionService |
| **salaryConfig.ts** | Base salaries, cooldown days, weekly EXP | LevelUpService, SalaryService |
| **requirements.ts** | Optional requirement IDs for promotion | LevelUpService |
| **resourceLabels.ts** | Resource display names (Ryou, EXP, PR, etc.) | historial, ajustar_recursos, ResourceAdjustmentService |
| **choices.ts** | Slash command option choices (severidad, cargo, store currency, activity results) | registrar_suceso, ascender, tienda, listar_tienda |
| **commandNames.ts** | Command name constants for slash command references | historial, forzar_ascenso, cobrar_sueldo, etc. |
| **activityRewards.ts** | Domain data: rewards, tiers, catalogs | RewardCalculatorService, ActivityCapService, registrar_suceso, historial |
| **historicalNarrations.ts** | Narration prefixes, historical rewards | registrar_suceso, RewardCalculatorService |
| **newbieBoost.ts** | Newbie boost config (env + logic) | LevelUpService, RewardCalculatorService |
| **errorHandlerStrings.ts** | Error handler panel messages, Prisma errors | errorHandler |
| **logStrings.ts** | Console/log output (dev-facing) | index.ts |

---

## File organization

### Section comments

Use `// --- SectionName ---` to group related exports. Order sections by consumer (most shared first) or by domain.

**serviceErrors.ts** — group by consumer:

```
// --- Generic (multiple services) ---
// --- ResourceAdjustmentService ---
// --- LevelUpService / PromotionService ---
// --- TransactionService ---
// --- NpcService ---
// --- RewardCalculatorService ---
// --- CharacterService ---
```

**uiStrings.ts** — group by purpose:

```
// --- Date options ---
// --- Date validation errors ---
// --- Permission errors ---
// --- Embed fields (salary, transfer) ---
// --- Historial ---
// --- Modals (ficha image, etc.) ---
```

**requirementMessages.ts** — group by domain:

```
// --- Generic templates ---
// --- Rank-specific (checkRankRequirements) ---
// --- Level-specific: manual review ---
// --- Level-specific: time gates ---
// --- Level-specific: PR ---
// --- Level-specific: S1 ---
// --- Optional requirement group messages ---
```

### File headers

Each config file header should include:

1. **Purpose** — what kind of strings it holds
2. **Consumers** — which files import from it
3. **When to add here** — guidance for new strings

Example:

```ts
/**
 * Centralized error messages for services.
 * Use these instead of hardcoded strings for consistency.
 *
 * Consumers: LevelUpService, PromotionService, SalaryService, TransactionService,
 * CharacterService, ResourceAdjustmentService, NpcService, RewardCalculatorService,
 * BuildApprovalService.
 *
 * Add here: any throw new Error(...) message from src/services/.
 */
```

---

## Guidelines

### Localize

- User-facing error messages
- Embed field labels, button labels
- Date format hints, option descriptions
- Audit log category, evidence, and detail strings
- Promotion requirement messages
- Resource and rank display names

### Do not localize

- **Long narrative content** (e.g. bienvenida embed): keep as template literals; separate phase if needed
- **Dynamic strings** with interpolated values (e.g. `Ficha de ${character.name}`): keep as template literals; extract only shared patterns
- **Discord option names** (e.g. `usuario`, `fecha`, `cargo`): internal IDs; keep as-is
- **Audit format contract strings** (e.g. `'Ascenso de nivel:'`, `'Nivel:'` in backfillGradationHistory): must match what services write; document in code comments
- **Product catalog data** in seeds: domain content stored in DB

### Cross-references

- **Cronica vs Crónica**: `activityRewards.ts` uses `Cronica`; `historicalNarrations.ts` uses `Crónica`. `ActivityType.CRONICA` = `'Crónica'`. Align keys for consistency.
- **CARGO_CHOICES**: Derive from `Object.keys(BASE_SALARIES).filter(k => k !== 'Genin')` to avoid drift.
- **Herido Critico**: `choices.ts` has one-off `key === 'Herido Critico' ? 'Herido Crítico' : key` for display.
