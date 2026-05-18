// /dashboard/* を保護するページミドルウェア（/login は除外）。
// 未ログインなら /login へリダイレクト。
// 各ページが definePageMeta({ requirePermission: 'xxx:yyy' }) を宣言していれば、
// 必要権限がないユーザーは /dashboard（ダッシュボード）に戻す。
import type { Permission } from '~~/shared/permissions'

export default defineNuxtRouteMiddleware(async (to) => {
  // /dashboard 配下のみ保護。/login はそもそも /dashboard 配下じゃないので自動的に除外される。
  if (!to.path.startsWith('/dashboard')) return

  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // ページ側で必要権限を宣言している場合のみチェック
  const required = to.meta.requirePermission as Permission | undefined
  if (required && !user.value?.permissions?.includes(required)) {
    // ダッシュボードはほぼ全員が閲覧可。権限不足時はそこに戻す
    if (to.path !== '/dashboard') return navigateTo('/dashboard')
  }
})
