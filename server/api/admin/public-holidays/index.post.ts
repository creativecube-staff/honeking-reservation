import { Prisma } from '@prisma/client'
import { createPublicHolidaySchema } from '~~/shared/schemas/publicHoliday'
import { prisma } from '~~/server/utils/prisma'
import { requireUser } from '~~/server/utils/requirePermission'

// 国民の祝日を新規追加。OWNER のみ。
// date は @unique なので重複時は 409 を返す。
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  if (user.role !== 'OWNER') {
    throw createError({ statusCode: 403, statusMessage: 'オーナーのみ実行できます' })
  }

  const body = await readBody(event)
  const parsed = createPublicHolidaySchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  try {
    return await prisma.publicHoliday.create({
      data: {
        date: new Date(parsed.data.date),
        name: parsed.data.name,
        note: parsed.data.note ?? null,
      },
    })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'その日付の祝日はすでに登録されています' })
    }
    throw e
  }
})
