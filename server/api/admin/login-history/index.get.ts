import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// ログイン履歴の一覧（新しい順）。OWNER のみ。
// ?practitionerId でアカウント絞り込み / ?success=true|false で成否絞り込み / ?limit（最大 200・既定 100）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const query = getQuery(event)
  const practitionerId = Number(query.practitionerId)
  const limitRaw = Number(query.limit)
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 && limitRaw <= 200 ? limitRaw : 100

  const where: { practitionerId?: number, success?: boolean } = {}
  if (Number.isInteger(practitionerId) && practitionerId > 0) where.practitionerId = practitionerId
  if (query.success === 'true') where.success = true
  if (query.success === 'false') where.success = false

  return prisma.loginHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      usernameAttempted: true,
      success: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      practitioner: { select: { id: true, name: true } },
    },
  })
})
