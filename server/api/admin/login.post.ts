import bcrypt from 'bcryptjs'
import { prisma } from '~~/server/utils/prisma'
import { resolvePermissions } from '~~/shared/permissions'

// ユーザー名不一致時のタイミング攻撃対策。bcrypt の比較時間を揃えるためのダミーハッシュ。
const DUMMY_HASH = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid'

const loginSchema = (body: unknown): { username: string, password: string } => {
  if (!body || typeof body !== 'object') throw createError({ statusCode: 400, statusMessage: 'Invalid body' })
  const b = body as Record<string, unknown>
  if (typeof b.username !== 'string' || typeof b.password !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'username and password required' })
  }
  return { username: b.username, password: b.password }
}

export default defineEventHandler(async (event) => {
  const { username, password } = loginSchema(await readBody(event))

  // ログイン許可スタッフのみ対象。isActive=false や canLogin=false なら拒否。
  const staff = await prisma.practitioner.findUnique({ where: { username } })

  // ユーザーが居なくてもダミーハッシュで比較し、タイミング差から「存在するか」を漏らさない。
  const passOk = await bcrypt.compare(password, staff?.passwordHash ?? DUMMY_HASH)

  if (!staff || !passOk || !staff.canLogin || !staff.isActive || !staff.role) {
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

  return { ok: true }
})
