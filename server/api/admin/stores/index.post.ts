import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { createStoreSchema } from '../../../../shared/schemas/store'
import { encryptUtf8 } from '../../../utils/crypto'
import { generatePassword } from '../../../utils/generatePassword'
import { prisma } from '../../../utils/prisma'

// 店舗を作成し、同時にその店舗のログインアカウント（店長相当・自店固定）を 1 件自動発行する。
// パスワードはサーバで強いランダム生成し、平文は「このレスポンスでだけ」返す（以後 DB にはハッシュしか残らず復元不可）。
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

  // 作成時の初期セットアップ（ベッド名・営業時間）は Store のカラムではないので分離する
  const { beds, businessHours, ...storeData } = parsed.data

  // 自動生成パスワード（平文は return でだけ使い、DB には bcrypt ハッシュのみ保存）
  const password = generatePassword()
  const passwordHash = await bcrypt.hash(password, 10)

  try {
    // 店舗・ログインアカウント・初期ベッド・営業時間は不可分なのでトランザクションで同時作成
    const { store, username } = await prisma.$transaction(async (tx) => {
      const created = await tx.store.create({ data: storeData })
      // 店舗ログインアカウント（Login テーブル）: username=店舗slug / 役職=店長(自店の全機能)。
      // 非 OWNER なので、このアカウントでログインすると store-switcher は自店固定になる。
      const account = await tx.login.create({
        data: {
          storeId: created.id,
          displayName: created.name,
          username: created.slug,
          passwordHash,
          // OWNER がログイン管理画面で確認できるよう暗号化して併存
          passwordEnc: encryptUtf8(password),
          role: 'MANAGER',
          permissions: [],
          isActive: true,
        },
        select: { username: true },
      })

      // 初期ベッドを名前リストから一括作成（表示順は配列順。空なら作らない）
      if (beds.length > 0) {
        await tx.bed.createMany({
          data: beds.map((name, i) => ({
            storeId: created.id,
            name,
            displayOrder: i,
          })),
        })
      }

      // 営業時間レンジをまとめて作成（標準値 or フォームで編集した値。空なら作らない＝店休扱い）
      if (businessHours.length > 0) {
        await tx.businessHour.createMany({
          data: businessHours.map(r => ({
            storeId: created.id,
            dayOfWeek: r.dayOfWeek,
            startTime: r.startTime,
            endTime: r.endTime,
          })),
        })
      }

      return { store: created, username: account.username }
    })

    // 平文パスワードは「ここでだけ」返す（画面で 1 回表示して控えてもらう）
    return { ...store, account: { username, password } }
  }
  catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      // 店舗 slug もしくはログイン ID(=slug) の重複
      throw createError({ statusCode: 409, statusMessage: 'スラッグ（ログイン ID）はすでに使われています' })
    }
    throw e
  }
})
