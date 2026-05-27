import bcrypt from 'bcryptjs'
import { prisma } from '~~/server/utils/prisma'
import { resolvePermissions } from '~~/shared/permissions'

// ユーザー名不一致時のタイミング攻撃対策。bcrypt の比較時間を揃えるためのダミーハッシュ。
const DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'

// ログイン履歴の保持期間（日）。これを過ぎた行はログイン時に間引いて無限増加を防ぐ。変更はここ一箇所。
const LOGIN_HISTORY_RETENTION_DAYS = 180

// ブルートフォース対策のレート制限。直近 RATE_WINDOW_MINUTES 分の「失敗」回数で判定する。変更はここ。
const RATE_WINDOW_MINUTES = 15
const MAX_FAILURES_PER_USERNAME = 5 // 同一ユーザー名への連続失敗（特定アカウント狙い対策）
const MAX_FAILURES_PER_IP = 20 // 同一 IP からの連続失敗（ユーザー名総当たり対策・共有NATを考慮して緩め）

const loginSchema = (body: unknown): { username: string, password: string } => {
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  const b = body as Record<string, unknown>
  if (typeof b.username !== 'string' || typeof b.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'username and password required' })
  }
  return { username: b.username, password: b.password }
}

// 直近ウィンドウ内の失敗回数からブロック要否を判定する（LoginHistory を再利用、新テーブル不要）。
async function isRateLimited(username: string, ip: string | null): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MINUTES * 60 * 1000)

  const userFailures = await prisma.loginHistory.count({
    where: { usernameAttempted: username, success: false, createdAt: { gte: since } },
  })
  if (userFailures >= MAX_FAILURES_PER_USERNAME) return true

  if (ip) {
    const ipFailures = await prisma.loginHistory.count({
      where: { ipAddress: ip, success: false, createdAt: { gte: since } },
    })
    if (ipFailures >= MAX_FAILURES_PER_IP) return true
  }

  return false
}

// ログイン履歴を 1 件記録（成功・失敗どちらも）+ 低頻度で古い履歴を間引く。
// 履歴記録の失敗がログイン処理自体を巻き込まないよう、内部で握りつぶす。
async function recordLogin(opts: { practitionerId: number | null, username: string, success: boolean, ip: string | null, userAgent: string | null }) {
  try {
    await prisma.loginHistory.create({
      data: {
        practitionerId: opts.practitionerId,
        usernameAttempted: opts.username,
        success: opts.success,
        ipAddress: opts.ip,
        userAgent: opts.userAgent,
      },
    })

    // 無限増加防止: 低頻度（約5%）で保持期間を過ぎた履歴を間引く。createdAt に index があるので軽い。
    if (Math.random() < 0.05) {
      const cutoff = new Date(Date.now() - LOGIN_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
      await prisma.loginHistory.deleteMany({ where: { createdAt: { lt: cutoff } } })
    }
  }
  catch {
    // 記録・間引きに失敗してもログインは妨げない
  }
}

export default defineEventHandler(async (event) => {
  const { username, password } = loginSchema(await readBody(event))
  // Caddy 経由のため x-forwarded-for を見る。IP/UA はここで一度だけ取得して使い回す。
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? null
  const userAgent = getRequestHeader(event, 'user-agent') ?? null

  // レート制限: 直近の失敗が多すぎるときは認証前にブロック（429）。
  // ブロック中は履歴を新規記録しない（攻撃時に行が洪水のように増えるのを防ぐため）。
  if (await isRateLimited(username, ip)) {
    throw createError({ statusCode: 429, statusMessage: '試行回数が多すぎます。15 分ほど待ってから再度お試しください。' })
  }

  // ログイン許可スタッフのみ対象。isActive=false や canLogin=false なら拒否。
  const staff = await prisma.practitioner.findUnique({ where: { username } })

  // ユーザーが居なくてもダミーハッシュで比較し、タイミング差から「存在するか」を漏らさない。
  const passOk = await bcrypt.compare(password, staff?.passwordHash ?? DUMMY_HASH)

  if (!staff || !passOk || !staff.canLogin || !staff.isActive || !staff.role) {
    // 失敗を記録（狙われた username は生で、該当アカウントが見つかれば id も残す）
    await recordLogin({ practitionerId: staff?.id ?? null, username, success: false, ip, userAgent })
    throw createError({ statusCode: 401, statusMessage: 'ユーザー名またはパスワードが違います' })
  }

  const permissions = resolvePermissions(staff.role, staff.permissions)

  await setUserSession(event, {
    user: {
      id: staff.id,
      username: staff.username!,
      displayName: staff.name,
      role: staff.role,
      permissions,
      // 店舗スコープ判定用の所属店舗
      storeId: staff.storeId,
    },
    loggedInAt: new Date().toISOString(),
  })

  // 成功を記録 + 最終ログイン日時を更新（どちらも失敗してもログインは成立させる）
  await recordLogin({ practitionerId: staff.id, username, success: true, ip, userAgent })
  await prisma.practitioner.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } }).catch(() => {})

  return { ok: true }
})
