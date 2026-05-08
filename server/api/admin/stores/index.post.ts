import { Prisma } from '@prisma/client'
import { createStoreSchema } from '../../../../shared/schemas/store'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const parsed = createStoreSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: '入力内容に誤りがあります',
      data: { issues: parsed.error.issues },
    })
  }

  try {
    return await prisma.store.create({ data: parsed.data })
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw createError({ statusCode: 409, statusMessage: 'スラッグはすでに使われています' })
    }
    throw e
  }
})
