// /api/admin/* を保護するサーバーミドルウェア。
// /api/admin/login, /api/admin/me だけは未認証でも通す（前者は認証フロー、後者はログイン状態の問い合わせ）。
const PUBLIC_PATHS = new Set(['/api/admin/login', '/api/admin/me'])

export default defineEventHandler(async (event) => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/admin')) return
  if (PUBLIC_PATHS.has(path)) return

  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
})
