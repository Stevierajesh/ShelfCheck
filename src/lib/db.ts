import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma || createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
