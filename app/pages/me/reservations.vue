<script setup lang="ts">
// マイページ: 自分の予約履歴
// キャンセル・変更は店舗対応のため、ここでは表示のみ + 店舗電話を併記

definePageMeta({ middleware: 'member-auth' })
useHead({ title: '予約履歴 | マイページ' })

type DisplayStatus = 'UPCOMING' | 'COMPLETED' | 'NO_SHOW' | 'CANCELLED'
type Reservation = {
  id: number
  startAt: string
  endAt: string
  status: string
  displayStatus: DisplayStatus
  confirmationCode: string
  note: string | null
  store: { id: number, name: string, slug: string, phone: string | null, address: string, isActive: boolean }
  menu: { id: number, name: string, durationMinutes: number, priceJpy: number, isActive: boolean }
  practitionerName: string
}

const { data: reservations, pending, error } = await useFetch<Reservation[]>('/api/member/reservations')

const upcoming = computed(() => (reservations.value ?? []).filter(r => r.displayStatus === 'UPCOMING').reverse())
const past = computed(() => (reservations.value ?? []).filter(r => r.displayStatus !== 'UPCOMING'))

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}年${m}月${day}日(${dow}) ${hh}:${mm}`
}

function endTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 会員ページでは NO_SHOW を「キャンセル」と統一表示する（客視点の区別なし）
// 管理画面では引き続き「無断キャンセル」として表示・集計する
const STATUS_LABEL: Record<DisplayStatus, string> = {
  UPCOMING: '予約済',
  COMPLETED: '完了',
  NO_SHOW: 'キャンセル',
  CANCELLED: 'キャンセル',
}
const STATUS_BADGE: Record<DisplayStatus, string> = {
  UPCOMING: 'bg-green-100 text-green-800 border-green-300',
  COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
  NO_SHOW: 'bg-slate-100 text-slate-500 border-slate-300',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-300',
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 sm:px-6 py-8">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
        <UIcon name="i-lucide-calendar-check" class="size-6 text-orange-500" />
        予約履歴
      </h1>
      <NuxtLink to="/me" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        マイページ
      </NuxtLink>
    </div>

    <!-- キャンセル・変更案内 -->
    <div class="rounded-lg border border-orange-200 bg-orange-50 p-3 mb-6 text-sm text-slate-700">
      <p class="font-semibold mb-1 flex items-center gap-1">
        <UIcon name="i-lucide-info" class="size-4 text-orange-600" />
        予約の変更・キャンセルについて
      </p>
      <p class="text-xs text-slate-600">
        予約の変更・キャンセルは、各店舗までお電話ください。<br>
        スタッフが対応いたします。
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`予約一覧の取得に失敗しました: ${error.message}`"
      class="mb-4"
    />

    <div v-else-if="pending" class="text-center py-10 text-slate-500">
      <UIcon name="i-lucide-loader-circle" class="size-6 mx-auto animate-spin text-orange-500 mb-2" />
      読み込み中...
    </div>

    <div v-else>
      <!-- 今後の予約 -->
      <section v-if="upcoming.length > 0" class="mb-8">
        <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">
          今後の予約 ({{ upcoming.length }} 件)
        </h2>
        <div class="space-y-3">
          <article
            v-for="r in upcoming"
            :key="r.id"
            class="rounded-xl border-2 border-amber-300 bg-[#fff3db] p-4"
          >
            <div class="flex items-start justify-between gap-2 mb-2">
              <span
                class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border"
                :class="STATUS_BADGE[r.displayStatus]"
              >
                {{ STATUS_LABEL[r.displayStatus] }}
              </span>
              <span class="text-xs text-slate-500 tabular-nums">
                予約番号: {{ r.confirmationCode }}
              </span>
            </div>
            <p class="text-lg font-bold text-orange-800 tabular-nums">
              {{ formatDateTime(r.startAt) }} – {{ endTime(r.endAt) }}
            </p>
            <dl class="mt-2 text-sm text-slate-700 space-y-0.5">
              <div class="flex gap-2"><dt class="w-16 shrink-0 text-slate-500">店舗</dt><dd>{{ r.store.name }}</dd></div>
              <div class="flex gap-2"><dt class="w-16 shrink-0 text-slate-500">メニュー</dt><dd>{{ r.menu.name }}（{{ r.menu.durationMinutes }} 分）</dd></div>
              <div class="flex gap-2"><dt class="w-16 shrink-0 text-slate-500">担当</dt><dd>{{ r.practitionerName }}</dd></div>
              <div v-if="r.note" class="flex gap-2"><dt class="w-16 shrink-0 text-slate-500">ご要望</dt><dd>{{ r.note }}</dd></div>
            </dl>
            <a
              v-if="r.store.phone"
              :href="`tel:${r.store.phone.replace(/[^\d+]/g, '')}`"
              class="inline-flex items-center gap-1 mt-3 px-3 py-2 rounded-md bg-white border border-orange-300 text-orange-700 font-semibold text-sm hover:bg-orange-50 transition"
            >
              <UIcon name="i-lucide-phone" class="size-4" />
              変更・キャンセル: {{ r.store.phone }}
            </a>
          </article>
        </div>
      </section>

      <!-- 過去の予約 -->
      <section v-if="past.length > 0">
        <h2 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">
          過去の予約 ({{ past.length }} 件)
        </h2>
        <div class="space-y-2">
          <article
            v-for="r in past"
            :key="r.id"
            class="rounded-lg border border-slate-200 bg-white p-3"
          >
            <div class="flex items-start justify-between gap-2 mb-1">
              <span
                class="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border"
                :class="STATUS_BADGE[r.displayStatus]"
              >
                {{ STATUS_LABEL[r.displayStatus] }}
              </span>
              <span class="text-xs text-slate-400 tabular-nums">
                {{ r.confirmationCode }}
              </span>
            </div>
            <p class="text-sm font-semibold text-slate-800 tabular-nums">
              {{ formatDateTime(r.startAt) }}
            </p>
            <p class="text-xs text-slate-600 mt-0.5">
              {{ r.store.name }} / {{ r.menu.name }}
            </p>
            <!-- 同じ施術で再予約: 店舗もメニューも現役の場合のみ -->
            <div v-if="r.store.isActive && r.menu.isActive" class="mt-2 flex justify-end">
              <NuxtLink
                :to="`/reserve/${r.store.slug}/menu/${r.menu.id}/datetime`"
                class="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold text-xs transition"
              >
                <UIcon name="i-lucide-rotate-cw" class="size-3.5" />
                同じ施術で予約
              </NuxtLink>
            </div>
          </article>
        </div>
      </section>

      <!-- 予約なし -->
      <div v-if="upcoming.length === 0 && past.length === 0" class="text-center py-12 text-slate-500">
        <UIcon name="i-lucide-calendar-off" class="size-10 mx-auto mb-2" />
        <p>まだ予約はありません</p>
        <NuxtLink
          to="/"
          class="inline-block mt-4 px-4 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold transition"
        >
          ご予約はこちらから
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
