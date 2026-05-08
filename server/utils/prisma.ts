import { PrismaClient } from '@prisma/client'

// HMR / hot reload の際に PrismaClient のコネクションが増殖するのを防ぐシングルトン。
// Nuxt の server context は Node.js プロセス上で動くので globalThis を共有できる。
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
