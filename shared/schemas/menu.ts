import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// 単発作成・編集の共通フィールド（編集時に未送信フィールドは partial で許容）
const baseShape = {
  name: z.string().min(1, 'メニュー名は必須です').max(100, '100 文字以内で入力してください'),
  description: z.string().max(1000, '1000 文字以内で入力してください').nullable().optional(),
  durationMinutes: z.number().int().min(5, '5 分以上で入力してください').max(600, '600 分以下で入力してください'),
  priceJpy: z.number().int().min(0, '0 円以上で入力してください').max(1000000, '上限を超えています'),
  displayOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
  // 表示期間（任意。両方 null/未指定 = 期間制限なし）
  availableFrom: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください').nullable().optional(),
  availableUntil: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください').nullable().optional(),
}

const periodOrderRefine = (d: { availableFrom?: string | null, availableUntil?: string | null }) =>
  !d.availableFrom || !d.availableUntil || d.availableFrom <= d.availableUntil

const periodOrderError = {
  message: '終了日は開始日以降にしてください',
  path: ['availableUntil'] as const,
}

export const menuBaseSchema = z.object(baseShape).refine(periodOrderRefine, periodOrderError)

export const createMenuSchema = z
  .object({
    ...baseShape,
    isActive: z.boolean().default(true),
    displayOrder: z.number().int().min(0).max(9999).default(0),
  })
  .refine(periodOrderRefine, periodOrderError)

export const updateMenuSchema = z.object(baseShape).partial().refine(periodOrderRefine, periodOrderError)

export type MenuFormState = z.input<typeof menuBaseSchema>
export type CreateMenuInput = z.input<typeof createMenuSchema>
export type UpdateMenuInput = z.input<typeof updateMenuSchema>
