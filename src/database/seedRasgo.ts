
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import 'dotenv/config';

// 1. Configuramos el Pool de conexiones de Postgres
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 2. Creamos el adaptador oficial
const adapter = new PrismaPg(pool);

// 3. Inicializamos el cliente con el adaptador (El estilo Prisma 7)
const prisma = new PrismaClient({ adapter } as any);

const datosExcel = `
Rasgo	Categoría	Coste RC	Afecta	Operación	Valor	Afecta_2	Operación_2	Valor_2	Incompatible con	Descripción	Sueldo Ryou	Sueldo EXP	Multiplicador de sueldo	Saldo Minimo	¿Bloquea dar dinero?
Noble	Origen	-2	Ryou	+	10000	EXP	+	10	-	+10k Ryou y 10 EXP al inicio. Sueldo semanal.	10000				
Rico	Origen	-1	Ryou	+	5000	EXP	+	5	-	+5k Ryou y 5 EXP al inicio. Sueldo semanal.	2000				
Acomodado	Origen	0	Ryou	+	2000	EXP	+	2	-	+2k Ryou y 2 EXP al inicio. Sueldo semanal.					
Pobre	Origen	2	Ryou	Tope	0	EXP	Tope	0	-	Inicia con 0 Ryou y 0 EXP.					
Fortachón	Nacimiento	-1	Fuerza	+	1	-	-	-	Manco	+1 SP Fuerza					
Curtido	Nacimiento	-1	Resistencia	+	1	-	-	-	Enfermo Terminal	+1 SP Resistencia					
Veloz	Nacimiento	-1	Velocidad	+	1	-	-	-	Lento	+1 SP Velocidad					
Ágil	Nacimiento	-1	Percepción	+	1	-	-	-	-	+1 SP Percepción					
Sabio	Nacimiento	-1	Chakra	+	2	-	-	-	-	+2 puntos planos en Chakra					
Genio	Nacimiento	-1	Inteligencia	+	1	-	-	-	Mediocridad	+1 SP Inteligencia					
Preciso	Nacimiento	-1	Armas	+	1	-	-	-	Torpeza	+1 SP Armas					
Equilibrado	Nacimiento	2	-	-	-	-	-	-	-	Sin bonos de stats					
Endeble	Nacimiento	4	Resistencia	-	1	-	-	-	-	-1 SP en Resistencia					
Legendario	Nacimiento	-2	-	-	-	-	-	-	-	Segundo epíteto narrativo.					
Puntería	Físico	-2	-	-	-	-	-	-	Ciego, Torpeza	+2 Cuadros alcance.					
Intimidante	Físico	-3	-	-	-	-	-	-	Indiscreto, Bromista	Inmune Reto Furtivo. Bloqueo Iniciativa.					
Cabezota	Físico	-2	-	-	-	-	-	-	Solitario, Nómada	Divide daño (Aguante).					
Enfermo Terminal	Físico	4	-	-	-	-	-	-	Curtido	Muerte en 50 días (Timer Vida).					
Especialista	Físico	3	-	-	-	-	-	-	Experto	Solo 1 Habilidad Inicial.					
Despistado	Físico	2	-	-	-	-	-	-	Perspicaz	No detecta Genjutsu. Bloqueo Defensa (Int).					
Lento	Físico	2	Velocidad	Tope	3	-	-	-	Veloz	Max 3 Velocidad.					
Ciego	Físico	2	-	-	-	-	-	-	Puntería	Visión nula.					
Manco	Físico	2	-	-	-	-	-	-	Fortachón	Sin sellos manuales. Bloqueo Sellos.					
Torpeza	Físico	2	Armas	Tope	1	-	-	-	Puntería, Preciso	Max 1/12 Armas.					
Protector	Psicológico	-2	-	-	-	-	-	-	Solitario	+2 al proteger (Defensa Aliado).					
Cazador	Psicológico	-1	-	-	-	-	-	-	Escurridizo	Comando Retención ilimitado.					
Bromista	Psicológico	-1	-	-	-	-	-	-	Intimidante	TS extra al fallar TO. Turno Extra.					
Aventurero	Psicológico	-1	-	-	-	-	-	-	-	Acceso a toda narración (Misiones/Eventos).					
Experto	Psicológico	-4	-	-	-	-	-	-	Tonto, Engreído	+2 a tirada una vez/ronda.					
Engreído	Psicológico	-2	-	-	-	-	-	-	Experto, Mediocridad	+2 a tirada dos veces/escena.					
Manipulador	Psicológico	-3	-	-	-	-	-	-	-	Anula TO rival (Habilita Manipulación).					
Jugador Sucio	Psicológico	-3	-	-	-	-	-	-	Legales	Roba TS rival (Habilita Juego Sucio).					
Astuto	Psicológico	-2	Cupos	+	2	-	-	-	Indiscreto	Buff por estrategia (+1 Narrativa).					
Ambicioso	Psicológico	-2	Ryou (Ganancia)	*	1,5	-	-	-	Conformista	x1.5 Ingresos Ryou.			1,5		
Perspicaz	Psicológico	-2	-	-	-	-	-	-	Despistado	Repetir tirada fallida (Habilita Ups).					
Escurridizo	Psicológico	-1	-	-	-	-	-	-	Orgulloso	+2 Huida / -3 Rival.					
Solitario	Psicológico	-2	-	-	-	-	-	-	Vínculos	Turno extra vs Grupos.					
Voluntad de Fuego	Psicológico	-1	-	-	-	-	-	-	-	Inmune interrogatorio/tortura.					
Voluntad de Roca	Psicológico	-2	-	-	-	-	-	-	-	Acción extra al caer KO (Último Aliento).					
Cruel	Psicológico	-2	-	-	-	-	-	-	Compasivo	+3 turnos duración estado.					
Impulsivo	Psicológico	-1	-	-	-	-	-	-	Soberbio	Gana empate de VEL (Iniciativa).					
Rencoroso	Psicológico	-1	-	-	-	-	-	-	Derrotista	x2 Recompensa (Multiplica) vs Rival.					
Precavido	Psicológico	-2	-	-	-	-	-	-	Indiscreto	+Dif 4 para ser detectado (Ocultación).					
Soberbio	Psicológico	1	-	-	-	-	-	-	Impulsivo	Pierde empate de VEL (Iniciativa).					
Pervertido	Psicológico	2	-	-	-	-	-	-	-	Debuff vs Sexo Opuesto (Resta Nivel).					
Tímido	Psicológico	1	-	-	-	-	-	-	Carismático	No interactúa con NPC. Bloqueo Narrativa.					
Honorable	Psicológico	2	-	-	-	-	-	-	Malos	No inicia Reto Furtivo. Bloqueo Combate.					
Limitado	Psicológico	3	-	-	-	-	-	-	-	Max 12 Técnicas Total.					
Arrogante	Psicológico	2	-	-	-	-	-	-	Lealtad	No llama aliados.					
Orgulloso	Psicológico	2	-	-	-	-	-	-	Escurridizo	No puede huir.					
Ansioso	Psicológico	2	-	-	-	-	-	-	-	Sin 1er Suplementario.					
Tacaño	Psicológico	2	Ryou	Tope	15000	-	-	-	Derrochador	Min 15k Ryou en ficha (Mínimo).				15000	SI
Zoofobia	Psicológico	1	-	-	-	-	-	-	-	Sin invoc. animales.					
Perezoso	Psicológico	2	-	-	-	-	-	-		+3 días para ascender.					
Tonto	Psicológico	4	EXP (Gasto)	*	2	-	-	-	Experto	Doble coste técnicas (x2 Coste EXP).					
Derrotista	Psicológico	2	-	-	-	-	-	-	Rencoroso	Cooldown 7 días vs Rival. Bloqueo Combate.					
Conformista	Psicológico	3	-	-	-	-	-	-	Ambicioso	Max 2 Deseos.					
Regateador	Social	-2	Ryou (Gasto)	*	0,5	-	-	-	Derrochador	50% Dto Tienda General.					
Cínico	Social	-2	PR (Gasto)	*	0,9	-	-	-	Carismático	10% Dto Tienda PR.					
Leyenda	Social	-2	PR (Ganancia)	*	1,25	-	-	-	Presionado	x1.25 Ganancia PR.					
Presteza	Social	-2	EXP (Ganancia)	*	1,5	-	-	-	Mediocridad	x1.5 Ganancia EXP					
Carismático	Social	-1	-	-	-	-	-	-	Discriminado	Ascenso solo por PR. Exime Examen.					
Amor Platónico	Social	-1	-	-	-	-	-	-	Solitario	Intervenir x Amor (Habilita Turno).					
Vínculo Hermandad	Social	-1	-	-	-	-	-	-	Solitario	Cambiar turno hermano (Habilita Turno).					
Eternos Rivales	Social	0	-	-	-	-	-	-	Tímido	x2 Recompensa vs Rival.					
Discriminado	Social	2	-	-	-	-	-	-	Carismático	Doble req. ascenso.					
Presionado	Social	2	PR (Ganancia)	*	0,75	-	-	-	Leyenda	x0.75 Ganancia PR.					
Indiscreto	Social	2	-	-	-	-	-	-	Precavido	-Dif detectar (-1 Ocultación).					
Lealtad	Social	1	-	-	-	-	-	-	Sucio	No abandona aldea. Bloqueo Narrativa.					
Arrepentimiento	Social	3	EXP (Ganancia)	*	0,5	-	-	-	Presteza	50% Ganancia EXP.					
Deshonor	Social	4	-	-	-	-	-	-	-	Harakiri al fallar S. Bloqueo Misión.					
Sin Clan	Social	-2	Cupos	+	2	-	-	-	Clanes	+2 Hab. Principal (Asumiendo que Cupos refiere a Hab).					
Derrochador	Social	2	Ryou (Gasto)	*	2	-	-	-	Regateador	Compras doble precio.			0,5		
Derrochador (Lunes)	Social	0	-	-	-	-	-	-	-	Pierde 50% lunes.					
Compasivo	Social	2	-	-	-	-	-	-	Cruel	No remata enemigos. Bloqueo Daño.					
Nómada	Social	1	-	-	-	-	-	-	Vínculos	Abandona facción TS. Obligación Narrativa.					
Bueno-Legal	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en acción limpia.					
Bueno-Neutral	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en defensa estricta.					
Bueno-Caótico	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en ofensiva KO.					
Neutral-Legal	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en ofensiva controlada.					
Neutral Puro	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en reacción defendiendo a UNO.					
Neutral-Caótico	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en reacción protegiéndote SOLO a ti.					
Malo-Legal	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en ofensiva con Estado.					
Malo-Neutral	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en tirada letal vs 1.					
Malo-Caótico	Moral	0	-	-	-	-	-	-	Otras Morales	+2 en tirada letal vs 2+.					
`;

async function main() {
    console.log("🚀 [PRISMA 7] Iniciando inyección con Driver Adapter...");
    
    if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL en .env");

    const filas = datosExcel.trim().split('\n');
    const pendingConflicts: Array<{ traitName: string; conflictName: string }> = [];
    let inyectados = 0;

    for (const fila of filas) {
        const columnas = fila.trim().split('\t');
        const nombre = columnas[0]?.trim();
        if (!nombre || nombre === 'Rasgo') continue;

        // ... (Tu lógica de mapeo de columnas se mantiene igual)
        const categoria = columnas[1]?.trim() || "Desconocido";
        const costRC = parseInt(columnas[2] || "0") || 0;
        let incompatibilidad: string | null = columnas[9]?.trim() || null;
        if (incompatibilidad === '-') incompatibilidad = null; 
        const descripcion = columnas[10]?.trim() || "";
        const sueldoRyou = parseInt(columnas[11] || "0") || 0;
        const sueldoEXP = parseInt(columnas[12] || "0") || 0;
        const rawMult = columnas[13]?.replace(',', '.');
        const multiplicadorLunes = parseFloat(rawMult || "1.0") || 1.0;
        const saldoMinimo = parseInt(columnas[14] || "0") || 0;
        const bloqueaDinero = columnas[15]?.trim().toUpperCase() === 'SI';

        const afecta = columnas[3]?.trim() || '';
        const operacion = columnas[4]?.trim() || '';
        const valorRaw = columnas[5]?.trim().replace(',', '.') || '0';
        const valor = parseFloat(valorRaw) || 0;
        const afecta2 = columnas[6]?.trim() || '';
        const operacion2 = columnas[7]?.trim() || '';
        const valorRaw2 = columnas[8]?.trim().replace(',', '.') || '0';
        const valor2 = parseFloat(valorRaw2) || 0;

        let multiplierGasto = 1;
        const multiplierGanancia = 1;
        let initialBonusRyou = 0;

        const lowerAfecta = afecta.toLowerCase();
        const lowerAfecta2 = afecta2.toLowerCase();

        if (lowerAfecta.includes('gasto') && operacion === '*' && valor > 0) {
            multiplierGasto = valor;
        }
        if (lowerAfecta2.includes('gasto') && operacion2 === '*' && valor2 > 0) {
            multiplierGasto = valor2;
        }

        if (lowerAfecta === 'ryou' && operacion === '+' && valor > 0) {
            initialBonusRyou += Math.floor(valor);
        }
        if (lowerAfecta2 === 'ryou' && operacion2 === '+' && valor2 > 0) {
            initialBonusRyou += Math.floor(valor2);
        }

        let mondayTotalMultiplier = 1;
        const nombreLower = nombre.toLowerCase();
        if (nombreLower.includes('ambicioso')) {
            mondayTotalMultiplier *= multiplicadorLunes > 0 ? multiplicadorLunes : 1.5;
        }
        if (nombreLower.includes('derrochador')) {
            mondayTotalMultiplier *= 0.5;
        }

        let multiplierGanancia = 1.0;
        let expMultiplier = 1.0;
        let prMultiplier = 1.0;

        // Map EXP multipliers
        if (nombreLower.includes('presteza')) {
            expMultiplier = 1.5;
        }
        if (nombreLower.includes('arrepentimiento')) {
            expMultiplier = 0.5;
        }

        // Map PR multipliers
        if (nombreLower.includes('leyenda')) {
            prMultiplier = 1.25;
        }
        if (nombreLower.includes('presionado')) {
            prMultiplier = 0.75;
        }

        // Map Ryou multipliers (Ambicioso already handled above in mondayTotalMultiplier)
        if (nombreLower.includes('ambicioso')) {
            multiplierGanancia = 1.5;
        }

        const mechanicsData: Record<string, unknown> = {};
        if (descripcion.length > 0) {
            mechanicsData.description = descripcion;
        }
        if (sueldoEXP !== 0) {
            mechanicsData.bonusExp = sueldoEXP;
        }
        if (sueldoRyou > 0) {
            mechanicsData.weeklyRyouBonus = sueldoRyou;
        }
        if (mondayTotalMultiplier !== 1) {
            mechanicsData.mondayTotalMultiplier = mondayTotalMultiplier;
        }
        if (expMultiplier !== 1.0) {
            mechanicsData.expMultiplier = expMultiplier;
        }
        if (prMultiplier !== 1.0) {
            mechanicsData.prMultiplier = prMultiplier;
        }

        // Store stat blocks and golden points in mechanics
        const blockedStats: string[] = [];
        if (nombreLower.includes('lento')) blockedStats.push('Velocidad');
        if (nombreLower.includes('torpeza')) blockedStats.push('Armas');
        if (blockedStats.length > 0) {
            mechanicsData.blockedStats = blockedStats;
        }

        // Golden Point grants
        if (nombreLower.includes('astuto')) {
            mechanicsData.grantedGP = true;
        }

        const mechanics: Prisma.InputJsonValue | null = Object.keys(mechanicsData).length > 0
            ? (mechanicsData as Prisma.InputJsonObject)
            : null;

        const baseTraitData = {
            category: categoria,
            costRC,
            bonusRyou: initialBonusRyou,
            multiplierGasto,
            multiplierGanancia,
            minBalanceRule: saldoMinimo,
            blocksTransfer: bloqueaDinero
        };

        await prisma.trait.upsert({
            where: { name: nombre },
            update: {
                ...baseTraitData,
                ...(mechanics ? { mechanics } : {})
            },
            create: {
                name: nombre,
                ...baseTraitData,
                ...(mechanics ? { mechanics } : {})
            }
        });

        if (incompatibilidad) {
            const incompatibles = incompatibilidad
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0 && item !== '-');

            for (const conflictName of incompatibles) {
                pendingConflicts.push({ traitName: nombre, conflictName });
            }
        }
        
        console.log(`✅ ${nombre} sincronizado.`);
        inyectados++;
    }

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
    }

    console.log(`\n🎉 SEED COMPLETADO: ${inyectados} rasgos en Supabase.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(async () => { 
        await prisma.$disconnect();
        await pool.end(); // 👈 Cerramos el pool de PG también
    });