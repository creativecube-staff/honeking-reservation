<script setup lang="ts">
import type { Bed } from '@prisma/client'

// storeId あり = 既存店舗の編集（API で取得・追加・改名・無効化・削除）。
// storeId なし = 新規作成の「下書きモード」（API を叩かず、作成予定のベッド名をローカルで編集し、
//                親が getBedNames() で取り出して作成時にまとめて送る）。
const props = defineProps<{
  storeId?: number
  /** 下書きモードの初期ベッド数（連番「ベッド1..N」で用意） */
  initialBedCount?: number
}>()

const isDraft = !props.storeId

const { data: beds, refresh, error } = await useFetch<Bed[]>(
  `/api/admin/stores/${props.storeId}/beds`,
  // 下書きモードでは API を叩かない
  { watch: false, immediate: !isDraft, default: () => [] as Bed[] },
)

// 下書きモード: 作成予定のベッド名リスト（初期数ぶん連番で用意）
const draftBeds = ref<string[]>(
  isDraft
    ? Array.from({ length: Math.max(0, props.initialBedCount ?? 0) }, (_, i) => `ベッド${i + 1}`)
    : [],
)

// 表示用に正規化した行（API モード=Bed / 下書きモード=ローカル名）。
// draftIndex は下書きモードでの編集対象の添字（API モードは null）。
type Row = { key: string | number, name: string, isActive: boolean, draftIndex: number | null }
const rows = computed<Row[]>(() =>
  isDraft
    ? draftBeds.value.map((name, i) => ({ key: `d-${i}`, name, isActive: true, draftIndex: i }))
    : (beds.value ?? []).map(b => ({ key: b.id, name: b.name, isActive: b.isActive, draftIndex: null })),
)

const counts = computed(() => {
  if (isDraft) {
    return { all: draftBeds.value.length, active: draftBeds.value.length, inactive: 0 }
  }
  const list = beds.value ?? []
  return {
    all: list.length,
    active: list.filter(b => b.isActive).length,
    inactive: list.filter(b => !b.isActive).length,
  }
})

// ── 一括追加 ────────────────────────────────────────────
const bulkCount = ref(1)
const bulkBusy = ref(false)
const bulkError = ref<string | null>(null)

// 既存の「ベッドN」名から次の連番を求める（サーバ側 bulk と同じ命名規則）
function nextBedNumber(names: string[]): number {
  let maxN = 0
  for (const name of names) {
    const m = name.match(/^ベッド(\d+)$/)
    if (m) maxN = Math.max(maxN, Number(m[1]))
  }
  return maxN + 1
}

async function onBulkAdd() {
  bulkError.value = null
  if (bulkCount.value < 1 || bulkCount.value > 50) {
    bulkError.value = '1 〜 50 の範囲で指定してください'
    return
  }

  // 下書きモード: ローカルに連番で追加
  if (isDraft) {
    const start = nextBedNumber(draftBeds.value)
    for (let i = 0; i < bulkCount.value; i++) draftBeds.value.push(`ベッド${start + i}`)
    bulkCount.value = 1
    return
  }

  bulkBusy.value = true
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds`, {
      method: 'POST',
      body: { count: bulkCount.value },
    })
    bulkCount.value = 1
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    bulkError.value = err.data?.statusMessage || err.statusMessage || '追加に失敗しました'
  }
  finally {
    bulkBusy.value = false
  }
}

// ── 行アクション ────────────────────────────────────────
const busy = ref<number | null>(null)

async function onRename(row: Row) {
  // eslint-disable-next-line no-alert
  const next = prompt('新しいベッド名を入力してください', row.name)
  if (next === null || next.trim() === '' || next === row.name) return

  // 下書きモード: ローカル名を書き換えるだけ
  if (isDraft && row.draftIndex !== null) {
    draftBeds.value[row.draftIndex] = next.trim()
    return
  }

  busy.value = row.key as number
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${row.key}`, {
      method: 'PATCH',
      body: { name: next.trim() },
    })
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    alert(err.data?.statusMessage || err.statusMessage || '名前変更に失敗しました')
  }
  finally {
    busy.value = null
  }
}

async function onDeactivate(row: Row) {
  if (!confirm(`ベッド「${row.name}」を無効化しますか？\n\n（一覧には残ります。後で「有効化」で戻せます）`)) return
  busy.value = row.key as number
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${row.key}`, {
      method: 'PATCH',
      body: { isActive: false },
    })
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    alert(err.data?.statusMessage || err.statusMessage || '無効化に失敗しました')
  }
  finally {
    busy.value = null
  }
}

async function onDelete(row: Row) {
  // 下書きモード: ローカルから取り除くだけ
  if (isDraft && row.draftIndex !== null) {
    draftBeds.value.splice(row.draftIndex, 1)
    return
  }

  if (!confirm(`ベッド「${row.name}」を削除しますか？\n\n予約履歴がある場合は無効化のみされます（データ保護のため）。`)) return
  busy.value = row.key as number
  try {
    const result = await $fetch<{ mode: 'deleted' | 'deactivated', reservationCount?: number }>(
      `/api/admin/stores/${props.storeId}/beds/${row.key}`,
      { method: 'DELETE' },
    )
    await refresh()
    if (result.mode === 'deactivated') {
      alert(`このベッドには予約履歴が ${result.reservationCount ?? 0} 件あるため、無効化のみ行いました。`)
    }
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    alert(err.data?.statusMessage || err.statusMessage || '削除に失敗しました')
  }
  finally {
    busy.value = null
  }
}

async function onActivate(row: Row) {
  busy.value = row.key as number
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${row.key}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    await refresh()
  }
  finally {
    busy.value = null
  }
}

// 下書きモードで親（新規作成フォーム）が作成時にベッド名を取り出すための getter
function getBedNames(): string[] {
  return draftBeds.value.map(n => n.trim()).filter(n => n !== '')
}

defineExpose({ getBedNames })
</script>

<template>
  <div class="store-beds space-y-3">
    <!-- ヘッダー: 件数 + 一括追加を 1 行にコンパクトに -->
    <div class="store-beds-header flex items-center justify-between gap-3 flex-wrap">
      <div class="text-sm text-slate-700">
        有効 <strong>{{ counts.active }}</strong> 台<span v-if="counts.inactive" class="text-slate-500"> ／ 無効 {{ counts.inactive }} 台</span>
      </div>
      <div class="flex items-center gap-2">
        <input
          v-model.number="bulkCount"
          type="number"
          min="1"
          max="50"
          class="w-16 px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
        <button
          type="button"
          :disabled="bulkBusy"
          class="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm whitespace-nowrap"
          @click="onBulkAdd"
        >
          {{ bulkBusy ? '追加中...' : '+ ベッド追加' }}
        </button>
      </div>
    </div>
    <p v-if="bulkError" class="text-xs text-red-700">
      {{ bulkError }}
    </p>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`ベッド一覧の取得に失敗しました: ${error.message}`"
    />

    <!-- コンパクトなベッド一覧（1 行 = 名前 + 状態 + ホバー操作） -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm overflow-hidden">
      <p v-if="rows.length === 0" class="px-3 py-4 text-center text-sm text-slate-500">
        まだベッドがありません。「+ ベッド追加」から追加してください。
      </p>
      <div
        v-for="row in rows"
        :key="row.key"
        class="group flex items-center gap-2 px-3 py-1.5 border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
      >
        <span
          class="font-medium text-slate-900"
          :class="{ 'text-slate-400 line-through': !row.isActive }"
        >
          {{ row.name }}
        </span>
        <span
          v-if="!row.isActive"
          class="text-xs text-slate-600 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-sm"
        >
          無効
        </span>

        <!-- ホバー操作 -->
        <span class="ml-auto text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
          <button
            type="button"
            :disabled="busy === row.key"
            class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
            @click="onRename(row)"
          >
            名前
          </button>
          <!-- 無効化/有効化は既存店舗（API モード）のみ。下書きは削除で取り除く -->
          <template v-if="!isDraft">
            <span class="text-slate-300">|</span>
            <button
              v-if="row.isActive"
              type="button"
              :disabled="busy === row.key"
              class="text-amber-700 hover:text-amber-900 hover:underline disabled:text-slate-400"
              @click="onDeactivate(row)"
            >
              無効化
            </button>
            <button
              v-else
              type="button"
              :disabled="busy === row.key"
              class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
              @click="onActivate(row)"
            >
              有効化
            </button>
          </template>
          <span class="text-slate-300">|</span>
          <button
            type="button"
            :disabled="busy === row.key"
            class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
            @click="onDelete(row)"
          >
            削除
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
