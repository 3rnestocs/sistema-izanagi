import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

interface SeedPlazaRecord {
  name: string;
  traitGrants?: string[];
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

const plazasJsonPath = path.join(__dirname, '../../prisma/seed-data/plazas.json');
const plazasData = JSON.parse(fs.readFileSync(plazasJsonPath, 'utf-8')) as SeedPlazaRecord[];

async function main() {
  console.log('🔎 Auditando consistencia de herencias Plaza -> Rasgo (seed vs DB)...');

  const expectedPairs: Array<{ plazaName: string; traitName: string }> = [];
  for (const plaza of plazasData) {
    for (const traitName of plaza.traitGrants ?? []) {
      expectedPairs.push({ plazaName: plaza.name, traitName });
    }
  }

  const dbPlazas = await prisma.plaza.findMany({ select: { id: true, name: true } });
  const dbTraits = await prisma.trait.findMany({ select: { id: true, name: true, category: true } });
  const dbInheritances = await prisma.plazaTraitInheritance.findMany({
    include: {
      plaza: { select: { name: true } },
      trait: { select: { name: true, category: true } }
    }
  });

  const plazaByName = new Map(dbPlazas.map((plaza) => [plaza.name, plaza]));
  const traitByName = new Map(dbTraits.map((trait) => [trait.name, trait]));
  const dbPairSet = new Set(dbInheritances.map((rel) => `${rel.plaza.name}:::${rel.trait.name}`));

  const missingPlazas = new Set<string>();
  const missingTraits = new Set<string>();
  const missingRelations: string[] = [];

  for (const pair of expectedPairs) {
    if (!plazaByName.has(pair.plazaName)) {
      missingPlazas.add(pair.plazaName);
      continue;
    }

    if (!traitByName.has(pair.traitName)) {
      missingTraits.add(pair.traitName);
      continue;
    }

    const key = `${pair.plazaName}:::${pair.traitName}`;
    if (!dbPairSet.has(key)) {
      missingRelations.push(`${pair.plazaName} -> ${pair.traitName}`);
    }
  }

  if (missingPlazas.size > 0) {
    console.error('❌ Plazas referenciadas en seed que no existen en DB:');
    for (const plazaName of Array.from(missingPlazas).sort((a, b) => a.localeCompare(b, 'es'))) {
      console.error(` - ${plazaName}`);
    }
  }

  if (missingTraits.size > 0) {
    console.error('❌ Rasgos referenciados en seed que no existen en DB:');
    for (const traitName of Array.from(missingTraits).sort((a, b) => a.localeCompare(b, 'es'))) {
      console.error(` - ${traitName}`);
    }
  }

  if (missingRelations.length > 0) {
    console.error('❌ Relaciones PlazaTraitInheritance faltantes en DB:');
    for (const relation of missingRelations.sort((a, b) => a.localeCompare(b, 'es'))) {
      console.error(` - ${relation}`);
    }
  }

  if (missingPlazas.size > 0 || missingTraits.size > 0 || missingRelations.length > 0) {
    console.error('\nAccion sugerida: ejecutar `npm run db:seed:rasgos` y `npm run db:seed:plazas`, luego repetir la auditoria.');
    process.exitCode = 1;
    return;
  }

  console.log(`✅ OK. ${expectedPairs.length} relaciones Plaza -> Rasgo consistentes entre seed y DB.`);
}

main()
  .catch((error) => {
    console.error('❌ Error durante la auditoria:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
