import { prisma } from '../../utils/prisma'

// お客様側: slug から店舗詳細を取得（予約フローのヘッダー表示などに使用）
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'slug が指定されていません' })
  }

  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      prefecture: true,
      city: true,
      name: true,
      address: true,
      phone: true,
      isActive: true,
    },
  })

  if (!store || !store.isActive) {
    throw createError({ statusCode: 404, statusMessage: '店舗が見つかりません' })
  }

  return store
})
