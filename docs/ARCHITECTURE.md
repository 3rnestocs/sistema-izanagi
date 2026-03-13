# Sistema IZANAGI — Architecture Analysis

> **Date:** March 13, 2026
> **Scope:** Architectural baseline for the Discord bot + PostgreSQL system. For current operational state see `README.md` and `docs/QUICK_REFERENCE.md`.

---

## Table of Contents

1. [Project Purpose](#1-project-purpose)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Architecture Overview](#4-architecture-overview)
5. [Domain Model](#5-domain-model)
6. [Gaps, Risks & Technical Debt](#6-gaps-risks--technical-debt)
7. [Advantages](#7-advantages)
8. [Seed Data Status](#8-seed-data-status)
9. [Security & Operational Concerns](#9-security--operational-concerns)
10. [Quality Roadmap](#10-quality-roadmap)
11. [Prioritized Recommendations](#11-prioritized-recommendations)

---

## 1. Project Purpose

**Sistema IZANAGI** is a management system for a Naruto-themed roleplay community. It tracks characters ("fichas"), their stats, traits, skills/abilities ("plazas"), inventory, economy (Ryou/EXP/PR), rank promotions, and activity records (missions, combats, chronicles).

The system is a **Discord bot** backed by **PostgreSQL**: slash commands for self-service where possible, a normalized schema with ACID transactions, and structured audit logs.

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
| `CLIENT_ID` | Discord application ID (deploy) |
| `GUILD_ID` | Target Discord server ID (deploy) |
| `BUILD_APPROVAL_FORUM_ID` | Forum channel for character build approval |
| `REGISTRO_SUCESOS_FORUM_ID` | Forum channel for activity registration |
| `GESTION_FORUM_ID` | Gestion/fichas forum ID (channel guards) |
| `TIENDA_FORUM_ID` | Tienda forum ID (channel guards) |
| `PLAYER_FORUM_CHANNEL_IDS` | Comma-separated channel IDs where players can run commands |
| `PLAYER_ALLOWED_ROLE_IDS` | Comma-separated role IDs allowed in player channels |
| `PLAYER_COMMAND_FORUM_MAP` | Optional mapping of command → forum (channel guards) |
| `STAFF_ALLOWED_ROLE_IDS` | Comma-separated role IDs for staff-only commands |
| `BIENVENIDA_ALLOWED_USER_ID` | Optional user ID allowed to run welcome flow |
| `ENABLE_MISSION_RANK_LIMITS` | `true`/`false` — enable rank-based mission caps (default `false`) |
| `NPC_REQUIRE_CAN_CREATE` | `true`/`false` — require `canCreateNPC` for NPC commands (default `false`) |

---

## 3. Directory Structure

```
sistema-izanagi/
├── prisma/
│   ├── schema.prisma              # Database schema (14 models)
│   ├── migrations/                # Prisma migrations
│   └── seed-data/                 # JSON data for seeds
│       ├── traits.json
│       └── plazas.json
├── prisma.config.ts               # Prisma config with env binding
├── src/
│   ├── index.ts                   # Entry point: Discord client + Prisma init + command routing
│   ├── commands/                  # 22 slash commands (grouped by feature)
│   │   ├── gestion-fichas/        # Character management
│   │   │   ├── registro.ts        # Player: create character sheet
│   │   │   ├── ficha.ts           # Player: view character
│   │   │   ├── invertir_sp.ts     # Player: spend skill points
│   │   │   ├── otorgar_habilidad.ts   # Staff: grant skill/plaza
│   │   │   ├── retirar_habilidad.ts   # Staff: revoke skill
│   │   │   ├── otorgar_rasgo.ts   # Staff: assign/remove traits
│   │   │   ├── ascender.ts        # Staff: promote character
│   │   │   ├── validar_ascenso.ts # Staff: validate promotion
│   │   │   ├── rechazar_registro.ts   # Staff: reject registration
│   │   │   ├── catalogo.ts        # Player: browse catalog
│   │   │   ├── listar.ts          # Staff: list characters
│   │   │   └── historial.ts       # Player/Staff: character history
│   │   ├── registro-sucesos/      # Activity registration
│   │   │   └── registrar_suceso.ts    # Player: submit activity record
│   │   ├── tienda/                # Transactions & shop
│   │   │   ├── comprar.ts         # Player: buy items
│   │   │   ├── vender.ts          # Player: sell items
│   │   │   ├── transferir.ts      # Player: transfer items/ryou
│   │   │   ├── cobrar_sueldo.ts   # Player: claim salary
│   │   │   ├── tienda.ts          # Player: browse shop
│   │   │   └── listar_tienda.ts   # Staff: list shop
│   │   └── staff/                 # Staff-only commands
│   │       ├── npc.ts             # Staff: NPC management
│   │       ├── ajustar_recursos.ts    # Staff: adjust resources
│   │       └── bienvenida.ts      # Staff: welcome flow
│   ├── services/                  # Business logic (16 services)
│   │   ├── CharacterService.ts    # Character creation with trait validation
│   │   ├── TraitRuleService.ts    # Trait rules and nacimiento gradations
│   │   ├── LevelUpService.ts      # Legacy compatibility (kept)
│   │   ├── PromotionService.ts    # Rank/level promotion engine
│   │   ├── PlazaService.ts        # Skill assignment with recursive inheritance
│   │   ├── PlazaInheritanceResolver.ts  # Plaza inheritance resolution
│   │   ├── RewardCalculatorService.ts   # Activity → reward calculation
│   │   ├── SalaryService.ts       # Weekly salary logic
│   │   ├── SkillRankValidator.ts  # Inton vs Element rank rules
│   │   ├── StatValidatorService.ts    # SP investment with caps, scales, blocks
│   │   ├── TransactionService.ts  # Buy and transfer (atomic)
│   │   ├── NpcService.ts          # NPC CRUD and logic
│   │   ├── ResourceAdjustmentService.ts # Staff resource adjustments
│   │   ├── BuildApprovalService.ts     # Character build approval
│   │   ├── ActivityCapService.ts  # Activity caps and limits
│   │   └── ActivityApprovalService.ts  # Activity record approval
│   ├── domain/
│   │   └── activityDomain.ts      # Activity domain types/DTOs
│   ├── config/
│   │   ├── commandNames.ts        # Slash command name constants
│   │   ├── activityRewards.ts     # Reward configuration
│   │   └── historicalNarrations.ts    # Narration strings
│   ├── lib/
│   │   ├── commandLoader.ts       # Dynamic command loader
│   │   └── prisma.ts              # Prisma client + disconnect helpers
│   ├── database/                  # Seeds and maintenance scripts
│   │   ├── seedMercados.ts        # Market items (Ninja/PR/EXP shops)
│   │   ├── seedPlazas.ts          # Skills/abilities catalog
│   │   ├── seedRasgo.ts           # Traits catalog with conflicts
│   │   ├── auditPlazaTraitInheritance.ts
│   │   └── backfillGradationHistory.ts
│   ├── deploy/
│   │   └── deploy-commands.ts     # Discord slash command registration
│   ├── events/                    # Currently empty
│   └── utils/
│   │   ├── errorHandler.ts       # Error handling
│   │   ├── channelGuards.ts      # Channel guards
│   │   ├── channelRefs.ts        # Channel references
│   │   ├── staffGuards.ts        # Staff permission checks
│   │   ├── commandThrottle.ts    # Command throttling
│   │   └── dateParser.ts         # Date parsing utilities
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

## 6. Gaps, Risks & Technical Debt

### Missing or Incomplete Functionality

| Area | Status |
|---|---|
| Skill/Plaza removal | Not implemented (revert bonuses, traits; `/retirar_habilidad` exists but full revert flow may be incomplete) |
| Mirror mode (dual-target activities, e.g. Curación/Enfrentamiento) | Not implemented |
| Sell items | `/vender` exists; confirm 50% refund and full parity if required |
| Bulk activity flows (ALL targeting) | Not implemented |
| Post-creation trait add/remove | `/otorgar_rasgo` exists; confirm add/remove parity and validation |
| Plaza inheritance seeding | Seed script exists but may not create inheritance records; verify |
| Weekly salary | Implemented via `SalaryService` + `/cobrar_sueldo` |
| Trait stat bonuses at creation | Only `bonusRyou` and `costRC` applied; other per-trait bonuses may be partial |
| Factory reset / bulk admin utilities | Intentionally absent or low priority |

### Technical Debt & Risks

**High**

- No automated tests for core business rules (`StatValidatorService`, `PromotionService`, `PlazaService`, `TransactionService`).
- Hardcoded progression/economy tables in services; rule changes require code deployment.
- Coarse permission model (`Administrator` / `STAFF_ALLOWED_ROLE_IDS`) instead of finer role-based policy.

**Medium**

- `src/events/` unused; scheduled/background flows are command-centric.
- `LevelUpService.ts` kept as compatibility surface alongside split services.
- Some TypeScript escape hatches (`as any`) reduce static safety.

**Low**

- Unused/underused domain fields: `canCreateNPC`, partial `title` usage, moral-alignment mechanics not enforced.

### Remaining Functional Gaps

- Bulk activity flows (ALL targeting) are not implemented.
- NPC lifecycle tooling is not implemented despite schema support.
- Advanced admin utilities (export/reset/maintenance) are intentionally absent or postponed.

---

## 7. Advantages

### Data Integrity

- **ACID transactions:** Every mutation (character creation, purchases, transfers, promotions) runs inside a Prisma `$transaction` with rollback on failure.
- **Referential integrity:** Cascade deletes, unique constraints, and indexed relations.
- **Audit trail:** `AuditLog` records are created atomically with the data change, with delta fields for resource impact.

### Concurrency & Type Safety

- PostgreSQL handles concurrent transactions with row-level locking.
- TypeScript DTOs (`CreateCharacterDTO`, `StatInvestmentDTO`, `BuyDTO`, etc.) catch integration errors at compile time.

### Self-Service & Automation

- Players use `/registro`, `/invertir_sp`, `/comprar`, `/transferir`, `/registrar_suceso` without staff intervention.
- `RewardCalculatorService` computes mission and combat rewards from rank, result, and level.
- `LevelUpService` / `PromotionService` codify rank/level requirements with validation and snapshot metrics.

### Normalized Data

- Traits, Plazas, and Items live in database tables with unique constraints and relations.

---

## 8. Seed Data Status

Seed data is JSON-based (`prisma/seed-data/*.json`). Inheritance and trait multipliers are seeded; long-term quality depends on validation discipline.

Current concerns:

- No schema-level validation pipeline for seed JSON before execution.
- Seed consistency checks (cross-reference integrity, duplicate business aliases) are manual.
- Rule-heavy trait mechanics in JSON can drift without tests.

---

## 9. Security & Operational Concerns

- Permission boundaries are broad for staff operations (`Administrator` checks).
- Evidence URL handling still lacks strict validation policy (format/domain/content conventions).
- No explicit rate-limiting layer for command spam control.

---

## 10. Quality Roadmap

1. Add unit tests for stat progression, promotions, inheritance recursion, and economy atomicity.
2. Add validation guardrails for seed-data integrity and mechanics shape.
3. Introduce role-granular authorization (staff role IDs or policy mapping).
4. Define event/scheduled architecture for periodic workflows.
5. Reduce remaining `any` casts and compatibility shims.

---

## 11. Prioritized Recommendations

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

