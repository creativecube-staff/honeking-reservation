// 会員ログアウト: session 全体をクリア。
//
// 注意: 同じ cookie に admin user セッションが居る場合、これも一緒に落とす。
// 1 ユーザーが両方同時にログインするケースはレアなので許容する。
// 将来両セッション共存が必要になったら、cookie 名を分離する方向で再設計する。

export default defineEventHandler(async (event) => {
  await clearUserSession(event)
  return { ok: true }
})
