import bcrypt from 'bcryptjs'

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

  const adminUser = process.env.ADMIN_USER
  const adminHash = process.env.ADMIN_PASSWORD_HASH

  if (!adminUser || !adminHash) {
    throw createError({ statusCode: 500, statusMessage: 'Admin credentials not configured' })
  }

  const userOk = username === adminUser
  // bcrypt.compare はユーザー名不一致時もダミーハッシュで比較してタイミング差を抑える
  const passOk = await bcrypt.compare(password, userOk ? adminHash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid')

  if (!userOk || !passOk) {
    throw createError({ statusCode: 401, statusMessage: 'ユーザー名またはパスワードが違います' })
  }

  await setUserSession(event, {
    user: { username },
    loggedInAt: new Date().toISOString(),
  })

  return { ok: true }
})
