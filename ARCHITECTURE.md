# Sistema IZANAGI V2 — Architecture Analysis

> **Date:** March 8, 2026
> **Scope:** Full codebase audit comparing the legacy Google Sheets/Apps Script implementation against the new Discord Bot + PostgreSQL migration.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Domain Model](#5-domain-model)
6. [Migration Coverage Map](#6-migration-coverage-map)
7. [Advantages of the Migration](#7-advantages-of-the-migration)
8. [Architectural Flaws & Technical Debt](#8-architectural-flaws--technical-debt)
9. [Contradictions & Inconsistencies](#9-contradictions--inconsistencies)
10. [Missing Features (Not Yet Migrated)](#10-missing-features-not-yet-migrated)
11. [Seed Data Issues](#11-seed-data-issues)
12. [Security Considerations](#12-security-considerations)
13. [Recommendations](#13-recommendations)

---

## 1. Project Purpose

**Sistema IZANAGI** is a management system for a Naruto-themed roleplay community. It tracks characters ("fichas"), their stats, traits, skills/abilities ("plazas"), inventory, economy (Ryou/EXP/PR), rank promotions, and activity records (missions, combats, chronicles).

### Legacy System (Google Sheets + Apps Script)

The original system ran entirely inside a Google Spreadsheet with 15+ sheets acting as both UI and database:

- **Staff members** operated through form-like sheets (Gestor de Transacciones, Generador de Ficha, etc.) where they filled in cells and pressed menu buttons to trigger Apps Script functions.
- **Each character had its own sheet** (a copy of `Prototipo_Ficha`) containing stats, inventory, and skill lists.
- **Cell coordinates were hardcoded** in a monolithic `Config.js` mapping every input field, output cell, and data range.
- **Reactive behavior** was handled via `onEdit()` triggers (dropdown changes, live previews, semaphore validations).
- **Concurrency** relied on `LockService` with 10-second timeouts.
- **Data integrity** was best-effort — no transactions, no rollback, manual cleanup on failure.

### Migration Goal

Move to a **Discord bot** backed by a **PostgreSQL relational database** to:

- Eliminate the spreadsheet as a UI bottleneck.
- Reduce staff involvement through automated commands (players self-serve where possible).
- Replace cell-based data with a properly normalized schema with ACID transactions.
- Enable concurrent access without Google Sheets' single-writer lock limitations.
- Improve auditability with structured logs tied to foreign keys.

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js | — |
| Language | TypeScript | ^5.9.3 |
| Bot Framework | discord.js | ^14.25.1 |
| Database | PostgreSQL | — |
| ORM | Prisma | ^7.4.1 |
| DB Adapter | @prisma/adapter-pg | ^7.4.2 |
| PG Client | pg | ^8.19.0 |
| Env Config | dotenv | ^17.3.1 |
| Dev Tools | nodemon, ts-node | ^3.1.14, ^10.9.2 |

### Required Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DISCORD_TOKEN` | Discord bot token |
| `CLIENT_ID` | Discord application ID |
| `GUILD_ID` | Target Discord server ID |

> **Note:** No `.env.example` file exists in the repository.

---

## 3. Directory Structure

```
sistema-izanagi/
├── prisma/
│   └── schema.prisma              # Database schema (14 models)
├── prisma.config.ts               # Prisma config with env binding
├── src/
│   ├── index.ts                   # Entry point: Discord client + Prisma init + command routing
│   ├── commands/                   # 10 slash commands
│   │   ├── aprobar_registro.ts    # Staff: approve activity records
│   │   ├── ascender.ts            # Staff: apply rank/level promotion
│   │   ├── comprar.ts             # Player: buy items from market
│   │   ├── invertir_sp.ts         # Player: distribute stat points
│   │   ├── listar_tienda.ts       # Staff: browse market catalog
│   │   ├── otorgar_habilidad.ts   # Staff: grant skill/plaza to character
│   │   ├── registrar_actividad.ts # Player: submit activity record
│   │   ├── registro.ts            # Player: create character sheet
│   │   ├── transferir.ts          # Player: transfer items/ryou
│   │   └── validar_ascenso.ts     # Both: check promotion requirements
│   ├── services/                   # 7 business logic services
│   │   ├── CharacterService.ts    # Character creation with trait validation
│   │   ├── LevelUpService.ts      # Rank requirements, promotions, weekly salary
│   │   ├── PlazaService.ts        # Skill assignment with recursive inheritance
│   │   ├── RewardCalculatorService.ts  # Activity → reward calculation
│   │   ├── SkillRankValidator.ts  # Inton vs Element rank rules
│   │   ├── StatValidatorService.ts # SP investment with caps, scales, blocks
│   │   └── TransactionService.ts  # Buy and transfer (atomic)
│   ├── database/                   # 3 seed scripts
│   │   ├── seedMercados.ts        # Market items (Ninja/PR/EXP shops)
│   │   ├── seedPlazas.ts          # Skills/abilities catalog
│   │   └── seedRasgo.ts           # Traits catalog with conflicts
│   ├── deploy/
│   │   └── deploy-commands.ts     # Discord slash command registration
│   ├── events/                    # Empty (unused)
│   └── utils/                     # Empty (unused)
├── Old_Appscripts_Implementation/ # Legacy reference (10 files)
├── dist/                          # Compiled output
├── package.json
├── tsconfig.json
└── .gitignore
```

---

## 4. Architecture Overview

### Pattern: Layered Monolith

```
┌─────────────────────────────────────────┐
│           Discord.js Client             │  ← Presentation Layer
│         (Slash Command Router)          │
├─────────────────────────────────────────┤
│          Command Handlers               │  ← Controller Layer
│   (Input parsing, response formatting)  │
├─────────────────────────────────────────┤
│          Service Layer                  │  ← Business Logic Layer
│   (Validation, rules, transactions)     │
├─────────────────────────────────────────┤
│          Prisma ORM + PostgreSQL        │  ← Data Access Layer
│   (Schema, migrations, queries)         │
└─────────────────────────────────────────┘
```

### Data Flow

1. User invokes a Discord slash command (`/registro`, `/comprar`, etc.)
2. `index.ts` routes the interaction to the matching command handler via a `switch` statement.
3. The command handler parses Discord interaction options into DTOs.
4. The handler calls a Service, which executes business logic inside a Prisma `$transaction`.
5. The service returns a result; the handler formats a Discord embed/message and replies.

### Prisma Client Lifecycle

A single `PrismaClient` is instantiated in `index.ts` using the `@prisma/adapter-pg` driver adapter over a `pg.Pool`, and exported as a module-level singleton. Services receive it via constructor injection at the command-module level.

---

## 5. Domain Model

### Entity Relationship Summary

```
Character ──┬── CharacterTrait ──── Trait
             │                        │
             │                    TraitConflict (self-join: Trait ↔ Trait)
             │
             ├── CharacterPlaza ──── Plaza
             │                        │
             │                    PlazaTraitInheritance (Plaza → Trait)
             │                    PlazaPlazaInheritance (Plaza → Plaza, recursive)
             │
             ├── InventoryItem ───── Item
             │
             ├── ActivityRecord
             │
             └── AuditLog
```

### Key Models (14 total)

| Model | Purpose |
|---|---|
| `Character` | Core entity: stats, resources, level, rank, discord binding |
| `Trait` | Catalog of traits with economic modifiers and mechanics (JSON) |
| `Plaza` | Catalog of skills/abilities with inheritance trees |
| `TraitConflict` | M:N incompatibility pairs between traits |
| `CharacterTrait` | Junction: which character has which traits |
| `CharacterPlaza` | Junction: which character has which skills (with rank) |
| `PlazaTraitInheritance` | A plaza auto-grants these traits |
| `PlazaPlazaInheritance` | A plaza auto-grants these child plazas (recursive) |
| `Item` | Market catalog (name, type, price, currency) |
| `InventoryItem` | Character inventory (stackable quantities) |
| `ActivityRecord` | Missions, combats, narrations with approval workflow |
| `AuditLog` | Full audit trail with delta tracking |

---

## 6. Migration Coverage Map

| Feature Domain | Old System (Apps Script) | New System (Discord Bot) | Status |
|---|---|---|---|
| Character creation | `GenerarFicha.js` → `crearPersonaje()` | `CharacterService.createCharacter()` + `/registro` | ✅ Migrated |
| Trait assignment at creation | `GenerarFicha.js` (with RC balance, conflicts) | `CharacterService` (conflicts + RC/Ryou calc) | ✅ Migrated |
| Post-creation trait add/remove | `GestorRasgos.js` → `ejecutarCambioRasgo()` | **No command exists** | ❌ Missing |
| Stat distribution (SP investment) | `GestorStats.js` → `procesarDistribucionStats()` | `StatValidatorService` + `/invertir_sp` | ✅ Migrated |
| Skill/Plaza assignment | `GestorHabilidades.js` → `ejecutarCambioHabilidad()` | `PlazaService.assignPlaza()` + `/otorgar_habilidad` | ✅ Migrated (assign only) |
| Skill/Plaza removal | `GestorHabilidades.js` (revert bonuses, traits, list) | **Not implemented** | ❌ Missing |
| Skill rank upgrade validation | N/A (manual) | `SkillRankValidator` (Inton/Element rules) | ✅ New feature |
| Buy items | `GestorTransacciones.js` → Comprar | `TransactionService.buyItems()` + `/comprar` | ✅ Migrated |
| Sell items | `GestorTransacciones.js` → Vender (50% refund) | **Not implemented** | ❌ Missing |
| Transfer items/Ryou | `GestorTransacciones.js` → Transferir | `TransactionService.transferItems()` + `/transferir` | ✅ Migrated |
| Activity registration | `GenerarRegistros.js` → `registrarAccion()` | `/registrar_actividad` | ✅ Migrated |
| Activity approval + rewards | Manual (staff computed rewards) | `/aprobar_registro` + `RewardCalculatorService` | ✅ Improved |
| Ascension (rank/level) | `GestorAscensos.js` → `registrarAscenso()` | `LevelUpService` + `/ascender` + `/validar_ascenso` | ✅ Migrated |
| Weekly salary | `Utilidades.js` → `iniciarProcesoSueldos()` | `LevelUpService.claimWeeklySalary()` | ⚠️ Logic exists, no command |
| Mirror mode (dual-target activities) | `GenerarRegistros.js` (Curación/Enfrentamiento) | **Not implemented** | ❌ Missing |
| Bulk operations ("ALL" target) | `GenerarRegistros.js` (apply to all characters) | **Not implemented** | ❌ Missing |
| Directory update | `Utilidades.js` → `actualizarDirectorio()` | N/A (relational DB makes this unnecessary) | ✅ Obsolete |
| Factory reset | `Utilidades.js` → `FACTORY_RESET_TOTAL()` | **Not implemented** (and arguably shouldn't be a command) | ⚠️ Low priority |
| Reactive UI updates | `OnEditsManager.js` → `onEdit()` | N/A (Discord slash commands are request-response) | ✅ Obsolete |
| Plaza inheritance seeding | Spreadsheet "Extras" column | Seed script exists but **doesn't create inheritance records** | ❌ Bug |
| Trait stat bonuses at creation | `GenerarFicha.js` (per-trait SP/EXP/Cupo bonuses) | Only `bonusRyou` and `costRC` are applied | ⚠️ Partial |

---

## 7. Advantages of the Migration

### 7.1 Data Integrity

- **ACID Transactions:** Every mutation (character creation, purchases, transfers, promotions) is wrapped in a Prisma `$transaction`. The old system had no rollback mechanism — a failure mid-operation could leave data in an inconsistent state.
- **Foreign Keys & Referential Integrity:** Cascade deletes, unique constraints, and indexed relations replace cell-range lookups.
- **Audit Trail:** `AuditLog` records are created atomically within the same transaction as the data change, with delta fields tracking the exact resource impact.

### 7.2 Elimination of Coordinate Hell

The old `Config.js` contained 100+ cell coordinate constants like `COORD_FICHA_NIVEL: "B6"` and `COORD_GSTATS_INPUT_FUERZA: "D7"`. Any sheet restructuring required updating dozens of coordinates. The new system uses a proper schema where field names are the source of truth.

### 7.3 Concurrent Access

Google Sheets' `LockService` imposed a 10-second mutex on the entire spreadsheet per operation. PostgreSQL handles concurrent transactions natively with row-level locking.

### 7.4 Type Safety

TypeScript DTOs (`CreateCharacterDTO`, `StatInvestmentDTO`, `BuyDTO`, etc.) catch integration errors at compile time. The old system relied on runtime `null`/`undefined` checks against cell values.

### 7.5 Self-Service for Players

Players can now directly use commands like `/registro`, `/invertir_sp`, `/comprar`, `/transferir`, and `/registrar_actividad` without staff intervention. The old system required staff to operate every form.

### 7.6 Automated Reward Calculation

`RewardCalculatorService` automatically computes mission and combat rewards based on rank, result, and character level. The old `GenerarRegistros.js` required staff to manually enter resource amounts.

### 7.7 Structured Promotion Engine

`LevelUpService` codifies all rank/level requirements with automatic validation, snapshot metrics, and explicit manual requirement callouts. The old system used a semaphore (`BLOQUEADO`/`VALIDAR`/`REQUIERE`) but the actual checks were partially manual.

### 7.8 Normalized Catalog Data

Traits, Plazas, and Items live in proper database tables with unique constraints and relational integrity, instead of being spread across sheet columns with magic indices.

---

## 8. Architectural Flaws & Technical Debt

### 8.1 Command Routing (Critical)

**Problem:** `index.ts` uses a manual `switch` statement importing every command individually. Both `index.ts` and `deploy-commands.ts` maintain independent import lists that must be kept in sync.

```typescript
// index.ts — manual routing
switch (interaction.commandName) {
    case 'registro': await registro.execute(interaction); break;
    case 'invertir_sp': await invertirSp.execute(interaction); break;
    // ... 8 more cases
}
```

**Impact:** Adding a new command requires edits in 3 places: the command file, `index.ts`, and `deploy-commands.ts`. This violates the Open/Closed Principle.

**Recommended Fix:** Use Discord.js' `Collection`-based command handler pattern with dynamic file loading.

### 8.2 Prisma Client Export from Entry Point

**Problem:** `prisma` is exported from `index.ts`, and every command file imports it with `import { prisma } from '../index'`. This creates an implicit circular dependency risk and couples the entire service layer to the bot's entry point.

**Recommended Fix:** Create a dedicated `src/lib/prisma.ts` or `src/database/client.ts` module.

### 8.3 Service Instantiation at Module Level

**Problem:** Services are instantiated as module-level singletons in each command file:

```typescript
const transactionService = new TransactionService(prisma);
```

This runs at import time, before the application is fully initialized.

**Recommended Fix:** Implement a simple dependency injection container or a centralized service registry.

### 8.4 `relationMode = "prisma"` on PostgreSQL

**Problem:** The schema uses `relationMode = "prisma"`, which emulates foreign keys at the Prisma client level instead of creating actual database constraints. This mode was designed for databases that don't support foreign keys (like PlanetScale MySQL).

**Impact:** PostgreSQL natively supports foreign keys. Using `relationMode = "prisma"` means:
- No database-level referential integrity.
- No `ON DELETE CASCADE` enforced by the database.
- Prisma must handle all relation logic in the application layer.
- Performance penalty on relational queries.

**Recommended Fix:** Remove `relationMode = "prisma"` to use native PostgreSQL foreign keys.

### 8.5 `as any` Type Casts

Multiple occurrences of `as any` or `as never` bypass TypeScript's type system:

- `new PrismaClient({ adapter } as any)` in `index.ts` and all seed files.
- `const executeLogic = async (tx: any)` in `PlazaService`.
- `character.traits.map((ct: any) => ct.trait)` in `invertir_sp.ts`.

### 8.6 No Error Handling Middleware

Every command handler has its own `try/catch` block with a nearly identical pattern:

```typescript
try { /* ... */ } catch (error: any) {
    return interaction.editReply(`❌ ${error.message}`);
}
```

There's no centralized error handling, logging, or error classification.

### 8.7 No Test Suite

Zero tests exist. Given the complexity of the business rules (stat scales, rank requirements, trait conflicts, recursive inheritance), this is a significant risk.

### 8.8 No Graceful Shutdown

The bot doesn't handle `SIGINT`/`SIGTERM` signals. The `pg.Pool` and `PrismaClient` are never properly disconnected on process exit.

### 8.9 Empty Scaffolding

`src/events/` and `src/utils/` directories exist but are empty, suggesting planned but unimplemented features.

### 8.10 Hardcoded Business Rules

All rank requirements, salary tables, stat scales, rank caps, and level thresholds are hardcoded as `readonly` class properties. While this is type-safe, it means any rule change requires a code deployment. The old system shared this problem with its `Config.js`.

### 8.11 LevelUpService is Oversized (~815 lines)

This single service handles three distinct responsibilities:
1. Rank requirement validation (9 ranks, each with unique rules).
2. Level requirement validation (13 levels).
3. Weekly salary calculation.

This should be split into at least two services: `PromotionService` and `SalaryService`.

### 8.12 PlazaService Recursive Inheritance Has No Cycle Guard

`assignPlaza()` calls itself recursively for inherited child plazas. If the `PlazaPlazaInheritance` table contains a cycle (A → B → A), this will stack overflow.

---

## 9. Contradictions & Inconsistencies

### 9.1 `maxHolders = 0` Blocks Plaza Assignment

In `seedPlazas.ts`, the "Plazas Totales" column for basic elements (Katon, Fuuton, etc.) is `0`, meaning "unlimited" in the old system. However, `PlazaService` treats `0` as "no slots available":

```typescript
if (plaza.maxHolders <= 0) {
    throw new Error(`⛔ '${plaza.name}' no tiene plazas disponibles en el sistema.`);
}
```

**Result:** Basic elements (Katon, Fuuton, Raiton, Doton, Suiton, Iryouninjutsu, Inton Genjutsu, Fuuinjutsu) and many others with `maxHolders = 0` **cannot be assigned** in the new system, despite being the most common abilities.

### 9.2 Salary Logic Exists but No Command Exposes It

`LevelUpService.claimWeeklySalary()` is fully implemented (base salary by rank, trait weekly bonuses, monday multiplier, 7-day cooldown), but no slash command exists to invoke it. The old `iniciarProcesoSueldos()` was a staff-triggered batch operation.

### 9.3 Trait Stat Bonuses Ignored at Character Creation

The old `GenerarFicha.js` applied per-trait resource bonuses (EXP, SP, Cupos) from columns 3–8 of the trait database. The new `CharacterService.createCharacter()` only sums `bonusRyou` and `costRC`:

```typescript
totalRcCost += trait.costRC;
totalRyouBonus += trait.bonusRyou;
// EXP, SP, Cupos from trait effects → NOT applied
```

Traits like "Noble" (+10 EXP at creation), "Astuto" (+2 Cupos), or "Sabio" (+2 Chakra) have their secondary effects **silently dropped** during character creation.

### 9.4 RewardCalculator Ignores Trait Multipliers

The old `GenerarRegistros.js` applied trait-based multipliers to all resource gains/losses (e.g., Ambicioso ×1.5 on Ryou income, Presteza ×1.5 on EXP). The new `RewardCalculatorService.calculateRewards()` returns flat values without consulting character traits.

### 9.5 `listar_tienda` is Staff-Only

The market listing command requires `Administrator` permissions. Players who use `/comprar` have no way to browse available items through the bot.

### 9.6 `canCreateNPC` and `title` Fields Underutilized

- `canCreateNPC` is defined in the schema but never referenced in any service or command.
- `title` is only checked by `hasSanninTitle()` via a loose `.includes('sannin')` match. The old system had structured title management.

### 9.7 Moral Field Stored but Not Enforced

The `moral` field is saved on the `Character` model but has no mechanical effect. The old system gave combat bonuses (+2 to specific actions) based on alignment (Bueno-Legal, Malo-Caótico, etc.). The trait seeds include 9 moral traits but the RewardCalculator and combat logic don't reference them.

### 9.8 Rank Value Mismatch Between Services

`LevelUpService` stores rank as display strings (`"Genin"`, `"Chuunin"`), but some validation checks compare against uppercase constant keys (`"ANBU"`, `"Jounin"`). The `Buntaichoo` check requires `character.rank !== 'ANBU'`, but the system stores the display name (from `RANK_DISPLAY_NAMES`), which is also `'ANBU'` — this works by coincidence for ANBU but could fail for others if display names diverge from comparison keys.

### 9.9 Seed Scripts Don't Create Inheritance Relationships

`seedPlazas.ts` parses the "Extras" column (child plazas) and "Rasgo Gratis" column (inherited traits) from the TSV data, but **never creates** `PlazaPlazaInheritance` or `PlazaTraitInheritance` records. The inheritance columns are read but discarded:

```typescript
// These columns are read but never used to create relationships:
// columnas[7]  → "Extras" (e.g., "Suiton, Fuuton" for Hyouton)
// columnas[10] → "Rasgo Gratis" (e.g., "Presteza" for Uchiha)
```

**Result:** Recursive inheritance — the core feature of `PlazaService.assignPlaza()` — has **no seed data** to operate on.

---

## 10. Missing Features (Not Yet Migrated)

### High Priority

| Feature | Old Implementation | Notes |
|---|---|---|
| **Sell items** | `GestorTransacciones.js` (50% refund) | `SELL_PERCENTAGE = 0.5` constant exists in `TransactionService` but `sellItems()` is not implemented |
| **Weekly salary command** | `Utilidades.js` → `iniciarProcesoSueldos()` | Logic exists in `LevelUpService.claimWeeklySalary()`, just needs a `/cobrar_sueldo` command |
| **Post-creation trait management** | `GestorRasgos.js` → `ejecutarCambioRasgo()` | Add/remove traits after character creation, with RC balance and stat adjustments |
| **Plaza removal** | `GestorHabilidades.js` (revert bonuses, traits) | Only assignment is implemented, not revocation |
| **Plaza inheritance seed data** | Spreadsheet "Extras" + "Rasgo Gratis" columns | Seed script reads but doesn't persist these relationships |
| **Activity rejection** | Implicit in old system (staff just didn't register it) | Only `/aprobar_registro` exists; no `/rechazar_registro` |

### Medium Priority

| Feature | Notes |
|---|---|
| **Player-facing shop browsing** | `/listar_tienda` is staff-only; players need a `/tienda` command |
| **Character profile/ficha viewer** | No `/ficha` or `/perfil` command to view stats, traits, inventory |
| **Trait multipliers on activity rewards** | RewardCalculator should apply Presteza (×1.5 EXP), Ambicioso (×1.5 Ryou), etc. |
| **Trait stat bonuses at creation** | EXP, SP, Cupos from traits like Noble, Astuto, Sabio should be applied |
| **Bulk activity registration** | Old system supported "ALL" target for events/chronicles |

### Low Priority

| Feature | Notes |
|---|---|
| Log sorting/pagination | Old system had `MANTENIMIENTO_ORDENAR_LOGS()` |
| Admin utilities (data export, reset) | Old system had `FACTORY_RESET_TOTAL()` |
| NPC creation system | `canCreateNPC` field exists but is unused |

---

## 11. Seed Data Issues

### 11.1 TSV Embedded as Template Literals

All three seed scripts embed their data as multi-line template literal strings containing tab-separated values. This is fragile:
- Hard to maintain or diff.
- No type safety on parsed values.
- Encoding issues with special characters.

**Recommendation:** Move to JSON/YAML seed files or Prisma's native seed mechanism.

### 11.2 Each Seed Script Creates Its Own Prisma Client

Every seed file independently creates a `Pool`, `PrismaPg` adapter, and `PrismaClient`. This duplicates boilerplate and wastes connections.

### 11.3 seedRasgo Doesn't Map All Trait Effects

Many trait effects from the old system are partially or not mapped:

| Effect | Old System | New Seed |
|---|---|---|
| Stat blocks (Torpeza → Armas, Lento → Velocidad) | Columns in DB | Not stored in `mechanics` JSON |
| Golden Point grants | Per-trait authorization | Not stored in `mechanics` JSON |
| EXP multipliers (Presteza ×1.5, Arrepentimiento ×0.5) | Column 13 | `multiplierGanancia` is always set to `1` (hardcoded) |
| PR multipliers (Leyenda ×1.25, Presionado ×0.75) | Implied by columns | Not mapped at all |
| Initial EXP bonus (Noble +10, Rico +5) | Column "Afecta_2" | Not applied during character creation |

### 11.4 seedPlazas Category Renaming is Incomplete

The seed renames `"Habilidades Secundarias"` → `"Complementarios"` and `"Habilidades Especiales"` → `"Especiales"`, but `PlazaService.isDevelopableCategory()` checks for keywords like `"complement"` (lowercase partial match). This works for "Complementarios" but the renaming introduces a deviation from the original naming that could cause confusion.

---

## 12. Security Considerations

### 12.1 Permission Checks

Staff commands (`/ascender`, `/aprobar_registro`, `/otorgar_habilidad`, `/listar_tienda`) check for `PermissionFlagsBits.Administrator`. This is a coarse permission model — in the old system, specific email addresses were whitelisted in `STAFF_EMAILS`.

### 12.2 No Input Sanitization Beyond Discord's Built-in

Command options are parsed directly from Discord interaction data. While Discord sanitizes slash command inputs, string options (item names, trait names, evidence URLs) are passed directly to database queries. Prisma's parameterized queries prevent SQL injection, but there's no validation of URL formats or content length.

### 12.3 No Rate Limiting

There's no protection against command spam. A user could rapidly invoke `/registrar_actividad` to flood the activity table or `/comprar` to stress the transaction system.

### 12.4 Evidence URLs Not Validated

`registrar_actividad` and `otorgar_habilidad` accept arbitrary strings as "evidence" URLs. These are stored and displayed without validation, enabling potential phishing links or garbage data.

---

## 13. Recommendations

### Immediate (Bug Fixes)

1. **Fix `maxHolders = 0` interpretation.** Treat `0` as unlimited (matching old system behavior) or update seed data to use a high number like `999`.
2. **Seed inheritance relationships.** Parse "Extras" and "Rasgo Gratis" columns in `seedPlazas.ts` to create `PlazaPlazaInheritance` and `PlazaTraitInheritance` records.
3. **Remove `relationMode = "prisma"`.** Let PostgreSQL handle foreign keys natively.
4. **Fix trait bonuses at character creation.** Apply EXP, SP, Cupos, and stat bonuses from traits (not just Ryou and RC).
5. **Map `multiplierGanancia` properly in seedRasgo.** Traits like Presteza, Leyenda, Ambicioso have income multipliers that are currently hardcoded to `1`.

### Short-Term (Architecture)

6. **Implement dynamic command handler.** Replace the switch statement with a `Collection`-based loader that auto-discovers command files.
7. **Extract Prisma client to a dedicated module.** Break the `index.ts` → services circular dependency.
8. **Add centralized error handling.** Create an interaction error wrapper that logs, classifies, and formats errors consistently.
9. **Add cycle detection to PlazaService.** Track visited plaza IDs during recursive inheritance to prevent infinite loops.
10. **Split LevelUpService.** Extract salary logic into `SalaryService` and consider a data-driven promotion rules engine.

### Medium-Term (Features)

11. **Implement missing commands:** `/cobrar_sueldo`, `/vender`, `/ficha`, `/tienda` (player-facing), `/otorgar_rasgo`, `/retirar_habilidad`, `/rechazar_registro`.
12. **Apply trait multipliers in RewardCalculatorService.** Check character traits for income/expense modifiers when calculating activity rewards.
13. **Add character profile command.** Let players view their stats, traits, plazas, inventory, and recent logs.
14. **Implement graceful shutdown.** Handle `SIGINT`/`SIGTERM` to disconnect Prisma and close the PG pool.

### Long-Term (Quality)

15. **Add test suite.** Priority targets: `StatValidatorService`, `LevelUpService`, `PlazaService` (recursive inheritance), `TransactionService` (atomicity).
16. **Create `.env.example` and README.** Document setup, commands, and architecture for onboarding.
17. **Move seed data to structured files.** Replace embedded TSV strings with JSON or YAML seed files.
18. **Consider an event-driven architecture.** Use Discord.js event emitters and the empty `src/events/` directory for guild member events, scheduled tasks (weekly salary cron), and webhook integrations.
19. **Add database migrations.** Use `prisma migrate` instead of `prisma db push` for production-safe schema changes.

---

## Appendix: Old System File → New System Mapping

| Old File | Purpose | New Equivalent(s) |
|---|---|---|
| `Config.js` | Cell coordinates, constants, vocabulary | `schema.prisma` + service-level constants |
| `GenerarFicha.js` | Character creation | `CharacterService` + `/registro` |
| `GenerarRegistros.js` | Activity registration with rewards | `/registrar_actividad` + `/aprobar_registro` + `RewardCalculatorService` |
| `GestorAscensos.js` | Rank/level promotions | `LevelUpService` + `/ascender` + `/validar_ascenso` |
| `GestorHabilidades.js` | Skill assign/remove | `PlazaService` + `/otorgar_habilidad` (assign only) |
| `GestorRasgos.js` | Trait assign/remove | `CharacterService` (creation only, no post-creation management) |
| `GestorStats.js` | SP distribution | `StatValidatorService` + `/invertir_sp` |
| `GestorTransacciones.js` | Buy/sell/transfer | `TransactionService` + `/comprar` + `/transferir` (no sell) |
| `OnEditsManager.js` | Reactive UI updates | N/A (replaced by slash command request-response model) |
| `Utilidades.js` | Logging, directory, salary, reset | `AuditLog` model + `LevelUpService.claimWeeklySalary()` (partial) |
