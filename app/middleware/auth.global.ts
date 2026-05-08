// /admin/* を保護するページミドルウェア（/admin/login は除外）。
// 未ログインで管理画面にアクセスしたらログイン画面へリダイレクト。
export default defineNuxtRouteMiddleware(async (to) => {
  if (!to.path.startsWith('/admin')) return
  if (to.path === '/admin/login') return

  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo(`/admin/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
