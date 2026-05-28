import { z } from 'zod'
import { isReservedSlug } from '../reservedSlugs'
import { bedNameSchema } from './bed'
import { businessHourRangeSchema } from './businessHour'

// Store の共通バリデーションスキーマ。client（フォーム）と server（API）両方で使う。
export const storeBaseSchema = z.object({
  slug: z
    .string()
    .min(1, 'スラッグは必須です')
    .max(50, 'スラッグは 50 文字以内で入力してください')
    .regex(/^[a-z0-9-]+$/, 'スラッグは半角英数字とハイフンのみ使用できます')
    .refine(s => !isReservedSlug(s), {
      message: 'このスラッグはシステムで予約されているため使用できません',
    }),
  prefecture: z.string().min(1, '都道府県は必須です').max(20, '20 文字以内で入力してください'),
  city: z.string().min(1, '市区町村は必須です').max(30, '30 文字以内で入力してください'),
  name: z.string().min(1, '店舗名は必須です').max(100, '100 文字以内で入力してください'),
  address: z.string().min(1, '住所は必須です').max(200, '200 文字以内で入力してください'),
  phone: z.string().max(20, '20 文字以内で入力してください').nullable().optional(),
  // 店舗の業務用メールアドレス（任意）。空欄は API 層で null 化してから検証するので、ここでは email 形式 or null を許容。
  email: z.string().email('メールアドレスの形式が正しくありません').max(255, '255 文字以内で入力してください').nullable().optional(),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
})

export const createStoreSchema = storeBaseSchema.extend({
  isActive: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  // 作成時の初期セットアップ（Store 本体とは別に、サーバ側で分離して使う）。
  // beds: 作成するベッド名の配列（同名は不可） / businessHours: 営業時間レンジをまとめて作成
  beds: z
    .array(bedNameSchema)
    .max(50, 'ベッドは 50 台までです')
    .default([])
    .refine(names => new Set(names).size === names.length, {
      message: 'ベッド名が重複しています',
    }),
  businessHours: z.array(businessHourRangeSchema).default([]),
})

export const updateStoreSchema = storeBaseSchema.partial()

export type StoreFormState = z.input<typeof storeBaseSchema>
export type CreateStoreInput = z.input<typeof createStoreSchema>
export type UpdateStoreInput = z.input<typeof updateStoreSchema>
