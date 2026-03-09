import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

type MarketCurrency = 'RYOU' | 'EXP' | 'PR';

interface MarketSeedItem {
  name: string;
  type: string;
  price: number;
  currency: MarketCurrency;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as never);

const MERCADO_NINJA: ReadonlyArray<MarketSeedItem> = [
  { name: 'Kit Ninja Completo', type: 'Kit Ninja', price: 2000, currency: 'RYOU' },
  { name: 'Kunai', type: 'Kit Ninja', price: 100, currency: 'RYOU' },
  { name: 'Shuriken', type: 'Kit Ninja', price: 50, currency: 'RYOU' },
  { name: 'Senbon', type: 'Kit Ninja', price: 50, currency: 'RYOU' },
  { name: 'Kibaku Fuda (Sello)', type: 'Kit Ninja', price: 300, currency: 'RYOU' },
  { name: 'Hilos (Cable)', type: 'Kit Ninja', price: 500, currency: 'RYOU' },
  { name: 'Kemuridama (Humo)', type: 'Kit Ninja', price: 300, currency: 'RYOU' },
  { name: 'Hikaridama (Luz)', type: 'Kit Ninja', price: 300, currency: 'RYOU' },
  { name: 'Fuuma Shuriken', type: 'Kit Ninja', price: 500, currency: 'RYOU' },
  { name: 'Makibishi (Puas)', type: 'Kit Ninja', price: 100, currency: 'RYOU' },

  { name: 'Katana', type: 'Corta Distancia', price: 2000, currency: 'RYOU' },
  { name: 'Tantou', type: 'Corta Distancia', price: 2000, currency: 'RYOU' },
  { name: 'Bou', type: 'Corta Distancia', price: 1500, currency: 'RYOU' },
  { name: 'Kama', type: 'Corta Distancia', price: 1300, currency: 'RYOU' },
  { name: 'Naginata', type: 'Corta Distancia', price: 3000, currency: 'RYOU' },
  { name: 'Tonfaa', type: 'Corta Distancia', price: 1000, currency: 'RYOU' },
  { name: 'Nunchaku', type: 'Corta Distancia', price: 1300, currency: 'RYOU' },
  { name: 'Soushuuga', type: 'Corta Distancia', price: 3000, currency: 'RYOU' },
  { name: 'Cuchilla (Nudillos)', type: 'Corta Distancia', price: 1000, currency: 'RYOU' },
  { name: 'Zanbatou', type: 'Corta Distancia', price: 5000, currency: 'RYOU' },
  { name: 'Sable Kunai', type: 'Corta Distancia', price: 2000, currency: 'RYOU' },
  { name: 'Estaca retraible', type: 'Corta Distancia', price: 1200, currency: 'RYOU' },
  { name: 'Guadaña de tres hojas', type: 'Corta Distancia', price: 10000, currency: 'RYOU' },

  { name: 'Arco', type: 'Media Distancia', price: 1000, currency: 'RYOU' },
  { name: 'Ballesta', type: 'Media Distancia', price: 2500, currency: 'RYOU' },
  { name: 'Flecha', type: 'Media Distancia', price: 100, currency: 'RYOU' },
  { name: 'Kusari Fuubou', type: 'Media Distancia', price: 5000, currency: 'RYOU' },
  { name: 'Kusari', type: 'Media Distancia', price: 1500, currency: 'RYOU' },
  { name: 'Kusarigama', type: 'Media Distancia', price: 3000, currency: 'RYOU' },
  { name: 'Dakou', type: 'Media Distancia', price: 5000, currency: 'RYOU' },
  { name: 'Bomba de hielo', type: 'Media Distancia', price: 1000, currency: 'RYOU' },
  { name: 'Jidanda', type: 'Media Distancia', price: 15000, currency: 'RYOU' },
  { name: 'Jouhyou', type: 'Media Distancia', price: 1000, currency: 'RYOU' },

  { name: 'Encendedor oculto', type: 'Complementos', price: 3500, currency: 'RYOU' },
  { name: 'Ninshiki Kaado', type: 'Complementos', price: 1000, currency: 'RYOU' },
  { name: 'Pergamino regular', type: 'Complementos', price: 1000, currency: 'RYOU' },
  { name: 'Pergamino enorme', type: 'Complementos', price: 4000, currency: 'RYOU' },
  { name: 'Baston eléctrico', type: 'Complementos', price: 3000, currency: 'RYOU' },

  { name: 'Casco', type: 'Proteccion', price: 2000, currency: 'RYOU' },
  { name: 'Armadura ninja', type: 'Proteccion', price: 4000, currency: 'RYOU' },
  { name: 'Chaleco', type: 'Proteccion', price: 1500, currency: 'RYOU' },
  { name: 'Protector de antebrazo', type: 'Proteccion', price: 1000, currency: 'RYOU' },
  { name: 'Brazalete sellador', type: 'Proteccion', price: 10000, currency: 'RYOU' },

  { name: 'Disparador de Proyectiles', type: 'Mecanicos', price: 1500, currency: 'RYOU' },
  { name: 'Cañon Mecánico', type: 'Mecanicos', price: 2500, currency: 'RYOU' },
  { name: 'Bola explosiva', type: 'Mecanicos', price: 5000, currency: 'RYOU' },
  { name: 'Recubrimiento Marioneta', type: 'Mecanicos', price: 7000, currency: 'RYOU' },
  { name: 'Lanzallamas', type: 'Mecanicos', price: 4000, currency: 'RYOU' },
  { name: 'Disparador de agua', type: 'Mecanicos', price: 4000, currency: 'RYOU' },
  { name: 'Brazo taladro', type: 'Mecanicos', price: 4000, currency: 'RYOU' },
  { name: 'Brazo retraible', type: 'Mecanicos', price: 5000, currency: 'RYOU' },
  { name: 'Escudo retraible', type: 'Mecanicos', price: 6000, currency: 'RYOU' },
  { name: 'Alas metálicas', type: 'Mecanicos', price: 10000, currency: 'RYOU' },
  { name: 'Lanzador Mecánico', type: 'Mecanicos', price: 9000, currency: 'RYOU' },

  { name: 'Herrería (Subir a D)', type: 'Servicios', price: 4000, currency: 'RYOU' },
  { name: 'Herrería (Subir a C)', type: 'Servicios', price: 6000, currency: 'RYOU' },
  { name: 'Herrería (Subir a B)', type: 'Servicios', price: 15000, currency: 'RYOU' },
  { name: 'Herrería (Subir a B+)', type: 'Servicios', price: 25000, currency: 'RYOU' },
  { name: 'Herrería (Subir a A)', type: 'Servicios', price: 50000, currency: 'RYOU' },
  { name: 'Médico (Herida Leve)', type: 'Servicios', price: 1000, currency: 'RYOU' },
  { name: 'Médico (Herida Grave)', type: 'Servicios', price: 3000, currency: 'RYOU' },
  { name: 'Médico (Herida Crítica)', type: 'Servicios', price: 8000, currency: 'RYOU' },
  { name: 'Médico (Veneno A)', type: 'Servicios', price: 15000, currency: 'RYOU' },
  { name: 'Médico (Veneno S)', type: 'Servicios', price: 25000, currency: 'RYOU' },
  { name: 'Médico (Protesis)', type: 'Servicios', price: 45000, currency: 'RYOU' },
  { name: 'Sensei (Tec B -> B+)', type: 'Servicios', price: 10000, currency: 'RYOU' },
  { name: 'Sensei (Tec A -> A+)', type: 'Servicios', price: 60000, currency: 'RYOU' },
  { name: 'Escolta (Mercenario)', type: 'Servicios', price: 30000, currency: 'RYOU' },

  { name: 'Lab Basico (C)', type: 'Laboratorios', price: 8000, currency: 'RYOU' },
  { name: 'Lab Intermedio (B)', type: 'Laboratorios', price: 15000, currency: 'RYOU' },
  { name: 'Lab Avanzado (A)', type: 'Laboratorios', price: 25000, currency: 'RYOU' },
  { name: 'Lab Elite (S)', type: 'Laboratorios', price: 60000, currency: 'RYOU' },
  { name: 'Lab Supremo (S+)', type: 'Laboratorios', price: 80000, currency: 'RYOU' }
];

const TIENDA_PR: ReadonlyArray<MarketSeedItem> = [
  { name: 'Ventaja: Área Aumentada', type: 'Tienda PR', price: 1000, currency: 'PR' },
  { name: 'Ventaja: Bono +3', type: 'Tienda PR', price: 1000, currency: 'PR' },
  { name: 'Ventaja: Salto de Nivel Técnica', type: 'Tienda PR', price: 1200, currency: 'PR' },
  { name: 'Ventaja: Mantenida Normal', type: 'Tienda PR', price: 1600, currency: 'PR' },
  { name: 'Ventaja: Stat Max', type: 'Tienda PR', price: 1700, currency: 'PR' },
  { name: 'Ventaja: Techo Buffos', type: 'Tienda PR', price: 1800, currency: 'PR' },
  { name: 'Ventaja: Potencia +5', type: 'Tienda PR', price: 1800, currency: 'PR' },
  { name: 'Ventaja: Técnica Característica', type: 'Tienda PR', price: 2000, currency: 'PR' },
  { name: 'Ventaja: Segundo Pacto', type: 'Tienda PR', price: 2000, currency: 'PR' },
  { name: 'Ventaja: Sin Carga S', type: 'Tienda PR', price: 2200, currency: 'PR' },
  { name: 'Ventaja: Anti-Kinjutsu', type: 'Tienda PR', price: 2300, currency: 'PR' },
  { name: 'Ventaja: Resurgir', type: 'Tienda PR', price: 3000, currency: 'PR' },
  { name: 'Rasgo Extra (Combate)', type: 'Tienda PR', price: 800, currency: 'PR' },
  { name: 'Compra de RC', type: 'Tienda PR', price: 800, currency: 'PR' },
  { name: 'Bono +2', type: 'Tienda PR', price: 1000, currency: 'PR' },
  { name: 'Mejora Perspicaz', type: 'Tienda PR', price: 1200, currency: 'PR' },
  { name: 'Turno Interferencia', type: 'Tienda PR', price: 1300, currency: 'PR' }
];

const TIENDA_EXP: ReadonlyArray<MarketSeedItem> = [
  { name: 'Saltar Requisito Ascenso', type: 'Tienda EXP', price: 40, currency: 'EXP' },
  { name: '1 SP Adicional', type: 'Tienda EXP', price: 80, currency: 'EXP' },
  { name: 'Cambio Moral', type: 'Tienda EXP', price: 300, currency: 'EXP' },
  { name: 'Saltar Espera Misión S', type: 'Tienda EXP', price: 50, currency: 'EXP' },
  { name: 'Compra de 100 PR', type: 'Tienda EXP', price: 200, currency: 'EXP' },
  { name: 'Bono Técnica Superior (BTS)', type: 'Tienda EXP', price: 200, currency: 'EXP' },
  { name: 'Bono Exp. Superior (BES)', type: 'Tienda EXP', price: 300, currency: 'EXP' },
  { name: 'Compra de 10.000 Ryou', type: 'Tienda EXP', price: 40, currency: 'EXP' },
  { name: 'Reformulación de STATS', type: 'Tienda EXP', price: 80, currency: 'EXP' },
  { name: 'Reformulación de Rasgos', type: 'Tienda EXP', price: 100, currency: 'EXP' },
  { name: 'Fuuinjutsu Adicional', type: 'Tienda EXP', price: 30, currency: 'EXP' },
  { name: 'Cupo Ascenso NPC', type: 'Tienda EXP', price: 50, currency: 'EXP' }
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Falta DATABASE_URL en el entorno.');
  }

  console.log('🚀 Iniciando seed de mercados (Ninja/PR/EXP)...');

  const catalogoCompleto: ReadonlyArray<MarketSeedItem> = [
    ...MERCADO_NINJA,
    ...TIENDA_PR,
    ...TIENDA_EXP
  ];

  let synchronizedCount = 0;

  for (const item of catalogoCompleto) {
    await prisma.item.upsert({
      where: { name: item.name },
      update: {
        type: item.type,
        price: item.price,
        currency: item.currency
      },
      create: {
        name: item.name,
        type: item.type,
        price: item.price,
        currency: item.currency
      }
    });

    synchronizedCount += 1;
    console.log(`✅ Item sincronizado: ${item.name} (${item.currency} ${item.price})`);
  }

  console.log(`🎉 Seed de mercados completado. Items sincronizados: ${synchronizedCount}`);
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Error desconocido en seedMercados.';
    console.error(`❌ ${message}`);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
