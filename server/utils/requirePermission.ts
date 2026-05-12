// API ハンドラ用の認可ヘルパー。
// 未ログインは 401、必要権限なしは 403 を投げる。
// セッションは login.post.ts で setUserSession 済みの permissions（resolvePermissions 後）を見る。
import type { H3Event } from 'h3'
import type { Permission } from '~~/shared/permissions'

/** ログイン中のユーザー情報を返す。未ログインなら 401 を投げる。 */
export async function requireUser(event: H3Event) {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'ログインが必要です' })
  }
  return session.user
}

/** 指定 permission を持つ場合のみ通す。 */
export async function requirePermission(event: H3Event, permission: Permission) {
  const user = await requireUser(event)
  if (!user.permissions?.includes(permission)) {
    throw createError({ statusCode: 403, statusMessage: '権限がありません' })
  }
  return user
}
