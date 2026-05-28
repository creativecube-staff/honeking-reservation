<script setup lang="ts">
import { ROLE_LABEL, type RoleName } from '~~/shared/permissions'

// 管理者(全店)モード専用「ログイン管理」。
// ログイン可能アカウントの一覧 + パスワード再発行 + オーナー追加 + ログイン履歴。
// API はすべて OWNER のみ（非 OWNER がURL直打ちした場合は 403 → 注意文を表示）。
definePageMeta({ layout: 'admin' })

type Account = {
  id: number
  name: string
  username: string | null
  role: RoleName | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  store: { id: number, name: string } | null
  hasPassword: boolean
}
type LoginEvent = {
  id: number
  usernameAttempted: string
  success: boolean
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  practitioner: { id: number, name: string } | null
}

const { data: accounts, refresh: refreshAccounts, error: accountsError } = await useFetch<Account[]>('/api/admin/accounts')

// ログイン未発行の店舗を出すため、有効店舗一覧も取得する
const { data: stores } = await useFetch<{ id: number, name: string }[]>('/api/admin/stores', { query: { status: 'active' } })
const storesWithoutLogin = computed(() => {
  const accs = accounts.value ?? []
  // 店舗ログイン = role MANAGER のアカウント。これが無い店舗を「未発行」とみなす
  const hasStoreLogin = (storeId: number) => accs.some(a => a.role === 'MANAGER' && a.store?.id === storeId)
  return (stores.value ?? []).filter(s => !hasStoreLogin(s.id))
})

const successFilter = ref<'all' | 'true' | 'false'>('all')
const historyQuery = computed(() => (successFilter.value === 'all' ? {} : { success: successFilter.value }))
const { data: history } = await useFetch<LoginEvent[]>('/api/admin/login-history', {
  query: historyQuery,
  watch: [historyQuery],
})

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object') {
    const err = e as { statusMessage?: string, message?: string, data?: { statusMessage?: string, message?: string } }
    return err.data?.statusMessage ?? err.statusMessage ?? err.data?.message ?? err.message ?? fallback
  }
  return fallback
}

// ── 発行/再発行したログイン情報を 1 回だけ表示するモーダル ──
const credential = ref<{ title: string, username: string, password: string } | null>(null)
const copied = ref(false)
async function copyCredential() {
  if (!credential.value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(`ログインID: ${credential.value.username}\nパスワード: ${credential.value.password}`)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    // クリップボード権限がない環境では何もしない
  }
}
function closeCredential() {
  credential.value = null
  copied.value = false
}

// パスワードを確認（暗号化保存値を復号して取得 → モーダル表示。一覧には載せない）
const viewing = ref<number | null>(null)
async function viewPassword(a: Account) {
  viewing.value = a.id
  try {
    const res = await $fetch<{ username: string, password: string }>(`/api/admin/accounts/${a.id}/password`)
    credential.value = { title: `${a.name} のログイン情報`, username: res.username, password: res.password }
  }
  catch (e) {
    alert(errMessage(e, 'パスワードの取得に失敗しました'))
  }
  finally {
    viewing.value = null
  }
}

// ログイン未発行の店舗にログインを発行
const issuing = ref<number | null>(null)
async function issueStore(store: { id: number, name: string }) {
  issuing.value = store.id
  try {
    const res = await $fetch<{ username: string, password: string }>('/api/admin/accounts/issue-store', {
      method: 'POST',
      body: { storeId: store.id },
    })
    credential.value = { title: `${store.name} のログインを発行しました`, username: res.username, password: res.password }
    await refreshAccounts()
  }
  catch (e) {
    alert(errMessage(e, 'ログイン発行に失敗しました'))
  }
  finally {
    issuing.value = null
  }
}

// ── パスワード再発行 ──
const busy = ref<number | null>(null)
async function regenerate(a: Account) {
  if (!confirm(`「${a.name}」のパスワードを再発行しますか？\n（現在のパスワードは使えなくなります）`)) return
  busy.value = a.id
  try {
    const res = await $fetch<{ username: string, password: string }>(`/api/admin/accounts/${a.id}/regenerate-password`, { method: 'POST' })
    credential.value = { title: 'パスワードを再発行しました', username: res.username, password: res.password }
  }
  catch (e) {
    alert(errMessage(e, '再発行に失敗しました'))
  }
  finally {
    busy.value = null
  }
}

// ── オーナーアカウント追加 ──
const showCreate = ref(false)
const newName = ref('')
const newUsername = ref('')
const creating = ref(false)
const createError = ref('')
function openCreate() {
  newName.value = ''
  newUsername.value = ''
  createError.value = ''
  showCreate.value = true
}
async function submitCreate() {
  creating.value = true
  createError.value = ''
  try {
    const res = await $fetch<{ username: string, password: string }>('/api/admin/accounts', {
      method: 'POST',
      body: { name: newName.value, username: newUsername.value },
    })
    showCreate.value = false
    credential.value = { title: 'オーナーアカウントを作成しました', username: res.username, password: res.password }
    await refreshAccounts()
  }
  catch (e) {
    createError.value = errMessage(e, '作成に失敗しました')
  }
  finally {
    creating.value = false
  }
}

const dateTimeFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
})
function fmtDateTime(d: string | null): string {
  return d ? dateTimeFmt.format(new Date(d)) : '—'
}
function roleLabel(a: Account): string {
  return a.role ? ROLE_LABEL[a.role] : '—'
}
// OWNER は全店アクセスなので所属店舗ではなく「全店」と表示
function scopeLabel(a: Account): string {
  if (a.role === 'OWNER') return '全店'
  return a.store?.name ?? '—'
}
</script>

<template>
  <div>
    <AdminDetailHeader
      title="ログイン管理"
      description="管理画面にログインできるアカウントと、ログイン履歴を管理します。"
    />

    <UAlert
      v-if="accountsError"
      color="error"
      icon="i-lucide-triangle-alert"
      title="この画面はオーナーのみ利用できます。"
      class="mb-4"
    />

    <!-- アカウント一覧 -->
    <div class="flex items-center gap-3 mb-2">
      <h2 class="text-base font-semibold text-slate-900">
        ログインアカウント
      </h2>
      <button
        type="button"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
        @click="openCreate"
      >
        + オーナーを追加
      </button>
    </div>

    <div class="admin-table-wrap bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto mb-8">
      <table
        class="admin-table w-full text-sm
          [&_th]:[border-right:1px_dotted_#c3c4c7] [&_td]:[border-right:1px_dotted_#c3c4c7]
          [&_th:last-child]:[border-right:none] [&_td:last-child]:[border-right:none]"
      >
        <thead class="admin-table-head bg-[#f6f7f7] text-slate-900">
          <tr class="admin-table-head-row">
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              名前
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              ログイン ID
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              区分 / 範囲
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              最終ログイン
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              状態
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              操作
            </th>
          </tr>
        </thead>
        <tbody class="admin-table-body">
          <tr v-if="(accounts ?? []).length === 0" class="admin-table-empty">
            <td colspan="6" class="px-3 py-6 text-center text-slate-500">
              ログインできるアカウントがありません。
            </td>
          </tr>
          <tr
            v-for="a in accounts ?? []"
            :key="a.id"
            class="admin-table-row group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top font-semibold text-slate-900">
              {{ a.name }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <code class="text-xs bg-[#f0f0f1] px-1.5 py-0.5 rounded-sm">{{ a.username }}</code>
            </td>
            <td class="px-3 py-2.5 align-top">
              <span class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm">
                {{ roleLabel(a) }}
              </span>
              <span class="text-xs text-slate-500 ml-1.5">{{ scopeLabel(a) }}</span>
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700 tabular-nums">
              {{ fmtDateTime(a.lastLoginAt) }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="a.isActive"
                class="inline-flex items-center text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm"
              >
                有効
              </span>
              <span
                v-else
                class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm"
              >
                無効
              </span>
            </td>
            <td class="px-3 py-2.5 align-top text-right whitespace-nowrap">
              <button
                v-if="a.hasPassword"
                type="button"
                :disabled="viewing === a.id"
                class="text-sm text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
                @click="viewPassword(a)"
              >
                {{ viewing === a.id ? '取得中...' : 'パスワードを確認' }}
              </button>
              <span v-else class="text-xs text-slate-400">再発行で確認可</span>
              <span class="text-slate-300 mx-1.5">|</span>
              <button
                type="button"
                :disabled="busy === a.id"
                class="text-sm text-orange-700 hover:text-orange-900 hover:underline disabled:text-slate-400"
                @click="regenerate(a)"
              >
                {{ busy === a.id ? '発行中...' : 'パスワード再発行' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ログイン未発行の店舗（シードで作られた既存店舗など、ログインアカウントが無い店舗） -->
    <div v-if="storesWithoutLogin.length > 0" class="mb-8">
      <h2 class="text-base font-semibold text-slate-900 mb-2">
        ログイン未発行の店舗
      </h2>
      <div class="bg-white border border-amber-200 rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] divide-y divide-[#f0f0f1]">
        <div
          v-for="s in storesWithoutLogin"
          :key="s.id"
          class="flex items-center justify-between px-3 py-2.5"
        >
          <span class="text-sm text-slate-800">{{ s.name }}</span>
          <button
            type="button"
            :disabled="issuing === s.id"
            class="text-sm text-orange-700 hover:text-orange-900 hover:underline disabled:text-slate-400"
            @click="issueStore(s)"
          >
            {{ issuing === s.id ? '発行中...' : 'ログインを発行' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ログイン履歴 -->
    <div class="flex items-center gap-3 mb-2">
      <h2 class="text-base font-semibold text-slate-900">
        ログイン履歴
      </h2>
      <select
        v-model="successFilter"
        class="px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
      >
        <option value="all">
          すべて
        </option>
        <option value="true">
          成功のみ
        </option>
        <option value="false">
          失敗のみ
        </option>
      </select>
    </div>

    <div class="admin-table-wrap bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table
        class="admin-table w-full text-sm
          [&_th]:[border-right:1px_dotted_#c3c4c7] [&_td]:[border-right:1px_dotted_#c3c4c7]
          [&_th:last-child]:[border-right:none] [&_td:last-child]:[border-right:none]"
      >
        <thead class="admin-table-head bg-[#f6f7f7] text-slate-900">
          <tr class="admin-table-head-row">
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              日時
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              アカウント / 試行 ID
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              結果
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              IP
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7] whitespace-nowrap">
              端末 (User-Agent)
            </th>
          </tr>
        </thead>
        <tbody class="admin-table-body">
          <tr v-if="(history ?? []).length === 0" class="admin-table-empty">
            <td colspan="5" class="px-3 py-6 text-center text-slate-500">
              ログイン履歴はまだありません。
            </td>
          </tr>
          <tr
            v-for="h in history ?? []"
            :key="h.id"
            class="admin-table-row border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top text-slate-700 tabular-nums whitespace-nowrap">
              {{ fmtDateTime(h.createdAt) }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span v-if="h.practitioner" class="text-slate-900">{{ h.practitioner.name }}</span>
              <code class="text-xs bg-[#f0f0f1] px-1.5 py-0.5 rounded-sm ml-1">{{ h.usernameAttempted }}</code>
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="h.success"
                class="inline-flex items-center text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm"
              >
                成功
              </span>
              <span
                v-else
                class="inline-flex items-center text-xs text-red-800 bg-red-50 border border-red-200 px-2 py-0.5 rounded-sm"
              >
                失敗
              </span>
            </td>
            <td class="px-3 py-2.5 align-top text-slate-700 tabular-nums">
              {{ h.ipAddress ?? '—' }}
            </td>
            <td class="px-3 py-2.5 align-top text-xs text-slate-500 max-w-[280px] truncate" :title="h.userAgent ?? ''">
              {{ h.userAgent ?? '—' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- オーナー追加モーダル -->
    <div v-if="showCreate" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" @click.self="showCreate = false">
      <div class="bg-white rounded-md shadow-xl max-w-md w-full">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">
            オーナーアカウントを追加
          </h2>
          <p class="text-sm text-slate-600 mt-0.5">
            全店にアクセスできる管理者アカウントを作成します。パスワードは自動生成されます。
          </p>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1">表示名</label>
            <input
              v-model="newName"
              type="text"
              placeholder="例: オーナー2"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
          </div>
          <div>
            <label class="block text-sm font-semibold text-slate-900 mb-1">ログイン ID</label>
            <input
              v-model="newUsername"
              type="text"
              placeholder="半角英数字と _.- （例: owner2）"
              class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white font-mono focus:outline-none focus:border-orange-500"
            >
          </div>
          <div v-if="createError" class="rounded-sm bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {{ createError }}
          </div>
        </div>
        <div class="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            :disabled="creating"
            class="px-3 py-1.5 text-sm border border-slate-300 rounded-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            @click="showCreate = false"
          >
            キャンセル
          </button>
          <button
            type="button"
            :disabled="creating || !newName || !newUsername"
            class="px-3 py-1.5 text-sm rounded-sm text-white bg-orange-500 hover:bg-orange-600 font-semibold disabled:bg-slate-300"
            @click="submitCreate"
          >
            {{ creating ? '作成中...' : '作成する' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ログイン情報表示モーダル（発行・再発行の結果を1回だけ） -->
    <div v-if="credential" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="bg-white rounded-md shadow-xl max-w-md w-full">
        <div class="px-5 py-4 border-b border-slate-200">
          <h2 class="text-lg font-semibold text-slate-900">
            {{ credential.title }}
          </h2>
          <p class="text-sm text-slate-600 mt-0.5">
            <span class="font-semibold text-red-700">パスワードはこの画面でしか表示されません。</span>必ず控えてください。
          </p>
        </div>
        <div class="px-5 py-4 space-y-3">
          <div>
            <p class="text-xs text-slate-500 mb-1">
              ログイン ID
            </p>
            <p class="font-mono text-sm bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 select-all">
              {{ credential.username }}
            </p>
          </div>
          <div>
            <p class="text-xs text-slate-500 mb-1">
              パスワード
            </p>
            <p class="font-mono text-base bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 select-all tracking-wide">
              {{ credential.password }}
            </p>
          </div>
          <button type="button" class="text-sm text-blue-700 hover:text-blue-900 hover:underline" @click="copyCredential">
            {{ copied ? 'コピーしました ✓' : 'ログイン情報をコピー' }}
          </button>
        </div>
        <div class="px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            class="px-4 py-2 text-sm rounded-sm text-white bg-orange-500 hover:bg-orange-600 font-semibold"
            @click="closeCredential"
          >
            控えました
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
