import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'
import { canAccessAllStores } from '~~/shared/storeAccess'

// ヘッダーの店舗スイッチャー用。
// ログイン中ユーザーがアクセスできる店舗一覧 + 全店舗を選べるか(canAccessAll)を返す。
// - OWNER          : 全アクティブ店舗 + canAccessAll=true（「全店舗」も選べる）
// - それ以外        : 所属店舗 1 件のみ + canAccessAll=false（自店固定）
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const canAccessAll = canAccessAllStores(user.role)

  const stores = await prisma.store.findMany({
    where: canAccessAll
      ? { isActive: true }
      : { id: user.storeId, isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true },
  })

  return { canAccessAll, stores }
})
