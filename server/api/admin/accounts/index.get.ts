import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// ログイン可能アカウント（Login テーブル）の一覧。
// オーナー + 各店舗アカウント。セキュリティに関わる全店横断情報なので OWNER のみ。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ閲覧できます' })
  }

  const rows = await prisma.login.findMany({
    orderBy: [{ role: 'asc' }, { storeId: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      displayName: true,
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
  // 互換維持のため UI 側で参照している `name` も displayName から提供する
  return rows.map(({ passwordEnc, displayName, ...rest }) => ({
    ...rest,
    name: displayName,
    hasPassword: !!passwordEnc,
  }))
})
