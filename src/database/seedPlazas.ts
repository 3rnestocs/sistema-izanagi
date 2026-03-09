import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

// Load plaza data from JSON file
const plazasJsonPath = path.join(__dirname, '../../prisma/seed-data/plazas.json');
const plazasData = JSON.parse(fs.readFileSync(plazasJsonPath, 'utf-8'));

async function main() {
    console.log("🚀 [PRISMA 7] Iniciando inyección masiva de Plazas desde JSON...");
    
    let inyectadas = 0;
    const pendingInheritances: Array<{ parentName: string; childNames: string[] }> = [];
    const pendingTraitInheritances: Array<{ plazaName: string; traitNames: string[] }> = [];

    for (const plaza of plazasData) {
        const plazaPayload = {
            category: plaza.category,
            costCupos: plaza.costCupos,
            maxHolders: plaza.maxHolders,
            bonusStatValue: plaza.bonusStatValue,
            ...(plaza.bonusStatName ? { bonusStatName: plaza.bonusStatName } : { bonusStatName: null })
        };

        await prisma.plaza.upsert({
            where: { name: plaza.name },
            update: plazaPayload,
            create: { name: plaza.name, ...plazaPayload }
        });
        
        console.log(`✅ Guía sincronizada: ${plaza.name} (${plaza.category}) - Costo Cupos: ${plaza.costCupos} - Plazas: ${plaza.maxHolders}`);
        inyectadas++;

        // Collect inheritance relationships for second pass
        if (plaza.extras && plaza.extras.length > 0) {
            pendingInheritances.push({ parentName: plaza.name, childNames: plaza.extras });
        }

        if (plaza.traitGrants && plaza.traitGrants.length > 0) {
            pendingTraitInheritances.push({ plazaName: plaza.name, traitNames: plaza.traitGrants });
        }
    }

    // Second pass: Create PlazaPlazaInheritance records
    console.log("\n🔗 Creating Plaza-to-Plaza inheritance relationships...");
    for (const inheritance of pendingInheritances) {
        const parentPlaza = await prisma.plaza.findUnique({
            where: { name: inheritance.parentName },
            select: { id: true }
        });

        if (!parentPlaza) {
            console.warn(`⚠️  Parent plaza '${inheritance.parentName}' not found`);
            continue;
        }

        for (const childName of inheritance.childNames) {
            const childPlaza = await prisma.plaza.findUnique({
                where: { name: childName },
                select: { id: true }
            });

            if (!childPlaza) {
                console.warn(`⚠️  Child plaza '${childName}' not found`);
                continue;
            }

            await prisma.plazaPlazaInheritance.upsert({
                where: {
                    parentId_childId: {
                        parentId: parentPlaza.id,
                        childId: childPlaza.id
                    }
                },
                update: {},
                create: {
                    parentId: parentPlaza.id,
                    childId: childPlaza.id
                }
            });

            console.log(`  ✓ ${inheritance.parentName} → ${childName}`);
        }
    }

    // Third pass: Create PlazaTraitInheritance records
    console.log("\n🧬 Creating Plaza-to-Trait inheritance relationships...");
    for (const inheritance of pendingTraitInheritances) {
        const plaza = await prisma.plaza.findUnique({
            where: { name: inheritance.plazaName },
            select: { id: true }
        });

        if (!plaza) {
            console.warn(`⚠️  Plaza '${inheritance.plazaName}' not found`);
            continue;
        }

        for (const traitName of inheritance.traitNames) {
            const trait = await prisma.trait.findUnique({
                where: { name: traitName },
                select: { id: true }
            });

            if (!trait) {
                console.warn(`⚠️  Trait '${traitName}' not found`);
                continue;
            }

            await prisma.plazaTraitInheritance.upsert({
                where: {
                    plazaId_traitId: {
                        plazaId: plaza.id,
                        traitId: trait.id
                    }
                },
                update: {},
                create: {
                    plazaId: plaza.id,
                    traitId: trait.id
                }
            });

            console.log(`  ✓ ${inheritance.plazaName} → trait ${traitName}`);
        }
    }

    console.log(`\n🎉 SEED COMPLETADO: ${inyectadas} Guías/Plazas registradas desde JSON.`);
}

main()
    .catch((e) => { console.error("❌ ERROR EN SEED:", e); process.exit(1); })
    .finally(async () => { 
        await prisma.$disconnect();
        await pool.end();
    });
