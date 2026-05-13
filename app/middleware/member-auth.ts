// /me/* を保護する名前付きミドルウェア。
// 各ページで `definePageMeta({ middleware: 'member-auth' })` を宣言すると有効になる。
// 未ログインなら /login へリダイレクト。

export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, refresh } = useMember()
  // 初回ロード時はまだフェッチ完了してない可能性があるので最新を取得
  if (!loggedIn.value) await refresh()
  if (!loggedIn.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
