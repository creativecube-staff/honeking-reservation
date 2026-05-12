// /admin/* を保護するページミドルウェア（/admin/login は除外）。
// 未ログインなら /admin/login へリダイレクト。
// 各ページが definePageMeta({ requirePermission: 'xxx:yyy' }) を宣言していれば、
// 必要権限がないユーザーは /admin（ダッシュボード）に戻す。
import type { Permission } from '~~/shared/permissions'

export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  if (to.path === '/admin/login') return

  const { loggedIn, user } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo(`/admin/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // ページ側で必要権限を宣言している場合のみチェック
  const required = to.meta.requirePermission as Permission | undefined
  if (required && !user.value?.permissions?.includes(required)) {
    // ダッシュボードはほぼ全員が閲覧可。権限不足時はそこに戻す
    if (to.path !== '/admin') return navigateTo('/admin')
  }
})
