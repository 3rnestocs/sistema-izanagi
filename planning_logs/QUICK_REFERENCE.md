# Quick Reference — IZANAGI V2

Last updated: March 9, 2026

## Canonical Docs

- `../../README.md`
- `../../ARCHITECTURE.md`
- `CHAKRA_NACIMIENTO_RULES_UPDATE.md`

## Project Layout (Operational)

```text
src/
  commands/      Slash commands (player + staff)
  services/      Business rules and transactional logic
  lib/           Prisma client and command loader
  utils/         Error handling and channel guards
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
- `/registrar_actividad`
- `/comprar`
- `/vender`
- `/tienda`
- `/transferir`
- `/cobrar_sueldo`
- `/validar_ascenso`

Staff/Admin commands:
- `/ascender`
- `/aprobar_registro`
- `/rechazar_registro`
- `/otorgar_rasgo`
- `/otorgar_habilidad`
- `/retirar_habilidad`
- `/listar_tienda`
- `/catalogo`
- `/listar`
- `/npc` (crear/listar/retirar)

## Service Map

- `CharacterService`: Character creation and trait management.
- `PlazaService`: Plaza assignment/removal and inheritance handling.
- `PromotionService`: Rank/level validation and promotions.
- `SalaryService`: Weekly salary, cooldown, and modifiers.
- `TransactionService`: Buy/sell/transfer economy operations.
- `RewardCalculatorService`: Activity reward calculations with multipliers.
- `StatValidatorService`: SP investment and stat caps/rules.
- `SkillRankValidator`: Skill rank progression constraints.
- `BuildApprovalService`: Approval flow support.
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

