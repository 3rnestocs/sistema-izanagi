# Sistema IZANAGI V2 — Architecture Analysis

> **Date:** March 8, 2026
> **Scope:** Full codebase audit comparing the legacy Google Sheets/Apps Script implementation against the new Discord Bot + PostgreSQL migration.
> **Maintenance Note (March 9, 2026):** This file remains the architectural baseline and migration audit. Some gap/recommendation sections are historical snapshots from the audit date; for current operational state use `README.md` and `planning_logs/QUICK_REFERENCE.md`.

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
│   ├── commands/                   # 19 slash commands
│   │   ├── ajustar_recursos.ts    # Staff: add/remove resources (otorgar/retirar)
│   │   ├── ascender.ts            # Staff: apply rank/level promotion
│   │   ├── cobrar_sueldo.ts       # Player: claim weekly salary
│   │   ├── comprar.ts             # Player: buy items from market
│   │   ├── ficha.ts               # Player/Staff: character profile
│   │   ├── invertir_sp.ts         # Player: distribute stat points
│   │   ├── listar_tienda.ts       # Staff: browse market catalog
│   │   ├── rechazar_registro.ts   # Staff: reject activity record
│   │   ├── retirar_habilidad.ts   # Staff: revoke plaza
│   ├── gestion-fichas/            # Character management commands
│   │   ├── registro.ts            # Player: create character sheet
│   │   ├── ficha.ts               # Player: view character
│   │   ├── invertir_sp.ts         # Player: spend skill points
│   │   ├── otorgar_habilidad.ts   # Staff: grant skill/plaza
│   │   ├── retirar_habilidad.ts   # Staff: revoke skill
│   │   ├── otorgar_rasgo.ts       # Staff: assign/remove traits
│   │   ├── ascender.ts            # Staff: promote character
│   │   ├── validar_ascenso.ts     # Staff: validate promotion
│   │   ├── rechazar_registro.ts   # Staff: reject registration
│   │   ├── catalogo.ts            # Player: browse catalog
│   │   └── listar.ts              # Staff: list characters
│   ├── registro-sucesos/          # Activity registration
│   │   └── registrar_suceso.ts    # Player: submit activity record
│   ├── tienda/                    # Transaction commands
│   │   ├── comprar.ts             # Player: buy items
│   │   ├── vender.ts              # Player: sell items
│   │   ├── transferir.ts          # Player: transfer items/ryou
│   │   ├── cobrar_sueldo.ts       # Player: claim salary
│   │   ├── tienda.ts              # Player: browse shop
│   │   └── listar_tienda.ts       # Staff: list shop
│   └── staff/                     # Staff-only commands
│       ├── npc.ts                 # Staff: NPC management
│       └── ajustar_recursos.ts    # Staff: adjust resources
│   ├── services/                  # 10 business logic services
│   │   ├── CharacterService.ts    # Character creation with trait validation
│   │   ├── LevelUpService.ts      # Legacy compatibility service (kept)
│   │   ├── PromotionService.ts    # Rank/level promotion engine
│   │   ├── PlazaService.ts        # Skill assignment with recursive inheritance
│   │   ├── RewardCalculatorService.ts  # Activity → reward calculation
│   │   ├── SalaryService.ts       # Weekly salary logic
│   │   ├── SkillRankValidator.ts  # Inton vs Element rank rules
│   │   ├── StatValidatorService.ts # SP investment with caps, scales, blocks
│   │   └── TransactionService.ts  # Buy and transfer (atomic)
│   ├── lib/
│   │   ├── commandLoader.ts       # Dynamic command loader
│   │   └── prisma.ts              # Prisma client + disconnect helpers
│   ├── database/                   # 3 seed scripts
│   │   ├── seedMercados.ts        # Market items (Ninja/PR/EXP shops)
│   │   ├── seedPlazas.ts          # Skills/abilities catalog
│   │   └── seedRasgo.ts           # Traits catalog with conflicts
│   ├── deploy/
│   │   └── deploy-commands.ts     # Discord slash command registration
│   ├── events/                    # Currently empty
│   └── utils/                     # Error handling and channel guards
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
| Activity registration | `GenerarRegistros.js` → `registrarAccion()` | `/registrar_suceso` | ✅ Migrated |
| Activity approval + rewards | Staff reacts ✅ on message, or `/ajustar_recursos otorgar` for edge cases | `ActivityApprovalService` + `RewardCalculatorService` | ✅ Improved |
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

Players can now directly use commands like `/registro`, `/invertir_sp`, `/comprar`, `/transferir`, and `/registrar_suceso` without staff intervention. The old system required staff to operate every form.

### 7.6 Automated Reward Calculation

`RewardCalculatorService` automatically computes mission and combat rewards based on rank, result, and character level. The old `GenerarRegistros.js` required staff to manually enter resource amounts.

### 7.7 Structured Promotion Engine

`LevelUpService` codifies all rank/level requirements with automatic validation, snapshot metrics, and explicit manual requirement callouts. The old system used a semaphore (`BLOQUEADO`/`VALIDAR`/`REQUIERE`) but the actual checks were partially manual.

### 7.8 Normalized Catalog Data

Traits, Plazas, and Items live in proper database tables with unique constraints and relational integrity, instead of being spread across sheet columns with magic indices.

---

## 8. Current Risks & Technical Debt (Condensed)

Most critical audit-era issues were resolved (dynamic command loading, Prisma extraction, salary/sell/ficha commands, inheritance seeding, reward multipliers, graceful shutdown). Current debt is concentrated in maintainability and governance.

### High

- No automated tests for core business rules (`StatValidatorService`, `PromotionService`, `PlazaService`, `TransactionService`).
- Hardcoded progression/economy tables in services still require code deployment for rule changes.
- Coarse permission model (`Administrator`) instead of a narrower role-based policy.

### Medium

- `src/events/` remains unused; scheduled/background domain flows are still command-centric.
- `LevelUpService.ts` still exists as a legacy compatibility surface alongside split services.
- Some TypeScript escape hatches (`as any`) remain and reduce static safety.

### Low

- Unused/underused domain fields such as `canCreateNPC`, partial `title` usage, and moral-alignment mechanics not yet enforced.

---

## 9. Remaining Functional Gaps

The migration is functionally complete for core operations (registro, ascensos, actividad, compra/venta, ficha, sueldos, rasgos, plazas), but these gaps remain relevant:

- Bulk activity flows (legacy "ALL" targeting) are not implemented.
- NPC lifecycle tooling is not implemented despite schema support.
- Advanced admin utilities (export/reset/maintenance) are intentionally absent or postponed.

---

## 10. Seed Data Status

Seed data is now JSON-based (`prisma/seed-data/*.json`) and no longer embedded TSV. Inheritance and trait multipliers are seeded, but long-term quality depends on validation discipline.

Current concerns:

- No schema-level validation pipeline for seed JSON before execution.
- Seed consistency checks (cross-reference integrity, duplicate business aliases) are manual.
- Rule-heavy trait mechanics in JSON can drift without tests.

---

## 11. Security & Operational Concerns

- Permission boundaries are broad for staff operations (`Administrator` checks).
- Evidence URL handling still lacks strict validation policy (format/domain/content conventions).
- No explicit rate-limiting layer for command spam control.

---

## 12. Quality Roadmap (Current)

1. Add unit tests for stat progression, promotions, inheritance recursion, and economy atomicity.
2. Add validation guardrails for seed-data integrity and mechanics shape.
3. Introduce role-granular authorization (staff role IDs or policy mapping).
4. Define event/scheduled architecture for periodic workflows.
5. Reduce remaining `any` casts and legacy compatibility surfaces.

---

## 13. Prioritized Recommendations

### Immediate

1. Establish a minimal automated test suite for the four core services.
2. Add input/rate safeguards around activity registration and evidence URLs.
3. Formalize role-based authorization beyond administrator-only checks.

### Next

4. Add seed-data validation checks before `db:seed:*` execution.
5. Decide whether `LevelUpService.ts` remains as compatibility wrapper or is retired.
6. Document business-rule ownership and update process for hardcoded tables.

### Later

7. Add event-driven/scheduled modules under `src/events/`.
8. Implement optional NPC and bulk-operation features based on community demand.

---

## Appendix: Old System File → New System Mapping

| Old File | Purpose | New Equivalent(s) |
|---|---|---|
| `Config.js` | Cell coordinates, constants, vocabulary | `schema.prisma` + service-level constants |
| `GenerarFicha.js` | Character creation | `CharacterService` + `/registro` |
| `GenerarRegistros.js` | Activity registration with rewards | `/registrar_suceso` + `ActivityApprovalService` (reaction-based) + `RewardCalculatorService` |
| `GestorAscensos.js` | Rank/level promotions | `PromotionService` + `/ascender` + `/validar_ascenso` |
| `GestorHabilidades.js` | Skill assign/remove | `PlazaService` + `/otorgar_habilidad` + `/retirar_habilidad` |
| `GestorRasgos.js` | Trait assign/remove | `CharacterService` + `/otorgar_rasgo` |
| `GestorStats.js` | SP distribution | `StatValidatorService` + `/invertir_sp` |
| `GestorTransacciones.js` | Buy/sell/transfer | `TransactionService` + `/comprar` + `/vender` + `/transferir` |
| `OnEditsManager.js` | Reactive UI updates | N/A (replaced by slash command request-response model) |
| `Utilidades.js` | Logging, directory, salary, reset | `AuditLog` model + `SalaryService` + `/cobrar_sueldo` |
