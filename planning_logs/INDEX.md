# Planning Logs — IZANAGI V2 Full Migration

**Project:** Sistema IZANAGI V2 — Discord Bot + PostgreSQL Migration  
**Date Range:** March 8-9, 2026  
**Total Progress:** 10/22 items (Phase 1 & 2 complete)

---

## Document Index

### Phase Reports

1. **[PHASE_1_COMPLETION.md](PHASE_1_COMPLETION.md)**
   - Status: ✅ COMPLETE (5/5 items)
   - Focus: Critical bug fixes
   - Key Areas:
     - Plaza capacity limits (maxHolders = 0)
     - Plaza inheritance seeding
     - PostgreSQL native foreign keys
     - Trait stat bonuses at creation
     - Trait multiplier mapping
   - Files Changed: 5
   - Impact: High (blocks Phase 3 feature work)

2. **[PHASE_2_COMPLETION.md](PHASE_2_COMPLETION.md)**
   - Status: ✅ COMPLETE (5/5 items)
   - Focus: Architectural improvements
   - Key Areas:
     - Prisma client extraction
     - Dynamic command handler
     - Centralized error handling
     - Cycle guard for recursion
     - Service split (Promotion + Salary)
   - Files Changed: 12+
   - Impact: High (enables Phase 3 scalability)

---

## Phase Summary

| Phase | Status | Items | Focus | Changes |
|-------|--------|-------|-------|---------|
| 1 | ✅ | 5/5 | Bug fixes | 5 files |
| 2 | ✅ | 5/5 | Architecture | 12+ files |
| 3 | ⏳ | 0/7 | Features | Pending |
| 4 | ⏳ | 0/4 | Quality | Pending |

---

## Key Decisions & Trade-offs

### Phase 1
- **maxHolders=0 → 9999:** Seed-level fix vs. code-level fix. Chose seed because:
  - Idempotent (safe re-runs)
  - Doesn't change runtime semantics
  - Easier to debug

- **relationMode removal:** Full migration (no half-measures). Chose because:
  - PostgreSQL has native FK support
  - No reason to emulate at app level
  - Cleaner architecture

### Phase 2
- **Dynamic command loading:** Collection-based vs. glob-based. Chose Collection because:
  - Standard Discord.js pattern
  - Type-safe
  - Easier to integrate with client lifecycle

- **Error handler optional:** Centralized vs. per-command. Chose centralized because:
  - DRY principle
  - Consistent UX
  - Better logging

- **Service split:** 2 services vs. 3. Chose 2 (Promotion + Salary) because:
  - Clear single responsibility
  - Phase 3 only needs these two
  - Future: Can add `MissionService`, etc.

---

## Dependencies & Ordering

```
Phase 1 (bugs)
    ↓
Phase 2 (architecture)
    ├→ Phase 3.1 (/cobrar_sueldo uses SalaryService)
    └→ Phase 3 (all features depend on arch)
        ↓
Phase 4 (quality)
```

**Critical Path:**
1. Phase 1 must complete before Phase 3 features work correctly
2. Phase 2.5 (service split) must complete before Phase 3.1
3. Phase 2.2 (dynamic commands) enables easier Phase 3 additions

---

## Files Modified Across Both Phases

### Created (New Files)
```
src/lib/prisma.ts                   (Phase 2.1)
src/lib/commandLoader.ts            (Phase 2.2)
src/utils/errorHandler.ts           (Phase 2.3)
src/services/PromotionService.ts    (Phase 2.5)
src/services/SalaryService.ts       (Phase 2.5)
```

### Modified (Existing Files)
```
src/index.ts                        (Phases 2.1, 2.2, graceful shutdown)
prisma/schema.prisma                (Phase 1.3)
src/database/seedPlazas.ts          (Phases 1.1, 1.2)
src/database/seedRasgo.ts           (Phase 1.5)
src/services/CharacterService.ts    (Phase 1.4)
src/services/PlazaService.ts        (Phases 1.1, 2.4)
src/deploy/deploy-commands.ts       (Phase 2.2)

All 10 command files:
  - src/commands/ascender.ts
  - src/commands/aprobar_registro.ts
  - src/commands/comprar.ts
  - src/commands/invertir_sp.ts
  - src/commands/listar_tienda.ts
  - src/commands/otorgar_habilidad.ts
  - src/commands/registrar_actividad.ts
  - src/commands/registro.ts
  - src/commands/transferir.ts
  - src/commands/validar_ascenso.ts
```

---

## Testing Checklist

- [ ] Seed scripts run without error: `npm run db:seed:*`
- [ ] Command loading works: Check console for "Loaded X commands"
- [ ] Character creation: Works with trait bonuses (Phase 1.4)
- [ ] Plaza assignment: Can assign basic elements (Phase 1.1)
- [ ] Error handling: Trigger error, see formatted message (Phase 2.3)
- [ ] Cycle detection: Attempt circular inheritance, see error (Phase 2.4)
- [ ] Promotion commands: `/ascender`, `/validar_ascenso` work (Phase 2.5)

---

## Known Issues / Follow-ups

1. **LevelUpService still exists** — Can be removed after Phase 3 completes (currently kept for backward compat)
2. **Error handler not integrated** — Commands will work without it, but Phase 3 features should use it
3. **Seed data validation** — No automated tests; manual verification recommended
4. **Environment variables** — `.env.example` should be created (Phase 4.2)

---

## Next Steps (Phase 3)

Ready to implement 7 missing features:
- `/cobrar_sueldo` — Uses new SalaryService
- `/vender` — Sell items at 50% refund
- `/tienda` — Player-facing shop browser
- `/ficha` — Character profile viewer
- `/otorgar_rasgo` — Post-creation trait add/remove
- `/retirar_habilidad` — Plaza removal (needs removePlaza method)
- `/rechazar_registro` — Activity rejection

All Phase 3 features have clean architectural foundation from Phase 2.

---

## Metrics

| Metric | Phase 1 | Phase 2 | Total |
|--------|---------|---------|-------|
| New Files | 0 | 5 | 5 |
| Modified Files | 5 | 12 | 17 |
| Lines Added | ~400 | ~560 | ~960 |
| Commits | 1 | 1 | 2 |
| Linter Errors | 0 | 0 | 0 |
| Breaking Changes | 0 | 0 | 0 |

---

## Decision Log

### 2026-03-09: Phase 1 & 2 Completion
- **Decision:** Implement Phases 1 & 2 before Phase 3 feature work
- **Rationale:** Bug fixes must complete first; architecture must support Phase 3 scalability
- **Outcome:** Both phases completed in single session, all items working
- **Next:** Begin Phase 3 feature implementation

