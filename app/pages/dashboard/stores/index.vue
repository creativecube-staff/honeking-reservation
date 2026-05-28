<script setup lang="ts">
import type { Store } from '@prisma/client'

// WordPress 風の店舗一覧画面（wp-list-table 模倣）。
// 管理者(全店)モード専用。店舗の追加・編集・無効化・完全削除を行う。
// 店休日・祝日は別ページ /dashboard/holidays に分離済み。
definePageMeta({ layout: 'admin' })

type Status = 'all' | 'active' | 'inactive'
const status = ref<Status>('all')

const { data: stores, refresh, error } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'all' },
})

// あいまい検索: 店舗名・スラッグ・都道府県・市区町村を対象に部分一致（スペース区切りで AND）。
// 件数が増えても素早く目的の店舗に辿り着けるようにする。データ自体は少数なのでクライアント側で絞る。
const keyword = ref('')
function matchesKeyword(s: Store): boolean {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return true
  const haystack = `${s.name} ${s.slug} ${s.prefecture} ${s.city}`.toLowerCase()
  return kw.split(/\s+/).every(term => haystack.includes(term))
}

// 検索で絞った母集合。ステータスタブの件数もこの母集合に対して数える（検索に追従させる）。
const searched = computed(() => (stores.value ?? []).filter(matchesKeyword))

const counts = computed(() => {
  const list = searched.value
  return {
    all: list.length,
    active: list.filter(s => s.isActive).length,
    inactive: list.filter(s => !s.isActive).length,
  }
})

const filtered = computed(() => {
  const list = searched.value
  if (status.value === 'active') return list.filter(s => s.isActive)
  if (status.value === 'inactive') return list.filter(s => !s.isActive)
  return list
})

// 列ヘッダークリックでソート（都道府県・市区町村・表示順）。同じ列を再クリックで昇順⇔降順。
type SortKey = 'prefecture' | 'city' | 'displayOrder'
const sortKey = ref<SortKey | null>(null)
const sortDir = ref<'asc' | 'desc'>('asc')

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  }
  else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const sorted = computed(() => {
  const list = [...filtered.value]
  const key = sortKey.value
  if (!key) return list
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    if (key === 'displayOrder') return (a.displayOrder - b.displayOrder) * dir
    // 都道府県・市区町村は日本語ロケールで比較
    return String(a[key]).localeCompare(String(b[key]), 'ja') * dir
  })
})

const tabs: { v: Status, label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'active', label: '有効' },
  { v: 'inactive', label: '無効' },
]

const busy = ref<number | null>(null)

async function softDelete(id: number, name: string) {
  if (!confirm(`店舗「${name}」を無効化しますか？\n（データは残り、フィルタ「無効」から復活できます）`)) return
  busy.value = id
  try {
    await $fetch(`/api/admin/stores/${id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

async function activate(id: number) {
  busy.value = id
  try {
    await $fetch(`/api/admin/stores/${id}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

// --- 完全削除（物理削除）モーダル ---
interface PurgeCounts {
  reservations: number
  productSales: number
  customerVouchers: number
  voucherUsages: number
  reservationHistories: number
  menus: number
  products: number
  businessHours: number
  holidays: number
  beds: number
  staffs: number
  logins: number
}
interface PurgePreview {
  store: { id: number, name: string, slug: string, isActive: boolean }
  counts: PurgeCounts
  crossStoreReservations: number
  canPurge: boolean
  reasons: string[]
}

// 影響範囲の表示順とラベル（プレビューのカウントを並べる）
const purgeCountLabels: { key: keyof PurgeCounts, label: string }[] = [
  { key: 'reservations', label: '予約' },
  { key: 'reservationHistories', label: '予約変更履歴' },
  { key: 'voucherUsages', label: '回数券消費' },
  { key: 'customerVouchers', label: '顧客回数券' },
  { key: 'productSales', label: '販売記録' },
  { key: 'menus', label: '店舗特別メニュー' },
  { key: 'products', label: '店舗特別商品' },
  { key: 'businessHours', label: '営業時間' },
  { key: 'holidays', label: '店休日' },
  { key: 'beds', label: 'ベッド' },
  { key: 'staffs', label: 'スタッフ' },
  { key: 'logins', label: 'ログインアカウント' },
]

const purgeTarget = ref<Store | null>(null)
const purgePreview = ref<PurgePreview | null>(null)
const purgeConfirmName = ref('')
const purgeLoading = ref(false) // プレビュー取得中
const purgeBusy = ref(false) // 削除実行中
const purgeError = ref('')

// $fetch のエラーから日本語メッセージを取り出す
function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const err = e as { statusMessage?: string, message?: string, data?: { statusMessage?: string, message?: string } }
    return err.data?.statusMessage ?? err.statusMessage ?? err.data?.message ?? err.message ?? fallback
  }
  return fallback
}

async function openPurge(store: Store) {
  purgeTarget.value = store
  purgePreview.value = null
  purgeConfirmName.value = ''
  purgeError.value = ''
  purgeLoading.value = true
  try {
    purgePreview.value = await $fetch<PurgePreview>(`/api/admin/stores/${store.id}/purge-preview`)
  }
  catch (e) {
    purgeError.value = errMessage(e, '影響範囲の取得に失敗しました')
  }
  finally {
    purgeLoading.value = false
  }
}

function closePurge() {
  if (purgeBusy.value) return // 削除中は閉じさせない
  purgeTarget.value = null
  purgePreview.value = null
  purgeConfirmName.value = ''
  purgeError.value = ''
}

// 店舗名の完全一致 + 削除可能 + 実行中でない、を満たすときだけ実行ボタンを有効化
const canSubmitPurge = computed(() =>
  !!purgePreview.value
  && purgePreview.value.canPurge
  && purgeConfirmName.value === purgeTarget.value?.name
  && !purgeBusy.value,
)

async function confirmPurge() {
  if (!purgeTarget.value || !canSubmitPurge.value) return
  purgeBusy.value = true
  purgeError.value = ''
  try {
    await $fetch(`/api/admin/stores/${purgeTarget.value.id}/purge`, {
      method: 'DELETE',
      body: { confirmName: purgeConfirmName.value },
    })
    purgeTarget.value = null
    purgePreview.value = null
    purgeConfirmName.value = ''
    await refresh()
  }
  catch (e) {
    purgeError.value = errMessage(e, '削除に失敗しました')
  }
  finally {
    purgeBusy.value = false
  }
}

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
</script>

<template>
  <div>
    <AdminDetailHeader title="店舗管理" description="店舗の追加・編集・無効化を行います。">
      <!-- 新規追加はタイトルの隣（バッジ位置）に置く -->
      <NuxtLink
        to="/dashboard/stores/new"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
      >
        新規追加
      </NuxtLink>
    </AdminDetailHeader>

    <!-- ステータスフィルタ（左）+ あいまい検索（右） -->
    <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <ul class="text-sm flex items-center">
        <li v-for="(tab, i) in tabs" :key="tab.v" class="flex items-center">
          <button
            class="hover:underline"
            :class="status === tab.v
              ? 'text-slate-900 font-semibold'
              : 'text-blue-700 hover:text-blue-900'"
            @click="status = tab.v"
          >
            {{ tab.label }}
            <span :class="status === tab.v ? 'text-slate-500' : 'text-slate-400'">
              ({{ counts[tab.v] }})
            </span>
          </button>
          <span v-if="i < tabs.length - 1" class="text-slate-300 mx-2">|</span>
        </li>
      </ul>

      <div class="admin-table-search relative">
        <UIcon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
        <input
          v-model="keyword"
          type="search"
          placeholder="店舗名・スラッグ・地域で検索"
          class="w-64 max-w-full pl-8 pr-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
      </div>
    </div>

    <!-- エラー -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`一覧の取得に失敗しました: ${error.message}`"
      class="mb-3"
    />

    <!-- 店舗テーブル -->
    <div class="admin-table-wrap bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table
        class="admin-table w-full text-sm
          [&_th]:[border-right:1px_dotted_#c3c4c7] [&_td]:[border-right:1px_dotted_#c3c4c7]
          [&_th:last-child]:[border-right:none] [&_td:last-child]:[border-right:none]"
      >
        <thead class="admin-table-head bg-[#f6f7f7] text-slate-900">
          <tr class="admin-table-head-row">
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              店舗名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              スラッグ
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              <button type="button" class="inline-flex items-center gap-1 hover:text-orange-700" @click="toggleSort('prefecture')">
                都道府県
                <UIcon
                  :name="sortKey === 'prefecture' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                  class="size-3.5"
                  :class="sortKey === 'prefecture' ? 'text-orange-600' : 'text-slate-400'"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              <button type="button" class="inline-flex items-center gap-1 hover:text-orange-700" @click="toggleSort('city')">
                市区町村
                <UIcon
                  :name="sortKey === 'city' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                  class="size-3.5"
                  :class="sortKey === 'city' ? 'text-orange-600' : 'text-slate-400'"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              電話番号
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              メールアドレス
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              <button type="button" class="inline-flex items-center gap-1 hover:text-orange-700" @click="toggleSort('displayOrder')">
                表示順
                <UIcon
                  :name="sortKey === 'displayOrder' ? (sortDir === 'asc' ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down') : 'i-lucide-chevrons-up-down'"
                  class="size-3.5"
                  :class="sortKey === 'displayOrder' ? 'text-orange-600' : 'text-slate-400'"
                />
              </button>
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              状態
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              作成日
            </th>
          </tr>
        </thead>
        <tbody class="admin-table-body">
          <tr v-if="sorted.length === 0" class="admin-table-empty">
            <td colspan="9" class="px-3 py-6 text-center text-slate-500">
              {{ keyword.trim() ? '検索条件に一致する店舗はありません。' : '該当する店舗はありません。' }}
            </td>
          </tr>
          <tr
            v-for="s in sorted"
            :key="s.id"
            class="admin-table-row group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <NuxtLink
                :to="`/dashboard/stores/${s.id}`"
                class="font-semibold text-blue-700 hover:text-blue-900 hover:underline"
              >
                {{ s.name }}
              </NuxtLink>
              <!-- WP 風のホバー時行アクション -->
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <NuxtLink
                  :to="`/dashboard/stores/${s.id}`"
                  class="text-blue-700 hover:text-blue-900 hover:underline"
                >
                  編集
                </NuxtLink>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  v-if="s.isActive"
                  :disabled="busy === s.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="softDelete(s.id, s.name)"
                >
                  無効化
                </button>
                <button
                  v-else
                  :disabled="busy === s.id"
                  class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
                  @click="activate(s.id)"
                >
                  有効化
                </button>
                <!-- 完全削除（物理削除）は無効化済みの店舗のみ -->
                <template v-if="!s.isActive">
                  <span class="text-slate-300 mx-1.5">|</span>
                  <button
                    class="text-red-700 hover:text-red-900 hover:underline"
                    @click="openPurge(s)"
                  >
                    完全削除
                  </button>
                </template>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top">
              <code class="text-xs bg-[#f0f0f1] px-1.5 py-0.5 rounded-sm">{{ s.slug }}</code>
            </td>
            <td class="px-3 py-2.5 align-top">
              {{ s.prefecture }}
            </td>
            <td class="px-3 py-2.5 align-top">
              {{ s.city }}
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700 tabular-nums whitespace-nowrap">
              {{ s.phone || '—' }}
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700 break-all">
              {{ s.email || '—' }}
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              {{ s.displayOrder }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="s.isActive"
                class="inline-flex items-center gap-1 text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm"
              >
                有効
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
              >
                無効
              </span>
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700">
              {{ dateFmt.format(new Date(s.createdAt)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 完全削除（物理削除）確認モーダル -->
    <div
      v-if="purgeTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closePurge"
    >
      <div class="bg-white rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-red-700">
            店舗を完全削除
          </h2>
          <p class="text-sm text-slate-600 mt-0.5">
            「{{ purgeTarget.name }}」を物理削除します。<span class="font-semibold text-red-700">この操作は元に戻せません。</span>
          </p>
        </div>

        <div class="px-5 py-4 space-y-4">
          <p v-if="purgeLoading" class="text-sm text-slate-500">
            影響範囲を確認中...
          </p>

          <template v-else-if="purgePreview">
            <!-- 削除できない理由 -->
            <div
              v-if="!purgePreview.canPurge"
              class="rounded-sm bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800"
            >
              <ul class="list-disc list-inside space-y-1">
                <li v-for="(r, i) in purgePreview.reasons" :key="i">
                  {{ r }}
                </li>
              </ul>
            </div>

            <!-- 影響範囲（一緒に消えるデータ） -->
            <div>
              <p class="text-sm font-semibold text-slate-700 mb-1.5">
                以下のデータも一緒に削除されます:
              </p>
              <ul class="text-sm text-slate-700 grid grid-cols-2 gap-x-4 gap-y-0.5">
                <li v-for="c in purgeCountLabels" :key="c.key" class="flex justify-between">
                  <span>{{ c.label }}</span>
                  <span
                    class="tabular-nums"
                    :class="purgePreview.counts[c.key] > 0 ? 'font-semibold text-slate-900' : 'text-slate-400'"
                  >
                    {{ purgePreview.counts[c.key] }}
                  </span>
                </li>
              </ul>
            </div>

            <!-- 店舗名タイプ確認 -->
            <div v-if="purgePreview.canPurge">
              <label class="block text-sm text-slate-700 mb-1">
                確認のため店舗名「<span class="font-semibold">{{ purgeTarget.name }}</span>」を入力してください
              </label>
              <input
                v-model="purgeConfirmName"
                type="text"
                :placeholder="purgeTarget.name"
                class="w-full border border-slate-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                @keyup.enter="confirmPurge"
              >
            </div>
          </template>

          <!-- エラー -->
          <div
            v-if="purgeError"
            class="rounded-sm bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700"
          >
            {{ purgeError }}
          </div>
        </div>

        <div class="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            :disabled="purgeBusy"
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            @click="closePurge"
          >
            キャンセル
          </button>
          <button
            type="button"
            :disabled="!canSubmitPurge"
            class="px-3 py-1.5 text-sm rounded-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
            @click="confirmPurge"
          >
            {{ purgeBusy ? '削除中...' : '完全に削除する' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
