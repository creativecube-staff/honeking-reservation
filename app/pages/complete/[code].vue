<script setup lang="ts">
// 予約フロー: 完了画面
const route = useRoute()
const code = computed(() => String(route.params.code ?? ''))

type Reservation = {
  confirmationCode: string
  status: string
  startAt: string
  endAt: string
  note: string | null
  store: {
    id: number
    name: string
    address: string
    phone: string | null
  }
  menu: {
    id: number
    name: string
    durationMinutes: number
    priceJpy: number
  }
  customerName: string | null
}

const { data: reservation, error } = await useFetch<Reservation>(() => `/api/reservations/${code.value}`)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const startLabel = computed(() => {
  if (!reservation.value) return ''
  const d = new Date(reservation.value.startAt)
  // JST 表示
  const jst = new Date(d.getTime() + 9 * 3600_000)
  const y = jst.getUTCFullYear()
  const mo = jst.getUTCMonth() + 1
  const da = jst.getUTCDate()
  const h = jst.getUTCHours()
  const mi = jst.getUTCMinutes()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][jst.getUTCDay()]
  return `${y}年${mo}月${da}日 (${dow}) ${pad(h)}:${pad(mi)}`
})

const endTimeLabel = computed(() => {
  if (!reservation.value) return ''
  const d = new Date(reservation.value.endAt)
  const jst = new Date(d.getTime() + 9 * 3600_000)
  return `${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`
})

function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} 時間` : `${h} 時間 ${m} 分`
}

function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

useHead({ title: '予約完了 | ほねキング整骨院 予約' })
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 sm:px-6 py-8">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="error.statusCode === 404
        ? '予約が見つかりませんでした'
        : `予約情報の取得に失敗しました: ${error.message}`"
    />

    <div v-else-if="reservation">
      <!-- 完了ヘッダー(中央寄せ・成功感) -->
      <div class="text-center mb-8">
        <div class="inline-flex size-16 sm:size-20 rounded-full bg-green-500 items-center justify-center mb-4 shadow-lg success-pop">
          <UIcon name="i-lucide-check" class="size-10 sm:size-12 text-white" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-2 tracking-tight">
          ご予約が<span class="text-orange-600">完了</span>しました
        </h1>
        <p class="text-sm sm:text-base text-slate-700">
          <span v-if="reservation.customerName">
            <strong>{{ reservation.customerName }}</strong> 様、
          </span>
          ご予約ありがとうございます。
        </p>
      </div>

      <!-- 予約番号(大判) -->
      <div class="max-w-lg mx-auto mb-8">
        <div class="rounded-xl border-2 border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50 p-5 sm:p-6 text-center shadow-sm">
          <p class="inline-flex items-center gap-1 text-xs sm:text-sm text-slate-600 mb-2">
            <UIcon name="i-lucide-ticket" class="size-4 text-orange-600" />
            ご予約番号
          </p>
          <p class="text-3xl sm:text-5xl font-extrabold text-orange-700 tabular-nums tracking-widest">
            {{ reservation.confirmationCode }}
          </p>
          <p class="mt-3 text-xs text-slate-600">
            ご来店時にこの番号をお伝えいただくとスムーズです
          </p>
        </div>
      </div>

      <!-- 予約内容ストリップ(店舗 → メニュー → 日時) -->
      <!-- 店舗 -->
      <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-lucide-store" class="size-4 sm:size-5 text-orange-600 shrink-0" />
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">店舗</p>
            <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
              {{ reservation.store.name }}
            </p>
            <p class="text-xs text-slate-600 leading-tight truncate mt-0.5">
              {{ reservation.store.address }}
            </p>
          </div>
        </div>
        <a
          v-if="reservation.store.phone"
          :href="`tel:${reservation.store.phone}`"
          class="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold tabular-nums transition cursor-pointer"
        >
          <UIcon name="i-lucide-phone" class="size-4" />
          {{ reservation.store.phone }}
        </a>
      </div>

      <!-- メニュー -->
      <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-lucide-list" class="size-4 sm:size-5 text-orange-600 shrink-0" />
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">メニュー</p>
            <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
              {{ reservation.menu.name }}
            </p>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-base sm:text-lg font-extrabold text-orange-600 tabular-nums leading-none">
            ¥{{ yen(reservation.menu.priceJpy) }}
          </p>
          <p class="text-[10px] sm:text-xs text-slate-500 mt-0.5">{{ duration(reservation.menu.durationMinutes) }}</p>
        </div>
      </div>

      <!-- 日時 -->
      <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <UIcon name="i-lucide-calendar" class="size-4 sm:size-5 text-orange-600 shrink-0" />
          <div class="min-w-0">
            <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご予約日時</p>
            <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ startLabel }}</p>
          </div>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-base sm:text-lg font-extrabold text-orange-600 tabular-nums leading-none">
            〜{{ endTimeLabel }}
          </p>
        </div>
      </div>

      <!-- ご要望(任意) -->
      <div v-if="reservation.note" class="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-6">
        <UIcon name="i-lucide-message-square" class="size-4 sm:size-5 text-orange-600 shrink-0 mt-0.5" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご要望・症状</p>
          <p class="text-sm text-slate-800 whitespace-pre-line leading-snug">{{ reservation.note }}</p>
        </div>
      </div>

      <div class="max-w-lg mx-auto">
        <!-- お願い・注意事項 -->
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
          <p class="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
            <UIcon name="i-lucide-info" class="size-4 text-orange-600" />
            ご来店時のお願い
          </p>
          <ul class="space-y-1.5 text-sm text-slate-700">
            <li class="flex items-start gap-1.5">
              <UIcon name="i-lucide-clock" class="size-4 text-slate-400 mt-0.5 shrink-0" />
              <span>5〜10 分前を目安にご来店ください</span>
            </li>
            <li class="flex items-start gap-1.5">
              <UIcon name="i-lucide-phone-call" class="size-4 text-slate-400 mt-0.5 shrink-0" />
              <span>キャンセル・日時変更はお早めに店舗までお電話ください</span>
            </li>
            <li class="flex items-start gap-1.5">
              <UIcon name="i-lucide-image" class="size-4 text-slate-400 mt-0.5 shrink-0" />
              <span>このページをスクリーンショット、または印刷して保管しておくと安心です</span>
            </li>
          </ul>
        </div>

        <!-- アクション -->
        <NuxtLink
          to="/"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-sm transition cursor-pointer"
        >
          <UIcon name="i-lucide-home" class="size-5" />
          トップへ戻る
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes success-pop {
  0% { transform: scale(0); opacity: 0; }
  60% { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.success-pop {
  animation: success-pop 0.5s ease-out;
}
@media (prefers-reduced-motion: reduce) {
  .success-pop { animation: none; }
}
</style>
