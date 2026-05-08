// セッション情報を返す（ログイン状態確認用）
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  return {
    user: session.user ?? null,
    loggedIn: !!session.user,
  }
})
