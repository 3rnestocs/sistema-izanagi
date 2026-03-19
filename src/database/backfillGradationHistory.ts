/**
 * Backfill GradationHistory from existing AuditLog entries (category: 'Ascenso').
 * Parses level promotions from:
 * - PromotionService: "Ascenso de nivel: C1"
 * - LevelUpService: "Nivel: D1 -> D2" or "Objetivo: D2" (when internal level)
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import { AUDIT_LOG_CATEGORY } from '../config/auditLogCategories';
import { PromotionService } from '../services/PromotionService';

const VALID_LEVELS = new Set(PromotionService.LEVEL_ORDER.slice(1));

function isInternalLevel(level: string): boolean {
  const normalized = level.trim().toUpperCase();
  return /^[DCBAS][123]$/.test(normalized) || normalized === 'S2';
}

function parseLevelFromAuditDetail(detail: string): string | null {
  // Format 1: "Ascenso de nivel: C1"
  const nivelMatch = detail.match(/Ascenso de nivel:\s*([A-Za-z0-9]+)/i);
  if (nivelMatch?.[1]) {
    const level = nivelMatch[1].toUpperCase().replace(/[^DCBAS0-9]/g, '');
    if (VALID_LEVELS.has(level)) return level;
    return null;
  }

  // Format 2: "Nivel: D1 -> D2" or "Nivel: D1 → D2"
  const arrowMatch = detail.match(/Nivel:\s*[DCBAS]?\d?\s*[->→]\s*([DCBAS][123]|S2)/i);
  if (arrowMatch?.[1]) {
    const level = arrowMatch[1].toUpperCase();
    if (VALID_LEVELS.has(level)) return level;
    return null;
  }

  // Format 2b: "Objetivo: D2" when it's an internal level
  const objetivoMatch = detail.match(/Objetivo:\s*([DCBAS][123]|S2)/i);
  if (objetivoMatch?.[1]) {
    const level = objetivoMatch[1].toUpperCase();
    if (isInternalLevel(level) && VALID_LEVELS.has(level)) return level;
  }

  return null;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter } as never);

  console.log('📦 Backfilling GradationHistory from AuditLog entries...');

  const logs = await prisma.auditLog.findMany({
    where: {
      category: AUDIT_LOG_CATEGORY.ASCENSO,
      characterId: { not: null }
    },
    select: { id: true, characterId: true, detail: true, createdAt: true },
    orderBy: [{ characterId: 'asc' }, { createdAt: 'asc' }]
  });

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const log of logs) {
    const characterId = log.characterId!;
    const level = parseLevelFromAuditDetail(log.detail);
    if (!level) {
      skipped++;
      continue;
    }

    try {
      await prisma.gradationHistory.upsert({
        where: { characterId_level: { characterId, level } },
        create: {
          characterId,
          level,
          achievedAt: log.createdAt
        },
        update: {
          achievedAt: log.createdAt
        }
      });
      inserted++;
      console.log(`  ✓ ${characterId.slice(0, 8)}... → ${level} @ ${log.createdAt.toISOString().slice(0, 10)}`);
    } catch (e) {
      errors++;
      console.error(`  ✗ ${characterId} / ${level}:`, e);
    }
  }

  console.log(`\n✅ Backfill complete: ${inserted} inserted/updated, ${skipped} skipped (rank-only), ${errors} errors.`);
}

main()
  .catch((err) => {
    console.error('❌ Backfill failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.end();
  });
