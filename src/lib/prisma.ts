import { PrismaClient } from '@prisma/client';
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL is not defined in environment variables');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter } as any);

/**
 * Gracefully disconnect Prisma client and close the database connection pool.
 * Call this when shutting down the application.
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    await pool.end();
    console.log('✅ Prisma client and database pool disconnected');
  } catch (error) {
    console.error('❌ Error disconnecting Prisma:', error);
    process.exit(1);
  }
}
