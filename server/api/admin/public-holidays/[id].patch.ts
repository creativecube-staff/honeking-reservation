import { Prisma } from '@prisma/client'
import { updatePublicHolidaySchema } from '~~/shared/schemas/publicHoliday'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 祝日の部分更新（日付・名称）。OWNER のみ。
// 日付を変えるときは @unique 違反に注意（既存日付に重複するなら 409）。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const existing = await prisma.publicHoliday.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: '祝日が見つかりません' })
  }

  const body = await readBody(event)
  const parsed = updatePublicHolidaySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  const data: { date?: Date, name?: string, note?: string | null } = {}
  if (parsed.data.date !== undefined) data.date = new Date(parsed.data.date)
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.note !== undefined) data.note = parsed.data.note ?? null

  try {
    return await prisma.publicHoliday.update({ where: { id }, data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'その日付の祝日はすでに登録されています' })
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
      throw createError({ statusCode: 404, statusMessage: '祝日が見つかりません' })
    }
    throw e
  }
})
