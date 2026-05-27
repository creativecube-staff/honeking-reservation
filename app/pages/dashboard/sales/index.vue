<script setup lang="ts">
// 売上管理ダッシュボード。
// 期間 + 店舗で絞り込み、合計・日別・店舗別・スタッフ別・商品別を表示する。
import type { Store } from '@prisma/client'

definePageMeta({ layout: 'admin', requirePermission: 'sale:view' })

// 店舗スイッチャーのコンテキスト。
// 管理者(全店)モードの「売上管理」は全体経営ダッシュボードを構築予定のため、現状は改修中のプレースホルダーを表示する。
// 店舗モード（特定店舗選択時）は従来どおりの集計画面を出す。
const { selectedStoreId, canAccessAll } = useStoreContext()
const isAdminContext = computed(() => canAccessAll.value && selectedStoreId.value === null)

type RevenueBucket = { menu: number, product: number, voucher: number, total: number }
type DayRow = { date: string } & RevenueBucket
type StoreRow = { storeId: number, storeName: string } & RevenueBucket
type StaffRow = { staffId: number, staffName: string } & RevenueBucket
type ProductRow = { productId: number, productName: string, kind: 'PRODUCT' | 'VOUCHER', quantity: number, revenue: number }
type Summary = {
  from: string
  to: string
  grandTotal: RevenueBucket
  days: DayRow[]
  byStore: StoreRow[]
  byStaff: StaffRow[]
  byProduct: ProductRow[]
}

function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function firstOfMonthYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
}

const fromDate = ref(firstOfMonthYmd())
const toDate = ref(todayYmd())
const storeFilter = ref<number | null>(null)

const { data: stores } = await useFetch<Store[]>('/api/admin/stores', { query: { status: 'active' } })

const apiQuery = computed(() => {
  const q: Record<string, string> = { from: fromDate.value, to: toDate.value }
  if (storeFilter.value) q.storeId = String(storeFilter.value)
  return q
})

const { data: summary, refresh } = await useFetch<Summary>('/api/admin/revenue/summary', {
  query: apiQuery,
  watch: [apiQuery],
})

function yen(n: number): string { return n.toLocaleString('ja-JP') }

// 期間プリセット
function setToday() {
  fromDate.value = todayYmd()
  toDate.value = todayYmd()
}
function setThisMonth() {
  fromDate.value = firstOfMonthYmd()
  toDate.value = todayYmd()
}
function setLast7Days() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  fromDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  toDate.value = todayYmd()
}
function setLast30Days() {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  fromDate.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  toDate.value = todayYmd()
}

function onStoreChange(event: Event) {
  const v = Number((event.target as HTMLSelectElement).value)
  storeFilter.value = v > 0 ? v : null
}

// 日別の最大値（バー表示用スケーリング）
const maxDayTotal = computed(() => Math.max(1, ...(summary.value?.days ?? []).map(d => d.total)))

function dayLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00+09:00`)
  return `${d.getMonth() + 1}/${d.getDate()}（${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}）`
}
</script>

<template>
  <div>
    <!-- 管理者(全店)モードの「売上管理」は全体経営の売上ダッシュボードを構築予定。現在は改修中のプレースホルダーを表示する -->
    <div v-if="isAdminContext" class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
        <UIcon name="i-lucide-hard-hat" class="size-8" />
      </div>
      <h1 class="mt-4 text-2xl font-semibold text-slate-900">
        売上管理（全体）
      </h1>
      <p class="mt-2 max-w-md text-sm text-slate-600">
        全店舗をまとめた経営向けの売上ダッシュボードは現在改修中です。<br>
        店舗ごとの売上は、ヘッダーの店舗スイッチャーで店舗を選ぶと確認できます。
      </p>
      <span class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
        <UIcon name="i-lucide-wrench" class="size-3.5" />
        改修中
      </span>
    </div>

    <!-- 店舗モード（特定店舗選択時）は従来どおりの売上集計画面 -->
    <template v-else>
    <div class="flex items-center gap-3 mb-1 flex-wrap">
      <h1 class="text-2xl font-semibold text-slate-900">
        売上管理
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      施術・物販・回数券販売を統合した売上を、店舗・スタッフ・商品別に可視化します。
      回数券は購入日に計上、消費日は売上ゼロです。
    </p>

    <!-- 期間 + 店舗フィルタ -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex items-end gap-3 flex-wrap">
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">店舗</label>
        <select
          :value="storeFilter ?? ''"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
          @change="onStoreChange"
        >
          <option value="">
            全店舗
          </option>
          <option v-for="s in stores ?? []" :key="s.id" :value="s.id">
            {{ s.name }}
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">開始日</label>
        <input v-model="fromDate" type="date" class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white">
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">終了日</label>
        <input v-model="toDate" type="date" class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white">
      </div>
      <div class="flex items-center gap-1">
        <button type="button" class="px-2.5 py-1.5 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50" @click="setToday">
          今日
        </button>
        <button type="button" class="px-2.5 py-1.5 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50" @click="setLast7Days">
          7 日
        </button>
        <button type="button" class="px-2.5 py-1.5 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50" @click="setLast30Days">
          30 日
        </button>
        <button type="button" class="px-2.5 py-1.5 text-xs rounded-sm border border-slate-300 bg-white hover:bg-slate-50" @click="setThisMonth">
          今月
        </button>
      </div>
      <button
        type="button"
        class="ml-auto text-xs text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        @click="refresh()"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-3" />
        再読み込み
      </button>
    </div>

    <!-- 合計カード -->
    <div class="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
      <div class="bg-white border-2 border-orange-300 rounded-sm p-4">
        <p class="text-xs text-slate-600 mb-1 font-semibold">
          合計売上
        </p>
        <p class="text-3xl font-bold text-orange-900 tabular-nums">
          ¥{{ yen(summary?.grandTotal.total ?? 0) }}
        </p>
      </div>
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
        <p class="text-xs text-slate-600 mb-1">
          施術
        </p>
        <p class="text-2xl font-semibold text-slate-900 tabular-nums">
          ¥{{ yen(summary?.grandTotal.menu ?? 0) }}
        </p>
      </div>
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
        <p class="text-xs text-slate-600 mb-1">
          物販
        </p>
        <p class="text-2xl font-semibold text-slate-900 tabular-nums">
          ¥{{ yen(summary?.grandTotal.product ?? 0) }}
        </p>
      </div>
      <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
        <p class="text-xs text-slate-600 mb-1">
          回数券販売
        </p>
        <p class="text-2xl font-semibold text-slate-900 tabular-nums">
          ¥{{ yen(summary?.grandTotal.voucher ?? 0) }}
        </p>
      </div>
    </div>

    <!-- 日別売上推移 -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] mb-6">
      <div class="px-4 py-2.5 border-b border-[#dcdcde]">
        <h2 class="text-base font-semibold text-slate-900">
          日別売上推移
        </h2>
      </div>
      <div class="p-4 overflow-x-auto">
        <table class="w-full text-sm border-collapse min-w-[640px]">
          <thead class="bg-[#f6f7f7]">
            <tr>
              <th class="text-left px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]">
                日付
              </th>
              <th class="text-right px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]">
                施術
              </th>
              <th class="text-right px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]">
                物販
              </th>
              <th class="text-right px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]">
                回数券
              </th>
              <th class="text-right px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]">
                合計
              </th>
              <th class="px-2 py-1.5 font-semibold text-slate-700 border-b border-[#dcdcde]" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="d in summary?.days ?? []" :key="d.date" class="border-b border-[#f0f0f1] last:border-b-0">
              <td class="px-2 py-1.5 text-slate-700">
                {{ dayLabel(d.date) }}
              </td>
              <td class="px-2 py-1.5 text-right tabular-nums text-slate-700">
                ¥{{ yen(d.menu) }}
              </td>
              <td class="px-2 py-1.5 text-right tabular-nums text-slate-700">
                ¥{{ yen(d.product) }}
              </td>
              <td class="px-2 py-1.5 text-right tabular-nums text-slate-700">
                ¥{{ yen(d.voucher) }}
              </td>
              <td class="px-2 py-1.5 text-right tabular-nums font-semibold text-slate-900">
                ¥{{ yen(d.total) }}
              </td>
              <td class="px-2 py-1.5 w-1/3 min-w-[120px]">
                <div class="h-3 bg-slate-100 rounded-sm overflow-hidden">
                  <div class="h-full bg-orange-400" :style="{ width: `${(d.total / maxDayTotal) * 100}%` }" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 店舗別 / スタッフ別 / 商品別 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-4 py-2.5 border-b border-[#dcdcde]">
          <h2 class="text-sm font-semibold text-slate-900">
            店舗別
          </h2>
        </div>
        <ul class="divide-y divide-[#f0f0f1]">
          <li v-if="(summary?.byStore?.length ?? 0) === 0" class="px-4 py-3 text-sm text-slate-500">
            データなし
          </li>
          <li v-for="b in summary?.byStore ?? []" :key="b.storeId" class="px-4 py-3 text-sm">
            <div class="flex items-baseline justify-between">
              <span class="font-medium text-slate-900">{{ b.storeName }}</span>
              <span class="tabular-nums font-semibold">¥{{ yen(b.total) }}</span>
            </div>
            <div class="text-xs text-slate-500 mt-1">
              施術 ¥{{ yen(b.menu) }} / 物販 ¥{{ yen(b.product) }} / 回数券 ¥{{ yen(b.voucher) }}
            </div>
          </li>
        </ul>
      </div>

      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-4 py-2.5 border-b border-[#dcdcde]">
          <h2 class="text-sm font-semibold text-slate-900">
            スタッフ別 (Top 10)
          </h2>
        </div>
        <ol class="divide-y divide-[#f0f0f1]">
          <li v-if="(summary?.byStaff?.length ?? 0) === 0" class="px-4 py-3 text-sm text-slate-500">
            データなし
          </li>
          <li v-for="(s, i) in (summary?.byStaff ?? []).slice(0, 10)" :key="s.staffId" class="px-4 py-3 text-sm flex items-baseline gap-2">
            <span class="text-slate-400 tabular-nums w-5">{{ i + 1 }}</span>
            <div class="flex-1">
              <div class="flex items-baseline justify-between">
                <span class="font-medium text-slate-900">{{ s.staffName }}</span>
                <span class="tabular-nums font-semibold">¥{{ yen(s.total) }}</span>
              </div>
              <div class="text-xs text-slate-500">
                施術 ¥{{ yen(s.menu) }} / 販売 ¥{{ yen(s.product + s.voucher) }}
              </div>
            </div>
          </li>
        </ol>
      </div>

      <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div class="px-4 py-2.5 border-b border-[#dcdcde]">
          <h2 class="text-sm font-semibold text-slate-900">
            商品別 (Top 10)
          </h2>
        </div>
        <ol class="divide-y divide-[#f0f0f1]">
          <li v-if="(summary?.byProduct?.length ?? 0) === 0" class="px-4 py-3 text-sm text-slate-500">
            データなし
          </li>
          <li v-for="(p, i) in (summary?.byProduct ?? []).slice(0, 10)" :key="p.productId" class="px-4 py-3 text-sm flex items-baseline gap-2">
            <span class="text-slate-400 tabular-nums w-5">{{ i + 1 }}</span>
            <div class="flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <span class="font-medium text-slate-900">
                  <span class="inline-flex items-center text-[10px] px-1 py-0.5 rounded-sm border mr-1" :class="p.kind === 'VOUCHER' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'">
                    {{ p.kind === 'VOUCHER' ? '券' : '物' }}
                  </span>
                  {{ p.productName }}
                </span>
                <span class="tabular-nums font-semibold">¥{{ yen(p.revenue) }}</span>
              </div>
              <div class="text-xs text-slate-500">
                {{ p.quantity }} 個
              </div>
            </div>
          </li>
        </ol>
      </div>
    </div>
    </template>
  </div>
</template>
