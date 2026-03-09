
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Load trait data from JSON file
const traitsJsonPath = path.join(__dirname, '../../prisma/seed-data/traits.json');
const traitsData = JSON.parse(fs.readFileSync(traitsJsonPath, 'utf-8'));

async function main() {
    console.log("🚀 [PRISMA 7] Iniciando inyección de Rasgos desde JSON...");
    
    if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env");

    const pendingConflicts: Array<{ traitName: string; conflictName: string }> = [];
    let inyectados = 0;

    for (const trait of traitsData) {
        const mechanicsData: Record<string, unknown> = {};
        
        // Add mechanics data if present
        if (trait.mechanics) {
            Object.assign(mechanicsData, trait.mechanics);
        }

        const mechanics: Prisma.InputJsonValue | null = Object.keys(mechanicsData).length > 0
            ? (mechanicsData as Prisma.InputJsonObject)
            : null;

        const baseTraitData = {
            category: trait.category,
            costRC: trait.costRC,
            bonusRyou: trait.bonusRyou,
            multiplierGasto: trait.multiplierGasto,
            multiplierGanancia: trait.multiplierGanancia,
            minBalanceRule: trait.minBalanceRule,
            blocksTransfer: trait.blocksTransfer
        };

        await prisma.trait.upsert({
            where: { name: trait.name },
            update: {
                ...baseTraitData,
                ...(mechanics ? { mechanics } : {})
            },
            create: {
                name: trait.name,
                ...baseTraitData,
                ...(mechanics ? { mechanics } : {})
            }
        });

        if (trait.incompatibilities && trait.incompatibilities.length > 0) {
            for (const conflictName of trait.incompatibilities) {
                pendingConflicts.push({ traitName: trait.name, conflictName });
            }
        }
        
        console.log(`✅ ${trait.name} sincronizado.`);
        inyectados++;
    }

    // Create conflict relationships
    console.log("\n🔗 Creating trait conflict relationships...");
    for (const pair of pendingConflicts) {
        const traitA = await prisma.trait.findUnique({ where: { name: pair.traitName }, select: { id: true } });
        const traitB = await prisma.trait.findUnique({ where: { name: pair.conflictName }, select: { id: true } });

        if (!traitA || !traitB || traitA.id === traitB.id) {
            continue;
        }

        const [traitAId, traitBId] = traitA.id < traitB.id
            ? [traitA.id, traitB.id]
            : [traitB.id, traitA.id];

        await prisma.traitConflict.upsert({
            where: { traitAId_traitBId: { traitAId, traitBId } },
            update: {},
            create: { traitAId, traitBId }
        });

        console.log(`  ✓ ${pair.traitName} ⇔ ${pair.conflictName}`);
    }

    console.log(`\n🎉 SEED COMPLETADO: ${inyectados} rasgos desde JSON.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { 
        await prisma.$disconnect();
        await pool.end();
    });
