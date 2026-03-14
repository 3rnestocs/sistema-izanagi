# Quick Reference — IZANAGI V2

Last updated: March 14, 2026

## Canonical Docs

- `../../README.md`
- `../../ARCHITECTURE.md`
- `CHAKRA_NACIMIENTO_RULES_UPDATE.md`

## Project Layout (Operational)

```text
src/
  commands/      Slash commands (player + staff)
  config/        Static rules, rewards, requirements (OPTIONAL_REQUIREMENTS), command names
  database/      Seed scripts and migration backfills
  domain/        Domain logic and types (e.g., activity models)
  services/      Business rules and transactional logic
  utils/         Guards, throttles, date parsing (dayjs/America/Caracas for salary), error handling
prisma/
  schema.prisma
  seed-data/     JSON seed sources
```

## Core Runtime Files

- `src/index.ts`: Discord client startup and command interaction flow.
- `src/lib/prisma.ts`: Prisma/PG initialization and disconnect routine.
- `src/lib/commandLoader.ts`: Dynamic command discovery.
- `src/deploy/deploy-commands.ts`: Slash command registration.

## Command Groups

Player commands:
- `/registro`
- `/ficha`
- `/historial`
- `/registrar_suceso`
- `/comprar`
- `/vender`
- `/tienda`
- `/transferir`
- `/cobrar_sueldo`
- `/otorgar_habilidad` (Initiates request)

Staff/Admin commands:
- `/ascender`
- `/ajustar_recursos` (retirar/otorgar recursos)
- `/rechazar_registro`
- `/otorgar_rasgo`
- `/retirar_habilidad`
- `/listar_tienda`
- `/catalogo`
- `/listar`
- `/npc` (crear/listar/retirar)
- `/bienvenida`
- `/forzar_sueldo`

## Service Map

Routing & Approval Services:
- `ReactionApprovalRouter`: Centralized dispatcher for ✅ emoji workflows.
- `PromotionApprovalService`: Handles pending rank/level promotions.
- `WishApprovalHandler`: Handles pending /otorgar_habilidad requests (reads PendingWish by messageId).

Core Services:
- `CharacterService`: Character creation and trait management.
- `PlazaService`: Plaza assignment/removal and inheritance handling.
- `PlazaInheritanceResolver`: Dedicated service for recursive child-plaza logic.
- `PromotionService`: Rank/level validation and promotions.
- `SalaryService`: Weekly salary, cooldown, and modifiers.
- `TransactionService`: Buy/sell/transfer economy operations.
- `StatValidatorService`: SP investment and stat caps/rules.
- `SkillRankValidator`: Skill rank progression constraints.
- `TraitRuleService`: Specialized trait mechanics validation.

Activity & Admin Services:
- `ActivityApprovalService`: Activity approval by staff reaction (checkmark).
- `ActivityCapService`: Enforces weekly limits (e.g., combats vs. curations).
- `RewardCalculatorService`: Activity reward calculations with multipliers.
- `BuildApprovalService`: Build approval flow support.
- `ResourceAdjustmentService`: Manual adjustments by staff.
- `NpcService`: NPC lifecycle (create/list/retire with soft-retire).

## Useful Commands

```bash
npm run build
npm run dev
npm run start
npm run db:seed:plazas
npm run db:seed:rasgos
npm run db:seed:mercados
```

## Quick Checks

- If slash commands do not update: rerun `src/deploy/deploy-commands.ts`.
- If economy or plaza data is missing: rerun relevant seed scripts.
- If rules behavior seems off: check `CHAKRA_NACIMIENTO_RULES_UPDATE.md` first.
- If high-risk commands are rejected quickly: verify cooldown windows in `src/utils/commandThrottle.ts`.

