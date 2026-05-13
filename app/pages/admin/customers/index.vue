<script setup lang="ts">
import { MEMBERSHIP_BADGE, type Membership } from '~~/shared/membership'

definePageMeta({ layout: 'admin', requirePermission: 'customer:view' })

// 一覧データ自体は dormant 区別を持たない（dormant はフィルタ手段でしかない）
type ListMembership = Membership | 'dormant' | 'all'
type Customer = {
  id: number
  name: string | null
  phone: string | null
  email: string | null
  membership: Membership
  withdrawnAt: string | null
  lastLoginAt: string | null
  createdAt: string
  reservationCount: number
  lastVisitAt: string | null
  upcomingCount: number
}
type ListResponse = {
  items: Customer[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const route = useRoute()
const router = useRouter()

// ── URL クエリ <-> state ─────────────────────────────
const ALL_TABS = ['all', 'member', 'pending', 'guest', 'dormant', 'withdrawn'] as const
const membershipFilter = computed<ListMembership>({
  get() {
    const v = String(route.query.membership ?? 'all')
    return (ALL_TABS as readonly string[]).includes(v) ? (v as ListMembership) : 'all'
  },
  set(v) {
    router.replace({ query: { ...route.query, membership: v === 'all' ? undefined : v, page: undefined } })
  },
})

// 休眠の閾値（日数）。?dormantDays=30 と URL に載る
const dormantDays = computed<number>({
  get() {
    const n = Number(route.query.dormantDays)
    return Number.isInteger(n) && n >= 1 && n <= 3650 ? n : 30
  },
  set(v) {
    router.replace({ query: { ...route.query, dormantDays: v === 30 ? undefined : String(v), page: undefined } })
  },
})
const dormantDaysInput = ref(dormantDays.value)
watch(dormantDays, v => { dormantDaysInput.value = v })
function applyDormantDays() {
  const n = Math.max(1, Math.min(3650, Math.trunc(Number(dormantDaysInput.value) || 30)))
  dormantDaysInput.value = n
  dormantDays.value = n
}

const sortFilter = computed<string>({
  get() {
    const v = String(route.query.sort ?? 'createdAt')
    return v === 'lastLoginAt' ? 'lastLoginAt' : 'createdAt'
  },
  set(v) {
    router.replace({ query: { ...route.query, sort: v === 'createdAt' ? undefined : v, page: undefined } })
  },
})

const orderFilter = computed<string>({
  get() {
    const v = String(route.query.order ?? 'desc')
    return v === 'asc' ? 'asc' : 'desc'
  },
  set(v) {
    router.replace({ query: { ...route.query, order: v === 'desc' ? undefined : v, page: undefined } })
  },
})

const qFilter = computed<string>({
  get() { return String(route.query.q ?? '') },
  set(v) { router.replace({ query: { ...route.query, q: v || undefined, page: undefined } }) },
})

const pageNum = computed<number>({
  get() {
    const q = Number(route.query.page)
    return Number.isInteger(q) && q > 0 ? q : 1
  },
  set(v) {
    router.replace({ query: { ...route.query, page: String(v) } })
  },
})

// 検索入力（ボタン押下で反映）
const qInput = ref(qFilter.value)
watch(qFilter, v => { qInput.value = v })
function applySearch() {
  qFilter.value = qInput.value.trim()
}

// ── データ ──────────────────────────────────────────
const { data, status, refresh } = await useFetch<ListResponse>('/api/admin/customers', {
  query: computed(() => ({
    membership: membershipFilter.value === 'all' ? undefined : membershipFilter.value,
    dormantDays: membershipFilter.value === 'dormant' ? dormantDays.value : undefined,
    sort: sortFilter.value,
    order: orderFilter.value,
    q: qFilter.value || undefined,
    page: pageNum.value,
    pageSize: 50,
  })),
  watch: [membershipFilter, dormantDays, sortFilter, orderFilter, qFilter, pageNum],
})

// ── 表示ヘルパ ───────────────────────────────────────
// fmtJstDate / fmtJstDateTime は app/utils/format.ts の auto-import 経由で利用。
// メンバーシップバッジ表記は shared/membership.ts の MEMBERSHIP_BADGE を流用。

const tabs: { value: ListMembership, label: string, icon: string }[] = [
  { value: 'all', label: 'すべて', icon: 'i-lucide-users' },
  { value: 'member', label: '本会員', icon: 'i-lucide-badge-check' },
  { value: 'pending', label: '仮登録', icon: 'i-lucide-mail-question' },
  { value: 'dormant', label: '休眠', icon: 'i-lucide-clock-alert' },
  { value: 'guest', label: 'ゲストのみ', icon: 'i-lucide-user' },
  { value: 'withdrawn', label: '退会済', icon: 'i-lucide-user-x' },
]

function clearFilters() {
  router.replace({ query: {} })
  qInput.value = ''
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        顧客管理
      </h1>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      会員・ゲスト顧客を一括で確認できます。来店履歴・販売履歴・回数券は詳細画面から閲覧できます。
    </p>

    <!-- 会員区分フィルタ（ピル形ボタン） -->
    <BasePillTabs v-model="membershipFilter" :items="tabs" class="mb-3" />

    <!-- 休眠タブ選択時のみ閾値入力 -->
    <div v-if="membershipFilter === 'dormant'" class="mb-3 flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-sm p-2.5">
      <UIcon name="i-lucide-clock-alert" class="size-4 text-amber-700" />
      <span class="text-amber-800">最終来店から</span>
      <input
        v-model.number="dormantDaysInput"
        type="number"
        min="1"
        max="3650"
        class="w-20 px-2 py-1 text-sm border border-amber-300 rounded-sm bg-white tabular-nums focus:outline-none focus:border-orange-500"
        @keydown.enter="applyDormantDays"
      >
      <span class="text-amber-800">日以上来店なしの顧客を表示</span>
      <button
        type="button"
        class="ml-1 px-3 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded-sm"
        @click="applyDormantDays"
      >
        反映
      </button>
    </div>

    <!-- フィルター -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-3 mb-4 flex flex-wrap items-end gap-3">
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">並び順</label>
        <select
          v-model="sortFilter"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
          <option value="createdAt">
            登録日
          </option>
          <option value="lastLoginAt">
            最終ログイン日
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">昇降順</label>
        <select
          v-model="orderFilter"
          class="px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
          <option value="desc">
            新しい順
          </option>
          <option value="asc">
            古い順
          </option>
        </select>
      </div>
      <div class="flex-1 min-w-[220px]">
        <label class="block text-xs font-semibold text-slate-700 mb-1">
          検索（氏名・電話・メール）
        </label>
        <div class="flex gap-2">
          <input
            v-model="qInput"
            type="text"
            class="flex-1 px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
            placeholder="山田太郎 / 090- / @example.com"
            @keydown.enter="applySearch"
          >
          <button
            type="button"
            class="px-3 py-1.5 text-sm bg-slate-600 hover:bg-slate-700 text-white rounded-sm"
            @click="applySearch"
          >
            検索
          </button>
        </div>
      </div>
      <button
        type="button"
        class="px-3 py-1.5 text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-sm"
        @click="clearFilters"
      >
        条件クリア
      </button>
    </div>

    <!-- 件数・再読み込み -->
    <div class="flex items-center justify-between mb-2 text-sm">
      <p class="text-slate-600">
        <span v-if="status === 'pending'">読み込み中...</span>
        <span v-else-if="data">
          全 <strong class="tabular-nums">{{ data.total }}</strong> 件 / {{ data.page }} / {{ data.totalPages }} ページ
        </span>
      </p>
      <button
        type="button"
        class="text-xs text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        @click="refresh()"
      >
        <UIcon name="i-lucide-refresh-cw" class="size-3" />
        再読み込み
      </button>
    </div>

    <!-- テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm border-collapse min-w-[920px]">
        <thead class="bg-[#f6f7f7]">
          <tr>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">氏名</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">連絡先</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">会員区分</th>
            <th class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">来店</th>
            <th class="text-right px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">予約中</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">最終来店</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">最終ログイン</th>
            <th class="text-left px-3 py-2 font-semibold text-slate-700 border-b border-[#dcdcde]">登録日</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="status === 'pending'">
            <td colspan="8" class="px-3 py-10 text-center text-slate-500">
              読み込み中...
            </td>
          </tr>
          <tr v-else-if="!data || data.items.length === 0">
            <td colspan="8" class="px-3 py-10 text-center text-slate-500">
              該当する顧客はいません
            </td>
          </tr>
          <tr
            v-for="c in (data?.items ?? [])"
            v-else
            :key="c.id"
            class="border-b border-[#f0f0f1] last:border-b-0 hover:bg-orange-50/40 cursor-pointer"
            :class="c.membership === 'withdrawn' ? 'opacity-60' : ''"
            @click="router.push(`/admin/customers/${c.id}`)"
          >
            <td class="px-3 py-2">
              <NuxtLink
                :to="`/admin/customers/${c.id}`"
                class="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
                @click.stop
              >
                {{ c.name ?? '(復号失敗)' }}
              </NuxtLink>
            </td>
            <td class="px-3 py-2 text-xs">
              <div v-if="c.phone" class="text-slate-700">
                {{ c.phone }}
              </div>
              <div v-if="c.email" class="text-slate-500">
                {{ c.email }}
              </div>
              <div v-if="!c.phone && !c.email" class="text-slate-400">
                —
              </div>
            </td>
            <td class="px-3 py-2">
              <span class="inline-block px-2 py-0.5 text-xs font-semibold rounded border" :class="MEMBERSHIP_BADGE[c.membership].class">
                {{ MEMBERSHIP_BADGE[c.membership].label }}
              </span>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              <span :class="c.reservationCount > 0 ? 'font-semibold' : 'text-slate-400'">
                {{ c.reservationCount }}
              </span>
            </td>
            <td class="px-3 py-2 text-right tabular-nums">
              <span :class="c.upcomingCount > 0 ? 'font-semibold text-green-700' : 'text-slate-400'">
                {{ c.upcomingCount }}
              </span>
            </td>
            <td class="px-3 py-2 tabular-nums text-slate-700">
              {{ fmtJstDate(c.lastVisitAt) }}
            </td>
            <td class="px-3 py-2 tabular-nums text-slate-700">
              {{ fmtJstDateTime(c.lastLoginAt) }}
            </td>
            <td class="px-3 py-2 tabular-nums text-slate-700">
              {{ fmtJstDate(c.createdAt) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ページ送り下部 -->
    <BasePagination
      v-if="data"
      v-model:page="pageNum"
      :total-pages="data.totalPages"
    />
  </div>
</template>
