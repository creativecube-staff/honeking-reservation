import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const createHolidaySchema = z.object({
  date: z.string().regex(dateRegex, '日付は YYYY-MM-DD 形式で指定してください'),
  note: z.string().max(200, '200 文字以内で入力してください').nullable().optional(),
})

export type CreateHolidayInput = z.input<typeof createHolidaySchema>
