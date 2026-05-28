import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

// 国民の祝日（全店共通・営業はする / 日曜扱いまたは BusinessHour[dayOfWeek=-1] で運用）。
// note は任意。店休日と運用感覚を揃えるため項目を持つ。
export const createPublicHolidaySchema = z.object({
  date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください'),
  name: z.string().min(1, '名称は必須です').max(50, '50 文字以内で入力してください'),
  note: z.string().max(200, '200 文字以内で入力してください').nullable().optional(),
})

// 部分更新（PATCH）。全フィールド任意。
export const updatePublicHolidaySchema = z.object({
  date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください').optional(),
  name: z.string().min(1, '名称は必須です').max(50, '50 文字以内で入力してください').optional(),
  note: z.string().max(200, '200 文字以内で入力してください').nullable().optional(),
})

export type CreatePublicHolidayInput = z.input<typeof createPublicHolidaySchema>
export type UpdatePublicHolidayInput = z.input<typeof updatePublicHolidaySchema>
