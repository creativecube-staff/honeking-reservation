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

useHead({ title: '予約完了 | honeking 予約' })
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 sm:px-6 py-8">
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="error.statusCode === 404
        ? '予約が見つかりませんでした'
        : `予約情報の取得に失敗しました: ${error.message}`"
    />

    <div v-else-if="reservation">
      <!-- 完了ヘッダー -->
      <div class="text-center mb-8">
        <div class="inline-flex size-16 rounded-full bg-green-500 items-center justify-center mb-4">
          <UIcon name="i-lucide-check" class="size-10 text-white" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
          ご予約が完了しました
        </h1>
        <p class="text-sm text-slate-700">
          <span v-if="reservation.customerName">
            <strong>{{ reservation.customerName }}</strong> 様
          </span>
          ご予約ありがとうございます。
        </p>
      </div>

      <!-- 予約番号 -->
      <div class="rounded-xl border-2 border-orange-400 bg-orange-50 p-5 mb-6 text-center">
        <p class="text-xs text-slate-600 mb-1">
          ご予約番号
        </p>
        <p class="text-3xl sm:text-4xl font-extrabold text-orange-700 tabular-nums tracking-widest">
          {{ reservation.confirmationCode }}
        </p>
        <p class="mt-2 text-xs text-slate-600">
          ご来店時にこの番号をお伝えいただくとスムーズです
        </p>
      </div>

      <!-- 予約内容詳細 -->
      <div class="rounded-xl border-2 border-amber-300 bg-[#fff3db] p-5 mb-6 space-y-4">
        <div>
          <p class="text-xs text-slate-600">店舗</p>
          <p class="text-base font-bold text-slate-900">
            {{ reservation.store.name }}
          </p>
          <p class="text-sm text-slate-700 mt-1">
            {{ reservation.store.address }}
          </p>
          <p v-if="reservation.store.phone" class="text-sm text-slate-700">
            📞 {{ reservation.store.phone }}
          </p>
        </div>

        <div class="border-t border-amber-300 pt-4">
          <p class="text-xs text-slate-600">メニュー</p>
          <p class="text-base font-bold text-slate-900">
            {{ reservation.menu.name }}
          </p>
          <p class="text-sm text-slate-700 mt-1">
            所要時間 {{ duration(reservation.menu.durationMinutes) }} / ¥{{ yen(reservation.menu.priceJpy) }}
          </p>
        </div>

        <div class="border-t border-amber-300 pt-4">
          <p class="text-xs text-slate-600">日時</p>
          <p class="text-lg font-bold text-orange-800 tabular-nums">
            {{ startLabel }}–{{ endTimeLabel }}
          </p>
        </div>

        <div v-if="reservation.note" class="border-t border-amber-300 pt-4">
          <p class="text-xs text-slate-600">ご要望・症状</p>
          <p class="text-sm text-slate-800 whitespace-pre-line">
            {{ reservation.note }}
          </p>
        </div>
      </div>

      <!-- お願い・注意事項 -->
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6 text-sm text-slate-700 space-y-2">
        <p class="font-semibold text-slate-900">
          ご来店時のお願い
        </p>
        <ul class="list-disc list-inside space-y-1 text-xs">
          <li>5〜10 分前を目安にご来店ください</li>
          <li>キャンセル・日時変更はお早めに店舗までお電話ください</li>
          <li>このページをスクリーンショットしておくと安心です</li>
        </ul>
      </div>

      <!-- アクション -->
      <div class="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          class="flex-1 py-2.5 text-sm font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 inline-flex items-center justify-center gap-1"
          @click="() => window.print()"
        >
          <UIcon name="i-lucide-printer" class="size-4" />
          印刷
        </button>
        <NuxtLink
          to="/"
          class="flex-1 py-2.5 text-sm font-semibold rounded-md bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center justify-center gap-1"
        >
          トップへ戻る
          <UIcon name="i-lucide-chevron-right" class="size-4" />
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
