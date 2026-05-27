import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// ログイン可能アカウントの一覧（オーナー + 各店舗アカウント）。
// セキュリティに関わる全店横断の情報なので OWNER のみ。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const rows = await prisma.practitioner.findMany({
    where: { canLogin: true },
    orderBy: [{ role: 'asc' }, { storeId: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      store: { select: { id: true, name: true } },
      // 暗号化パスワードの有無だけを boolean で返す（値そのものは確認 API でのみ復号）
      passwordEnc: true,
    },
  })

  // passwordEnc の中身は一覧に載せず、保持しているかどうか(hasPassword)だけに変換する
  return rows.map(({ passwordEnc, ...rest }) => ({ ...rest, hasPassword: !!passwordEnc }))
})
