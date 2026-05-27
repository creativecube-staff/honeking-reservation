<script setup lang="ts">
import type { Bed } from '@prisma/client'

const props = defineProps<{
  storeId: number
}>()

const { data: beds, refresh, error } = await useFetch<Bed[]>(`/api/admin/stores/${props.storeId}/beds`, {
  watch: false,
})

const counts = computed(() => {
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

async function onBulkAdd() {
  bulkError.value = null
  if (bulkCount.value < 1 || bulkCount.value > 50) {
    bulkError.value = '1 〜 50 の範囲で指定してください'
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

async function onRename(bed: Bed) {
  // eslint-disable-next-line no-alert
  const next = prompt('新しいベッド名を入力してください', bed.name)
  if (next === null || next.trim() === '' || next === bed.name) return
  busy.value = bed.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${bed.id}`, {
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

async function onDeactivate(bed: Bed) {
  if (!confirm(`ベッド「${bed.name}」を無効化しますか？\n\n（一覧には残ります。後で「復活」で戻せます）`)) return
  busy.value = bed.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${bed.id}`, {
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

async function onDelete(bed: Bed) {
  if (!confirm(`ベッド「${bed.name}」を削除しますか？\n\n予約履歴がある場合は無効化のみされます（データ保護のため）。`)) return
  busy.value = bed.id
  try {
    const result = await $fetch<{ mode: 'deleted' | 'deactivated', reservationCount?: number }>(
      `/api/admin/stores/${props.storeId}/beds/${bed.id}`,
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

async function onActivate(bed: Bed) {
  busy.value = bed.id
  try {
    await $fetch(`/api/admin/stores/${props.storeId}/beds/${bed.id}`, {
      method: 'PATCH',
      body: { isActive: true },
    })
    await refresh()
  }
  finally {
    busy.value = null
  }
}
</script>

<template>
  <div class="space-y-3">
    <!-- ヘッダー: 件数 + 一括追加を 1 行にコンパクトに -->
    <div class="flex items-center justify-between gap-3 flex-wrap">
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
      <p v-if="(beds ?? []).length === 0" class="px-3 py-4 text-center text-sm text-slate-500">
        まだベッドがありません。「+ ベッド追加」から追加してください。
      </p>
      <div
        v-for="bed in beds"
        :key="bed.id"
        class="group flex items-center gap-2 px-3 py-1.5 border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
      >
        <span
          class="font-medium text-slate-900"
          :class="{ 'text-slate-400 line-through': !bed.isActive }"
        >
          {{ bed.name }}
        </span>
        <span
          v-if="!bed.isActive"
          class="text-xs text-slate-600 bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-sm"
        >
          無効
        </span>

        <!-- ホバー操作 -->
        <span class="ml-auto text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
          <button
            type="button"
            :disabled="busy === bed.id"
            class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
            @click="onRename(bed)"
          >
            名前
          </button>
          <span class="text-slate-300">|</span>
          <button
            v-if="bed.isActive"
            type="button"
            :disabled="busy === bed.id"
            class="text-amber-700 hover:text-amber-900 hover:underline disabled:text-slate-400"
            @click="onDeactivate(bed)"
          >
            無効化
          </button>
          <button
            v-else
            type="button"
            :disabled="busy === bed.id"
            class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400"
            @click="onActivate(bed)"
          >
            復活
          </button>
          <span class="text-slate-300">|</span>
          <button
            type="button"
            :disabled="busy === bed.id"
            class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
            @click="onDelete(bed)"
          >
            削除
          </button>
        </span>
      </div>
    </div>
  </div>
</template>
