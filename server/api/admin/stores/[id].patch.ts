import { Prisma } from '@prisma/client'
import { updateStoreSchema } from '../../../../shared/schemas/store'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, statusMessage: '不正な ID です' })
  }

  const body = await readBody(event)
  const parsed = updateStoreSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  try {
    return await prisma.store.update({ where: { id }, data: parsed.data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2002') {
        throw createError({ statusCode: 409, statusMessage: 'スラッグはすでに使われています' })
      }
      if (e.code === 'P2025') {
        throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
      }
    }
    throw e
  }
})
