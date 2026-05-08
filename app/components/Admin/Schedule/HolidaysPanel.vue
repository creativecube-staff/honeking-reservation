<script setup lang="ts">
import type { Closure, Holiday } from '@prisma/client'

const props = defineProps<{
  storeId: number
}>()

// ── 終日休み (Holiday) ────────────────────────────────
const { data: holidays, refresh: refreshHolidays, error: holidaysError } = await useFetch<Holiday[]>(
  () => `/api/admin/stores/${props.storeId}/holidays`,
  { watch: [() => props.storeId] },
)

const newHolidayDate = ref('')
const newHolidayNote = ref('')
const addingHoliday = ref(false)
const holidayError = ref<string | null>(null)

async function onAddHoliday() {
  holidayError.value = null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newHolidayDate.value)) {
    holidayError.value = '日付を選んでください'
    return
  }
  addingHoliday.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/holidays`, {
      method: 'POST',
      body: { date: newHolidayDate.value, note: newHolidayNote.value || null },
    })
    newHolidayDate.value = ''
    newHolidayNote.value = ''
    await refreshHolidays()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    holidayError.value = err.data?.statusMessage || err.statusMessage || '追加に失敗しました'
  }
  finally {
    addingHoliday.value = false
  }
}

const holidayBusy = ref<number | null>(null)

async function onDeleteHoliday(h: Holiday) {
  if (!confirm(`${dateFmt.format(new Date(h.date))} の終日休みを削除しますか？`)) return
  holidayBusy.value = h.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/holidays/${h.id}`, { method: 'DELETE' })
    await refreshHolidays()
  }
  finally {
    holidayBusy.value = null
  }
}

// ── 部分閉店 (Closure) ────────────────────────────────
const { data: closures, refresh: refreshClosures, error: closuresError } = await useFetch<Closure[]>(
  () => `/api/admin/stores/${props.storeId}/closures`,
  { watch: [() => props.storeId] },
)

const newClosureDate = ref('')
const newClosureStart = ref('')
const newClosureEnd = ref('')
const newClosureNote = ref('')
const addingClosure = ref(false)
const closureError = ref<string | null>(null)

async function onAddClosure() {
  closureError.value = null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(newClosureDate.value)) {
    closureError.value = '日付を選んでください'
    return
  }
  if (!/^\d{2}:\d{2}$/.test(newClosureStart.value) || !/^\d{2}:\d{2}$/.test(newClosureEnd.value)) {
    closureError.value = '開始・終了時刻を入力してください'
    return
  }
  if (newClosureStart.value >= newClosureEnd.value) {
    closureError.value = '終了時刻は開始時刻より後にしてください'
    return
  }
  addingClosure.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/closures`, {
      method: 'POST',
      body: {
        date: newClosureDate.value,
        startTime: newClosureStart.value,
        endTime: newClosureEnd.value,
        note: newClosureNote.value || null,
      },
    })
    newClosureDate.value = ''
    newClosureStart.value = ''
    newClosureEnd.value = ''
    newClosureNote.value = ''
    await refreshClosures()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    closureError.value = err.data?.statusMessage || err.statusMessage || '追加に失敗しました'
  }
  finally {
    addingClosure.value = false
  }
}

const closureBusy = ref<number | null>(null)

async function onDeleteClosure(c: Closure) {
  if (!confirm(`${dateFmt.format(new Date(c.date))} ${c.startTime}-${c.endTime} の部分閉店を削除しますか？`)) return
  closureBusy.value = c.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/closures/${c.id}`, { method: 'DELETE' })
    await refreshClosures()
  }
  finally {
    closureBusy.value = null
  }
}

// ── 共通 ──────────────────────────────────────────────
const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  weekday: 'short',
})

const baseInput = 'px-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500'
</script>

<template>
  <div class="space-y-6">
    <!-- ─────────────── 終日休み ─────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">
          終日休み
        </h3>
        <p class="text-xs text-slate-500">
          1 日まるごと営業しない日（年末年始・棚卸しなど）
        </p>
      </div>

      <UAlert
        v-if="holidaysError"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="`終日休みの取得に失敗しました: ${holidaysError.message}`"
      />

      <!-- 追加フォーム -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
        <h4 class="text-xs font-semibold text-slate-900 mb-3">
          終日休みを追加
        </h4>
        <div class="flex items-end gap-3 flex-wrap">
          <div>
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              日付 <span class="text-red-600">*</span>
            </label>
            <input v-model="newHolidayDate" type="date" :class="baseInput">
          </div>
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              メモ（任意）
            </label>
            <input
              v-model="newHolidayNote"
              type="text"
              placeholder="例: 年末年始、研修、棚卸しなど"
              :class="[baseInput, 'w-full']"
            >
          </div>
          <button
            type="button"
            :disabled="addingHoliday"
            class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
            @click="onAddHoliday"
          >
            {{ addingHoliday ? '追加中...' : '+ 追加' }}
          </button>
        </div>
        <p v-if="holidayError" class="mt-2 text-xs text-red-700">
          {{ holidayError }}
        </p>
      </div>

      <!-- リスト -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[#f6f7f7] text-slate-900">
            <tr>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                日付
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                メモ
              </th>
              <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] w-32">
                アクション
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="(holidays ?? []).length === 0">
              <td colspan="3" class="px-3 py-6 text-center text-slate-500">
                終日休みはまだ登録されていません。
              </td>
            </tr>
            <tr
              v-for="h in holidays"
              :key="h.id"
              class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
            >
              <td class="px-3 py-2.5 font-medium text-slate-900">
                {{ dateFmt.format(new Date(h.date)) }}
              </td>
              <td class="px-3 py-2.5 text-slate-700">
                {{ h.note || '—' }}
              </td>
              <td class="px-3 py-2.5 text-right">
                <button
                  type="button"
                  :disabled="holidayBusy === h.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400 text-xs"
                  @click="onDeleteHoliday(h)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ─────────────── 部分閉店 ─────────────── -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-slate-900">
          部分閉店
        </h3>
        <p class="text-xs text-slate-500">
          特定の時間帯だけ閉店（設備点検・院内会議など、同日複数登録可）
        </p>
      </div>

      <UAlert
        v-if="closuresError"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="`部分閉店の取得に失敗しました: ${closuresError.message}`"
      />

      <!-- 追加フォーム -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
        <h4 class="text-xs font-semibold text-slate-900 mb-3">
          部分閉店を追加
        </h4>
        <div class="flex items-end gap-3 flex-wrap">
          <div>
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              日付 <span class="text-red-600">*</span>
            </label>
            <input v-model="newClosureDate" type="date" :class="baseInput">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              開始 <span class="text-red-600">*</span>
            </label>
            <input v-model="newClosureStart" type="time" step="900" :class="baseInput">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              終了 <span class="text-red-600">*</span>
            </label>
            <input v-model="newClosureEnd" type="time" step="900" :class="baseInput">
          </div>
          <div class="flex-1 min-w-[180px]">
            <label class="block text-xs font-semibold text-slate-900 mb-1">
              メモ（任意）
            </label>
            <input
              v-model="newClosureNote"
              type="text"
              placeholder="例: 設備点検、院長会議など"
              :class="[baseInput, 'w-full']"
            >
          </div>
          <button
            type="button"
            :disabled="addingClosure"
            class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
            @click="onAddClosure"
          >
            {{ addingClosure ? '追加中...' : '+ 追加' }}
          </button>
        </div>
        <p v-if="closureError" class="mt-2 text-xs text-red-700">
          {{ closureError }}
        </p>
      </div>

      <!-- リスト -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-[#f6f7f7] text-slate-900">
            <tr>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                日付
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                時間帯
              </th>
              <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
                メモ
              </th>
              <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] w-32">
                アクション
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="(closures ?? []).length === 0">
              <td colspan="4" class="px-3 py-6 text-center text-slate-500">
                部分閉店はまだ登録されていません。
              </td>
            </tr>
            <tr
              v-for="c in closures"
              :key="c.id"
              class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
            >
              <td class="px-3 py-2.5 font-medium text-slate-900">
                {{ dateFmt.format(new Date(c.date)) }}
              </td>
              <td class="px-3 py-2.5 text-slate-700 tabular-nums">
                {{ c.startTime }} - {{ c.endTime }}
              </td>
              <td class="px-3 py-2.5 text-slate-700">
                {{ c.note || '—' }}
              </td>
              <td class="px-3 py-2.5 text-right">
                <button
                  type="button"
                  :disabled="closureBusy === c.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400 text-xs"
                  @click="onDeleteClosure(c)"
                >
                  削除
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <p class="text-xs text-slate-600">
      終日休み・部分閉店に登録した時間帯は予約枠ゼロになります。
      国民の祝日（全店共通）は別管理です（PublicHoliday）。
    </p>
  </div>
</template>
