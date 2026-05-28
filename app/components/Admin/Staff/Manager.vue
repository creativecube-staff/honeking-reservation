<script setup lang="ts">
import { createStaffSchema } from '~~/shared/schemas/staff'
import { ROLES, ROLE_LABEL, type RoleName } from '~~/shared/permissions'

// 店舗モードのスタッフ管理を 1 コンポーネントに集約（メニュー管理の AdminMenuManager と同方針）。
// 一覧・あいまい検索・ステータスタブ・編集モーダル・有効/無効・完全削除モーダルを内包する。
// storeId を必ず受け取る（店舗モード専用）。
//
// 設計上の注意:
//   Staff（店舗で働く人）と Login（管理画面のログインアカウント）は別テーブルで完全独立。
//   この管理画面では Staff のみを扱う。ログイン情報は全店モードの「ログイン管理」(/dashboard/accounts) で別途。
const props = defineProps<{
  storeId: number
}>()

type StaffRow = {
  id: number
  storeId: number
  name: string
  gender: 'MALE' | 'FEMALE' | null
  role: RoleName | null
  baseShiftDays: number[]
  displayOrder: number
  assignOrder: number
  isActive: boolean
  isAssignable: boolean
  createdAt: string
  updatedAt: string
}

const apiBase = '/api/admin/staff'

const { data: staffList, refresh, error } = await useFetch<StaffRow[]>(
  apiBase,
  {
    query: computed(() => ({ status: 'all', storeId: props.storeId })),
    watch: [() => props.storeId],
    default: () => [] as StaffRow[],
  },
)

// ── ステータスタブ + あいまい検索 ───────────────────────
type Status = 'all' | 'active' | 'inactive'
const status = ref<Status>('all')
const tabs: { v: Status, label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'active', label: '有効' },
  { v: 'inactive', label: '無効' },
]

const keyword = ref('')
function matchesKeyword(s: StaffRow): boolean {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return true
  return kw.split(/\s+/).every(term => s.name.toLowerCase().includes(term))
}
const searched = computed(() => (staffList.value ?? []).filter(matchesKeyword))

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

// ── 表示用ヘルパ ──────────────────────────────────────
const dateFmt = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] // 月→日の並び
function shiftBadges(days: number[]): { label: string, on: boolean, weekend: boolean }[] {
  return DAY_ORDER.map(d => ({
    label: DAY_LABELS[d]!,
    on: days.includes(d),
    weekend: d === 0 || d === 6,
  }))
}
function genderLabel(g: 'MALE' | 'FEMALE' | null): string {
  if (g === 'MALE') return '男性'
  if (g === 'FEMALE') return '女性'
  return '—'
}

// 役職セレクト（OWNER は全店モードの「ログイン管理」専用なので除外）
const SELECTABLE_ROLES = ROLES.filter(r => r !== 'OWNER')

// ── 編集モーダル ──────────────────────────────────────
type EditorMode = 'create' | 'edit'
const editorOpen = ref(false)
const editorMode = ref<EditorMode>('create')
const editingStaff = ref<StaffRow | null>(null)

type FormState = {
  name: string
  gender: 'MALE' | 'FEMALE' | null
  role: RoleName | null
  displayOrder: number
  assignOrder: number
  baseShiftDays: number[]
}
const state = reactive<FormState>({
  name: '',
  gender: null,
  role: null,
  displayOrder: 0,
  assignOrder: 0,
  baseShiftDays: [1, 2, 3, 4, 5],
})
const fieldErrors = ref<Record<string, string>>({})
const formError = ref<string | null>(null)
const submitting = ref(false)

function resetForm() {
  state.name = ''
  state.gender = null
  state.role = null
  state.displayOrder = 0
  state.assignOrder = 0
  state.baseShiftDays = [1, 2, 3, 4, 5]
  fieldErrors.value = {}
  formError.value = null
}

function openCreate() {
  editorMode.value = 'create'
  editingStaff.value = null
  resetForm()
  // 新規時の displayOrder / assignOrder は既存最大 + 1
  const list = staffList.value ?? []
  state.displayOrder = list.reduce((acc, s) => Math.max(acc, s.displayOrder), -1) + 1
  state.assignOrder = list.reduce((acc, s) => Math.max(acc, s.assignOrder), -1) + 1
  editorOpen.value = true
}

function openEdit(s: StaffRow) {
  editorMode.value = 'edit'
  editingStaff.value = s
  state.name = s.name
  state.gender = s.gender
  state.role = s.role
  state.displayOrder = s.displayOrder
  state.assignOrder = s.assignOrder
  state.baseShiftDays = [...s.baseShiftDays]
  fieldErrors.value = {}
  formError.value = null
  editorOpen.value = true
}

async function onSave() {
  fieldErrors.value = {}
  formError.value = null

  if (editorMode.value === 'create') {
    const payload = {
      storeId: props.storeId,
      name: state.name,
      gender: state.gender ?? undefined,
      role: state.role ?? undefined,
      displayOrder: state.displayOrder,
      assignOrder: state.assignOrder,
      baseShiftDays: state.baseShiftDays,
      isActive: true,
      isAssignable: true,
    }
    const parsed = createStaffSchema.safeParse(payload)
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
      await $fetch(apiBase, { method: 'POST', body: parsed.data })
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
  else if (editingStaff.value) {
    submitting.value = true
    try {
      await $fetch(`${apiBase}/${editingStaff.value.id}`, {
        method: 'PATCH',
        body: {
          name: state.name,
          gender: state.gender,
          role: state.role,
          displayOrder: state.displayOrder,
          assignOrder: state.assignOrder,
          baseShiftDays: state.baseShiftDays,
        },
      })
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
}

// ── 行アクション（無効化・有効化） ───────────────────────
const busy = ref<number | null>(null)

async function onDeactivate(s: StaffRow) {
  if (!confirm(`スタッフ「${s.name}」を無効化しますか？`)) return
  busy.value = s.id
  try {
    await $fetch(`${apiBase}/${s.id}`, { method: 'DELETE' })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

async function onActivate(s: StaffRow) {
  busy.value = s.id
  try {
    await $fetch(`${apiBase}/${s.id}`, { method: 'PATCH', body: { isActive: true } })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

// ── 完全削除（物理削除）モーダル ───────────────────────
interface PurgePreview {
  staff: { id: number, storeId: number, name: string, isActive: boolean }
  counts: { reservations: number }
  canPurge: boolean
  reasons: string[]
}

const purgeTarget = ref<StaffRow | null>(null)
const purgePreview = ref<PurgePreview | null>(null)
const purgeConfirmName = ref('')
const purgeLoading = ref(false)
const purgeBusy = ref(false)
const purgeError = ref('')

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const err = e as { statusMessage?: string, message?: string, data?: { statusMessage?: string, message?: string } }
    return err.data?.statusMessage ?? err.statusMessage ?? err.data?.message ?? err.message ?? fallback
  }
  return fallback
}

async function openPurge(s: StaffRow) {
  purgeTarget.value = s
  purgePreview.value = null
  purgeConfirmName.value = ''
  purgeError.value = ''
  purgeLoading.value = true
  try {
    purgePreview.value = await $fetch<PurgePreview>(`${apiBase}/${s.id}/purge-preview`)
  }
  catch (e) {
    purgeError.value = errMessage(e, '影響範囲の取得に失敗しました')
  }
  finally {
    purgeLoading.value = false
  }
}

function closePurge() {
  if (purgeBusy.value) return
  purgeTarget.value = null
  purgePreview.value = null
  purgeConfirmName.value = ''
  purgeError.value = ''
}

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
    await $fetch(`${apiBase}/${purgeTarget.value.id}/purge`, {
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

// ── 基本シフトのチップ（編集モーダル用） ─────────────────
const FORM_DAYS: { value: number, label: string, weekend: boolean }[] = [
  { value: 1, label: '月', weekend: false },
  { value: 2, label: '火', weekend: false },
  { value: 3, label: '水', weekend: false },
  { value: 4, label: '木', weekend: false },
  { value: 5, label: '金', weekend: false },
  { value: 6, label: '土', weekend: true },
  { value: 0, label: '日', weekend: true },
]

const baseInput = 'w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]'
const errInput = 'border-red-600 focus:border-red-600 focus:shadow-[0_0_0_1px_#dc2626]'
</script>

<template>
  <div class="admin-staff-manager">
    <!-- ツールバー: ステータスタブ（左）+ 検索・追加（右） -->
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

      <div class="flex items-center gap-2">
        <div class="admin-table-search relative">
          <UIcon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            v-model="keyword"
            type="search"
            placeholder="スタッフ名で検索"
            class="w-56 max-w-full pl-8 pr-2.5 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
          >
        </div>
        <button
          type="button"
          class="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-sm shadow-sm whitespace-nowrap"
          @click="openCreate"
        >
          ＋ スタッフを追加
        </button>
      </div>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`一覧の取得に失敗しました: ${error.message}`"
      class="mb-3"
    />

    <!-- スタッフテーブル -->
    <div class="admin-table-wrap bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table
        class="admin-table w-full text-sm
          [&_th]:[border-right:1px_dotted_#c3c4c7] [&_td]:[border-right:1px_dotted_#c3c4c7]
          [&_th:last-child]:[border-right:none] [&_td:last-child]:[border-right:none]"
      >
        <thead class="admin-table-head bg-[#f6f7f7] text-slate-900">
          <tr class="admin-table-head-row">
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap w-56">
              スタッフ名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              性別
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              役職
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              表示順
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              振り分け順
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              基本シフト
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              状態
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              作成日
            </th>
          </tr>
        </thead>
        <tbody class="admin-table-body">
          <tr v-if="filtered.length === 0" class="admin-table-empty">
            <td colspan="8" class="px-3 py-6 text-center text-slate-500">
              {{ keyword.trim()
                ? '検索条件に一致するスタッフはいません。'
                : 'スタッフがいません。「＋ スタッフを追加」から登録してください。' }}
            </td>
          </tr>
          <tr
            v-for="s in filtered"
            :key="s.id"
            class="admin-table-row group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <div class="font-semibold text-slate-900">
                {{ s.name }}
              </div>
              <!-- ホバー時の行アクション -->
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  :disabled="busy === s.id"
                  class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
                  @click="openEdit(s)"
                >
                  編集
                </button>
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  v-if="s.isActive"
                  type="button"
                  :disabled="busy === s.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="onDeactivate(s)"
                >
                  無効化
                </button>
                <button
                  v-else
                  type="button"
                  :disabled="busy === s.id"
                  class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
                  @click="onActivate(s)"
                >
                  有効化
                </button>
                <template v-if="!s.isActive">
                  <span class="text-slate-300 mx-1.5">|</span>
                  <button
                    type="button"
                    class="text-red-700 hover:text-red-900 hover:underline"
                    @click="openPurge(s)"
                  >
                    完全削除
                  </button>
                </template>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700">
              {{ genderLabel(s.gender) }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="s.role"
                class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
              >
                {{ ROLE_LABEL[s.role] }}
              </span>
              <span v-else class="text-xs text-slate-400">—</span>
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">
              {{ s.displayOrder }}
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums text-slate-700">
              {{ s.assignOrder }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <div class="flex flex-wrap items-center gap-1">
                <span
                  v-for="(b, i) in shiftBadges(s.baseShiftDays)"
                  :key="i"
                  class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                  :class="b.on
                    ? 'bg-orange-500 text-white'
                    : (b.weekend ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-400')"
                >
                  {{ b.label }}
                </span>
              </div>
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

    <!-- 編集モーダル -->
    <UModal v-model:open="editorOpen">
      <template #content>
        <div class="bg-white p-5">
          <h2 class="text-lg font-semibold text-slate-900 mb-4">
            スタッフを{{ editorMode === 'create' ? '追加' : '編集' }}
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
                スタッフ名 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="state.name"
                type="text"
                placeholder="例: 田中 健太"
                :class="[baseInput, fieldErrors.name && errInput]"
              >
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-700">
                {{ fieldErrors.name }}
              </p>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                性別
              </label>
              <div class="flex items-center gap-3 text-sm text-slate-900">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input v-model="state.gender" type="radio" :value="'MALE'" class="h-4 w-4 text-orange-500 focus:ring-orange-500">
                  男性
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input v-model="state.gender" type="radio" :value="'FEMALE'" class="h-4 w-4 text-orange-500 focus:ring-orange-500">
                  女性
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <input v-model="state.gender" type="radio" :value="null" class="h-4 w-4 text-slate-400 focus:ring-slate-400">
                  <span class="text-slate-500">未設定</span>
                </label>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                役職
              </label>
              <select
                v-model="state.role"
                :class="[baseInput, fieldErrors.role && errInput]"
              >
                <option :value="null">
                  -- 未設定 --
                </option>
                <option v-for="r in SELECTABLE_ROLES" :key="r" :value="r">
                  {{ ROLE_LABEL[r] }}
                </option>
              </select>
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
                  max="9999"
                  :class="[baseInput, fieldErrors.displayOrder && errInput]"
                >
                <p v-if="fieldErrors.displayOrder" class="mt-1 text-xs text-red-700">
                  {{ fieldErrors.displayOrder }}
                </p>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                  振り分け順
                </label>
                <input
                  v-model.number="state.assignOrder"
                  type="number"
                  min="0"
                  max="9999"
                  :class="[baseInput, fieldErrors.assignOrder && errInput]"
                >
                <p v-if="fieldErrors.assignOrder" class="mt-1 text-xs text-red-700">
                  {{ fieldErrors.assignOrder }}
                </p>
              </div>
            </div>

            <div>
              <label class="block text-sm font-semibold text-slate-900 mb-1.5">
                基本シフト（出勤する曜日）
              </label>
              <div class="flex flex-wrap items-center gap-2">
                <label
                  v-for="d in FORM_DAYS"
                  :key="d.value"
                  class="cursor-pointer select-none"
                >
                  <input
                    v-model="state.baseShiftDays"
                    type="checkbox"
                    :value="d.value"
                    class="peer sr-only"
                  >
                  <span
                    class="inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold transition-colors"
                    :class="state.baseShiftDays.includes(d.value)
                      ? 'border-orange-500 bg-orange-500 text-white shadow-sm'
                      : (d.weekend
                        ? 'border-slate-300 bg-white text-slate-400 hover:bg-slate-50'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50')"
                  >
                    {{ d.label }}
                  </span>
                </label>
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

    <!-- 完全削除（物理削除）確認モーダル。メニュー管理と同じスタイル -->
    <div
      v-if="purgeTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      @click.self="closePurge"
    >
      <div class="bg-white rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-red-700">
            スタッフを完全削除
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

            <div v-if="purgePreview.canPurge">
              <p class="text-xs text-slate-600 mb-2">
                このスタッフを参照する予約はありません。物理削除で影響するデータはありません。
              </p>
              <label class="block text-sm text-slate-700 mb-1">
                確認のためスタッフ名「<span class="font-semibold">{{ purgeTarget.name }}</span>」を入力してください
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
