# Quick Reference — Phase 1 & 2 Changes

**Last Updated:** March 9, 2026

---

## File Location Map

### New Files (Phase 2)
```
src/lib/prisma.ts                 ← Database connection & graceful shutdown
src/lib/commandLoader.ts          ← Auto-discover & load commands
src/utils/errorHandler.ts         ← Centralized error handling
src/services/PromotionService.ts  ← Rank/level promotions
src/services/SalaryService.ts     ← Weekly salary calculations
```

### Modified Core Files (Phase 1 & 2)
```
src/index.ts                      ← Entry point (imports, graceful shutdown)
src/services/PlazaService.ts      ← Plaza assignment + cycle guard
src/services/CharacterService.ts  ← Trait bonus application
src/database/seedPlazas.ts        ← Plaza inheritance seeding
src/database/seedRasgo.ts         ← Trait multiplier mapping
prisma/schema.prisma              ← Removed relationMode
src/deploy/deploy-commands.ts     ← Dynamic command registration
```

### Modified Command Files (Import path)
- All 10 commands in `src/commands/*.ts`
- Changed: `import { prisma } from '../index'` → `import { prisma } from '../lib/prisma'`

---

## Key Code Patterns

### Use SalaryService (Phase 3.1 `/cobrar_sueldo`)
```typescript
import { SalaryService } from '../services/SalaryService';

const salaryService = new SalaryService(prisma);

// Claim salary
const result = await salaryService.claimWeeklySalary(characterId);

// Preview salary
const info = await salaryService.getSalaryInfo(characterId);
```

### Use PromotionService (Existing commands updated)
```typescript
import { PromotionService } from '../services/PromotionService';

const promotionService = new PromotionService(prisma);

// Check requirements
const check = await promotionService.checkRankRequirements(characterId, 'Chuunin');

// Apply promotion
await promotionService.applyPromotion(characterId, 'rank', 'Chuunin');
```

### Use Error Handler (Phase 3 features)
```typescript
import { executeWithErrorHandler } from '../utils/errorHandler';

export async function execute(interaction: ChatInputCommandInteraction) {
  await executeWithErrorHandler(
    interaction,
    async (i) => {
      // Your command logic here
    },
    'command_name'
  );
}
```

### Graceful Shutdown
Already handled in `src/index.ts`:
- SIGINT (Ctrl+C) → closes Prisma + Discord client
- SIGTERM → closes Prisma + Discord client
- No explicit calls needed

---

## Testing Seed Data

```bash
# Test plaza inheritance seeding
npm run db:seed:plazas

# Test trait multiplier mapping
npm run db:seed:rasgos

# Test market items (unchanged)
npm run db:seed:mercados
```

## Verify in Database

```sql
-- Check plaza inheritance created
SELECT COUNT(*) FROM "PlazaPlazaInheritance";

-- Check trait inheritance created
SELECT COUNT(*) FROM "PlazaTraitInheritance";

-- Verify Ambicioso multiplier
SELECT name, "multiplierGanancia" FROM "Trait" WHERE name = 'Ambicioso';
-- Should be: Ambicioso | 1.5

-- Check trait mechanics (e.g., Presteza EXP multiplier)
SELECT name, mechanics FROM "Trait" WHERE name = 'Presteza';
-- Should contain: {"expMultiplier": 1.5, ...}
```

---

## Migration Notes

### Database Change
Remove `relationMode = "prisma"` from schema → must run:
```bash
npx prisma db push
```

This creates real PostgreSQL FK constraints.

### No Breaking Changes
- All commands still work
- All existing APIs unchanged
- Only additions and refactoring

### Backward Compatibility
- `LevelUpService` still exists (not removed)
- Old `prisma` export removed (but all commands updated)
- All services have same constructor: `new Service(prisma)`

---

## Files By Phase Dependency

**Must run Phase 1 first:**
- seedPlazas.ts (inheritance seeding)
- seedRasgo.ts (multiplier mapping)
- CharacterService (trait bonuses)
- PlazaService (cycle guard)

**Must run Phase 2 after Phase 1:**
- All Phase 2 changes work independently
- BUT Phase 3 needs Phase 2 architecture

**Can do these in parallel:**
- Phase 1.1 (maxHolders) ✓
- Phase 1.3 (relationMode) ✓
- (Both safe and don't conflict)

**Must do these sequentially:**
- Phase 1.2 (inheritance) → needs Phase 1.1 seed data
- Phase 2.1 (extract prisma) → before Phase 2.2 (dynamic commands)
- Phase 2.5 (split services) → after Phase 2.1 (prisma extracted)

---

## Common Issues & Fixes

**Issue: "Command not found" on startup**
- Check: `src/commands/` directory exists
- Check: Command files export `data` and `execute`
- Check: Console shows "Loaded X commands"

**Issue: "Cannot find module ../lib/prisma"**
- Verify: `src/lib/prisma.ts` exists
- Check: All command imports updated
- Run: `npm run build` to verify TS compilation

**Issue: "Pool is not connected"**
- Verify: `DATABASE_URL` set in `.env`
- Check: Postgres database running
- Test: `psql $DATABASE_URL -c "SELECT 1"`

**Issue: Inheritance relationships not created**
- Verify: `npm run db:seed:plazas` completed
- Check: Database has entries in `PlazaPlazaInheritance`
- Re-seed: `npm run db:seed:plazas` (idempotent)

---

## Phase 3 Checklist (Next Steps)

- [ ] Plan Phase 3 commands (7 features)
- [ ] Create `/cobrar_sueldo` command (uses SalaryService)
- [ ] Create `/vender` command (needs TransactionService.sellItems())
- [ ] Create `/tienda` command (player-facing shop)
- [ ] Create `/ficha` command (profile viewer)
- [ ] Create `/otorgar_rasgo` command (trait add/remove)
- [ ] Create `/retirar_habilidad` command (plaza removal)
- [ ] Create `/rechazar_registro` command (activity rejection)
- [ ] Update RewardCalculatorService (trait multipliers)

---

## Reference Documents

- [INDEX.md](INDEX.md) — Overview of all phases
- [PHASE_1_COMPLETION.md](PHASE_1_COMPLETION.md) — Detailed Phase 1 changes
- [PHASE_2_COMPLETION.md](PHASE_2_COMPLETION.md) — Detailed Phase 2 changes
- [../../ARCHITECTURE.md](../../ARCHITECTURE.md) — Original architecture analysis
- [../../.cursor/plans/izanagi_v2_full_migration_5b09c734.plan.md](../../.cursor/plans/izanagi_v2_full_migration_5b09c734.plan.md) — Full migration plan

