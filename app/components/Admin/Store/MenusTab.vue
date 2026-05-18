<script setup lang="ts">
import type { Menu } from '@prisma/client'
import { menuBaseSchema, type MenuFormState } from '~~/shared/schemas/menu'

const props = defineProps<{
  storeId: number
}>()

const { data: menus, refresh, error } = await useFetch<Menu[]>(`/api/admin/stores/${props.storeId}/menus`, {
  watch: false,
})

const counts = computed(() => {
  const list = menus.value ?? []
  return {
    all: list.length,
    active: list.filter(m => m.isActive).length,
    inactive: list.filter(m => !m.isActive).length,
  }
})

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const periodFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
})
const priceFmt = new Intl.NumberFormat('ja-JP')

function formatPeriod(from: Date | string | null | undefined, until: Date | string | null | undefined): string | null {
  if (!from && !until) return null
  const f = from ? periodFmt.format(new Date(from)) : '常時'
  const u = until ? periodFmt.format(new Date(until)) : '常時'
  return `${f} 〜 ${u}`
}

// ── モーダル管理 ───────────────────────────────────────
type EditorMode = 'create' | 'edit'
const editorOpen = ref(false)
const editorMode = ref<EditorMode>('create')
const editingId = ref<number | null>(null)
const state = reactive<MenuFormState>({
  name: '',
  description: '',
  durationMinutes: 30,
  priceJpy: 4000,
  displayOrder: 0,
  isActive: true,
  availableFrom: '',
  availableUntil: '',
})
const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

function toIsoDate(d: Date | string | null | undefined): string {
  if (!d) return ''
  return new Date(d).toISOString().slice(0, 10)
}

function resetForm() {
  state.name = ''
  state.description = ''
  state.durationMinutes = 30
  state.priceJpy = 4000
  state.displayOrder = 0
  state.isActive = true
  state.availableFrom = ''
  state.availableUntil = ''
  fieldErrors.value = {}
  formError.value = null
}

function openCreate() {
  editorMode.value = 'create'
  editingId.value = null
  resetForm()
  // 新規時の displayOrder は既存最大 + 1
  state.displayOrder = (menus.value ?? []).reduce((acc, m) => Math.max(acc, m.displayOrder), -1) + 1
  editorOpen.value = true
}

function openEdit(menu: Menu) {
  editorMode.value = 'edit'
  editingId.value = menu.id
  state.name = menu.name
  state.description = menu.description ?? ''
  state.durationMinutes = menu.durationMinutes
  state.priceJpy = menu.priceJpy
  state.displayOrder = menu.displayOrder
  state.isActive = menu.isActive
  state.availableFrom = toIsoDate(menu.availableFrom)
  state.availableUntil = toIsoDate(menu.availableUntil)
  fieldErrors.value = {}
  formError.value = null
  editorOpen.value = true
}

async function onSave() {
  fieldErrors.value = {}
  formError.value = null

  // 空文字の availableFrom/availableUntil/description は null として送る
  const payload = {
    ...state,
    description: state.description?.trim() || null,
    availableFrom: state.availableFrom || null,
    availableUntil: state.availableUntil || null,
  }

  const parsed = menuBaseSchema.safeParse(payload)
  if (!parsed.success) {
    const errors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (!errors[key]) errors[key] = issue.message
    }
    fieldErrors.value = errors
    formError.value = '入力内容を確認してください'
    return
  }

  submitting.value = true
  try {
    if (editorMode.value === 'create') {
      await $fetch(`/api/admin/stores/${props.storeId}/menus`, {
        method: 'POST',
        body: parsed.data,
      })
    }
    else if (editingId.value !== null) {
      await $fetch(`/api/admin/stores/${props.storeId}/menus/${editingId.value}`, {
        method: 'PATCH',
        body: parsed.data,
      })
    }
    editorOpen.value = false
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '保存に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// ── 行アクション ────────────────────────────────────────
const busy = ref<number | null>(null)

async function onDeactivate(menu: Menu) {
  if (!confirm(`メニュー「${menu.name}」を無効化しますか？`)) return
  busy.value = menu.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/menus/${menu.id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

async function onActivate(menu: Menu) {
  busy.value = menu.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/menus/${menu.id}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <div class="space-y-4">
    <!-- 説明 -->
    <div class="bg-blue-50 border border-blue-200 rounded-sm p-3 text-sm text-slate-700">
      <p>このタブでは <strong>この店舗だけの特別メニュー</strong> を管理します。</p>
      <p class="text-xs text-slate-600 mt-1">
        全店舗で利用できる共通メニューは
        <NuxtLink to="/dashboard/menus" class="text-blue-700 hover:text-blue-900 hover:underline">
          メニュー管理
        </NuxtLink>
        から登録してください。
      </p>
    </div>

    <!-- ヘッダー -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-slate-700">
        特別メニュー 合計: <strong>{{ counts.all }}</strong> 件 ／
        有効: <strong>{{ counts.active }}</strong> 件 ／
        無効: <strong>{{ counts.inactive }}</strong> 件
      </div>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-sm shadow-sm"
        @click="openCreate"
      >
        + 特別メニューを追加
      </button>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`メニュー一覧の取得に失敗しました: ${error.message}`"
    />

    <!-- WP 風テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              メニュー名
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              所要時間
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              価格
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              表示順
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              表示期間
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
          <tr v-if="(menus ?? []).length === 0">
            <td colspan="7" class="px-3 py-6 text-center text-slate-500">
              まだメニューが登録されていません。右上の「+ メニューを追加」から追加してください。
            </td>
          </tr>
          <tr
            v-for="m in menus"
            :key="m.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <div class="font-semibold text-slate-900">
                {{ m.name }}
              </div>
              <div
                v-if="m.description"
                class="text-xs text-slate-600 mt-0.5 line-clamp-2 whitespace-pre-line"
              >
                {{ m.description }}
              </div>
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  :disabled="busy === m.id"
                  class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
                  @click="openEdit(m)"
                >
                  編集
                </button>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  v-if="m.isActive"
                  type="button"
                  :disabled="busy === m.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="onDeactivate(m)"
                >
                  無効化
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="busy === m.id"
                  class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
                  @click="onActivate(m)"
                >
                  復活
                </button>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              {{ m.durationMinutes }} 分
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              ¥{{ priceFmt.format(m.priceJpy) }}
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              {{ m.displayOrder }}
            </td>
            <td class="px-3 py-2.5 align-top text-xs tabular-nums">
              <span
                v-if="formatPeriod(m.availableFrom, m.availableUntil)"
                class="inline-flex items-center text-purple-800 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-sm"
              >
                {{ formatPeriod(m.availableFrom, m.availableUntil) }}
              </span>
              <span v-else class="text-slate-400">常時</span>
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="m.isActive"
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
              {{ dateFmt.format(new Date(m.createdAt)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 編集モーダル -->
    <UModal v-model:open="editorOpen">
      <template #content>
        <div class="bg-white p-5">
          <h2 class="text-lg font-semibold text-slate-900 mb-4">
            {{ editorMode === 'create' ? 'メニューを追加' : 'メニューを編集' }}
          </h2>

          <UAlert
            v-if="formError"
            color="error"
            icon="i-lucide-triangle-alert"
            :title="formError"
            class="mb-3"
          />

          <form class="space-y-4" @submit.prevent="onSave">
            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                メニュー名 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="state.name"
                type="text"
                placeholder="例: 全身整体 30 分"
                :class="[baseInput, fieldErrors.name && errInput]"
              >
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.name }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                施術の説明（任意）
              </label>
              <textarea
                v-model="state.description"
                rows="3"
                placeholder="例: 全身の筋肉のコリをほぐし、骨格バランスを整える施術です。"
                :class="[baseInput, fieldErrors.description && errInput]"
              />
              <p v-if="fieldErrors.description" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.description }}
              </p>
              <p v-else class="mt-1 text-xs text-slate-500">
                お客様の予約画面でメニューを選ぶときに表示されます。
              </p>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                  所要時間（分） <span class="text-red-600">*</span>
                </label>
                <input
                  v-model.number="state.durationMinutes"
                  type="number"
                  min="5"
                  max="600"
                  step="5"
                  :class="[baseInput, fieldErrors.durationMinutes && errInput]"
                >
                <p v-if="fieldErrors.durationMinutes" class="mt-1 text-xs text-red-700">
                  {{ fieldErrors.durationMinutes }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                  価格（円） <span class="text-red-600">*</span>
                </label>
                <input
                  v-model.number="state.priceJpy"
                  type="number"
                  min="0"
                  step="100"
                  :class="[baseInput, fieldErrors.priceJpy && errInput]"
                >
                <p v-if="fieldErrors.priceJpy" class="mt-1 text-xs text-red-700">
                  {{ fieldErrors.priceJpy }}
                </p>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                  表示順
                </label>
                <input
                  v-model.number="state.displayOrder"
                  type="number"
                  min="0"
                  :class="[baseInput, fieldErrors.displayOrder && errInput]"
                >
                <p v-if="fieldErrors.displayOrder" class="mt-1 text-xs text-red-700">
                  {{ fieldErrors.displayOrder }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                  状態
                </label>
                <label class="inline-flex items-center gap-2 text-sm text-slate-900 mt-2 select-none">
                  <input
                    v-model="state.isActive"
                    type="checkbox"
                    class="h-4 w-4 border-[#8c8f94] rounded-sm text-orange-500 focus:ring-orange-500"
                  >
                  有効にする
                </label>
              </div>
            </div>

            <!-- 表示期間（任意） -->
            <div class="border-t border-[#dcdcde] pt-3">
              <label class="block text-sm font-semibold text-slate-900 mb-1">
                表示期間（任意）
              </label>
              <p class="text-xs text-slate-600 mb-2">
                予約対象日が下記期間内のときのみお客様側に表示します。両方空 = 常時表示。<br>
                例: オープン記念キャンペーンメニュー
              </p>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    開始日
                  </label>
                  <input
                    v-model="state.availableFrom"
                    type="date"
                    :class="[baseInput, fieldErrors.availableFrom && errInput]"
                  >
                  <p v-if="fieldErrors.availableFrom" class="mt-1 text-xs text-red-700">
                    {{ fieldErrors.availableFrom }}
                  </p>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    終了日
                  </label>
                  <input
                    v-model="state.availableUntil"
                    type="date"
                    :class="[baseInput, fieldErrors.availableUntil && errInput]"
                  >
                  <p v-if="fieldErrors.availableUntil" class="mt-1 text-xs text-red-700">
                    {{ fieldErrors.availableUntil }}
                  </p>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-[#dcdcde]">
              <button
                type="submit"
                :disabled="submitting"
                class="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
              >
                {{ submitting ? '保存中...' : (editorMode === 'create' ? '追加' : '更新') }}
              </button>
              <button
                type="button"
                :disabled="submitting"
                class="px-4 py-2 border border-[#8c8f94] bg-white hover:bg-[#f6f7f7] text-slate-700 text-sm rounded-sm"
                @click="editorOpen = false"
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
