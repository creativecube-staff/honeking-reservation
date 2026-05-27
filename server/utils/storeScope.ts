// API ハンドラ用の店舗スコープ解決 + 越権ガード。
// ログイン中ユーザーの役職と所属店舗から、「このリクエストで絞るべき storeId」を返す。
//
// - OWNER         : requested があればその店舗、無ければ null（= 全店舗集計）
// - それ以外       : 所属店舗に固定。requested が所属店舗以外なら 403
//
// 戻り値 storeId が null のときは「全店舗」を意味する（OWNER のみ到達しうる）。
import type { H3Event } from 'h3'
import { canAccessAllStores } from '~~/shared/storeAccess'
import { requireUser } from './requirePermission'

export async function resolveStoreScope(
  event: H3Event,
  requestedStoreId?: number | null,
): Promise<{ storeId: number | null }> {
  const user = await requireUser(event)

  if (canAccessAllStores(user.role)) {
    return { storeId: requestedStoreId ?? null }
  }

  const home = user.storeId
  if (home == null) {
    throw createError({ statusCode: 403, statusMessage: '店舗が割り当てられていません' })
  }
  if (requestedStoreId != null && requestedStoreId !== home) {
    throw createError({ statusCode: 403, statusMessage: 'この店舗にはアクセスできません' })
  }
  return { storeId: home }
}

/** クエリ文字列の storeId を安全に number | null へ。 */
export function parseStoreIdQuery(raw: unknown): number | null {
  const n = typeof raw === 'string' ? Number(raw) : NaN
  return Number.isInteger(n) && n > 0 ? n : null
}
