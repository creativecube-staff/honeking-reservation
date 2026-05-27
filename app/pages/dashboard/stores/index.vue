<script setup lang="ts">
import type { Store } from '@prisma/client'

// WordPress 風の店舗一覧画面（wp-list-table 模倣）
definePageMeta({ layout: 'admin' })

// 店舗スイッチャーのコンテキスト。
// 管理者(全店)モード = 店舗一覧 + 新規登録 / 店舗モード = 自店の店休日のみ。
const { selectedStoreId, canAccessAll, selectedStoreName } = useStoreContext()
const isAdminView = computed(() => canAccessAll.value && selectedStoreId.value === null)

type Status = 'all' | 'active' | 'inactive'
const status = ref<Status>('all')

const { data: stores, refresh, error } = await useFetch<Store[]>('/api/admin/stores', {
  query: { status: 'all' },
})

const counts = computed(() => {
  const list = stores.value ?? []
  return {
    all: list.length,
    active: list.filter(s => s.isActive).length,
    inactive: list.filter(s => !s.isActive).length,
  }
})

const filtered = computed(() => {
  const list = stores.value ?? []
  if (status.value === 'active') return list.filter(s => s.isActive)
  if (status.value === 'inactive') return list.filter(s => !s.isActive)
  return list
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
  shifts: number
  menus: number
  products: number
  businessHours: number
  holidays: number
  closures: number
  beds: number
  practitioners: number
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
  { key: 'shifts', label: 'シフト' },
  { key: 'menus', label: '店舗特別メニュー' },
  { key: 'products', label: '店舗特別商品' },
  { key: 'businessHours', label: '営業時間' },
  { key: 'holidays', label: '店休日' },
  { key: 'closures', label: '部分閉店' },
  { key: 'beds', label: 'ベッド' },
  { key: 'practitioners', label: 'スタッフ' },
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
    <!-- 店舗モード: 自店の店休日のみ（基本情報・ベッド・営業時間は管理者モード専用） -->
    <div v-if="!isAdminView">
      <h1 class="text-2xl font-semibold text-slate-900 mb-1">
        店休日
      </h1>
      <p class="text-sm text-slate-600 mb-4">
        {{ selectedStoreName }} の休業日（終日休み）を登録します。
      </p>
      <AdminScheduleHolidaysPanel v-if="selectedStoreId" :store-id="selectedStoreId" />
    </div>

    <!-- 管理者(全店)モード: 店舗一覧 -->
    <template v-else>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        店舗管理
      </h1>
      <NuxtLink
        to="/dashboard/stores/new"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
      >
        新規追加
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      店舗の追加・編集・無効化を行います。
    </p>

    <!-- WP 風ステータスフィルタ（subsubsub） -->
    <ul class="text-sm mb-3 flex items-center">
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

    <!-- エラー -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`一覧の取得に失敗しました: ${error.message}`"
      class="mb-3"
    />

    <!-- WP 風テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              店舗名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              スラッグ
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              都道府県
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              市区町村
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              表示順
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              状態
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              作成日
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filtered.length === 0">
            <td colspan="7" class="px-3 py-6 text-center text-slate-500">
              該当する店舗はありません。
            </td>
          </tr>
          <tr
            v-for="s in filtered"
            :key="s.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
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
                  復活
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
    </template>
  </div>
</template>
