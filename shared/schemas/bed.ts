import { z } from 'zod'

// 単発追加・編集の共通フィールド
export const bedNameSchema = z
  .string()
  .min(1, 'ベッド名は必須です')
  .max(50, '50 文字以内で入力してください')

// 単発作成: { name } を受け取る
export const createBedSchema = z.object({
  name: bedNameSchema,
})

// 一括作成: { count } を受け取り、サーバー側で「ベッド N」連番を生成する
export const createBedBulkSchema = z.object({
  count: z.number().int().min(1, '1 以上を指定してください').max(50, '一度に追加できるのは 50 個までです'),
})

// 部分更新（名前変更 / 表示順 / 有効・無効）
export const updateBedSchema = z.object({
  name: bedNameSchema.optional(),
  displayOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
})

export type CreateBedInput = z.input<typeof createBedSchema>
export type CreateBedBulkInput = z.input<typeof createBedBulkSchema>
export type UpdateBedInput = z.input<typeof updateBedSchema>
