import { z } from 'zod'

const timeRegex = /^(?:[01]\d|2[0-3]):[0-5]\d$/

// 1 つの営業時間レンジ（1 日に複数持てる）
// dayOfWeek: -1=祝日（国民の祝日・全店共通）, 0=日, 1=月, …, 6=土
// 祝日(-1) はオプション。-1 のレンジが無ければ祝日は日曜(0)にフォールバックする。
export const businessHourRangeSchema = z
  .object({
    dayOfWeek: z.number().int().min(-1).max(6),
    startTime: z.string().regex(timeRegex, 'HH:MM 形式'),
    endTime: z.string().regex(timeRegex, 'HH:MM 形式'),
  })
  .refine(d => d.startTime < d.endTime, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['endTime'],
  })

// 1 店舗の 7 曜日分まとめての upsert
// 各レンジは独立した行。店休 = その dayOfWeek にレンジが 0 件
// 同一日内のレンジ重複はサーバー側で検証
export const businessHoursBulkSchema = z.object({
  ranges: z.array(businessHourRangeSchema),
})

export type BusinessHourRangeInput = z.input<typeof businessHourRangeSchema>
export type BusinessHoursBulkInput = z.input<typeof businessHoursBulkSchema>
