import { prisma } from '../utils/prisma'

export default defineEventHandler(async () => {
  return prisma.store.findMany({
    where: { isActive: true },
    orderBy: [
      { prefecture: 'asc' },
      { displayOrder: 'asc' },
    ],
    select: {
      id: true,
      slug: true,
      prefecture: true,
      city: true,
      name: true,
      address: true,
      phone: true,
    },
  })
})
