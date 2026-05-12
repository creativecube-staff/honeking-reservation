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

const dateFmt = new Intl.DateTimeFormat('ja-JP', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
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
  <div class="space-y-4">
    <!-- 一括追加フォーム（WP 風） -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm p-4">
      <div class="flex items-end gap-3 flex-wrap">
        <div>
          <label class="block text-xs font-semibold text-slate-900 mb-1">
            一括追加
          </label>
          <div class="flex items-center gap-2">
            <input
              v-model.number="bulkCount"
              type="number"
              min="1"
              max="50"
              class="w-20 px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white shadow-[inset_0_1px_2px_rgba(0,0,0,0.07)] focus:outline-none focus:border-orange-500 focus:shadow-[0_0_0_1px_#f97316]"
            >
            <span class="text-sm text-slate-700">個追加</span>
            <button
              type="button"
              :disabled="bulkBusy"
              class="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white text-sm font-semibold rounded-sm shadow-sm"
              @click="onBulkAdd"
            >
              {{ bulkBusy ? '追加中...' : '+ ベッドを追加' }}
            </button>
          </div>
        </div>
        <p class="text-xs text-slate-600 max-w-md">
          「ベッド N」形式で連番で追加されます（既存の番号の続きから）。<br>
          名前は追加後にいつでも変更できます。
        </p>
      </div>
      <p v-if="bulkError" class="mt-2 text-xs text-red-700">
        {{ bulkError }}
      </p>
    </div>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`ベッド一覧の取得に失敗しました: ${error.message}`"
    />

    <!-- 件数サマリ -->
    <div class="text-sm text-slate-700">
      合計: <strong>{{ counts.all }}</strong> 件 ／
      有効: <strong>{{ counts.active }}</strong> 件 ／
      無効: <strong>{{ counts.inactive }}</strong> 件
    </div>

    <!-- WP 風テーブル -->
    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              ベッド名
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
          <tr v-if="(beds ?? []).length === 0">
            <td colspan="4" class="px-3 py-6 text-center text-slate-500">
              まだベッドが登録されていません。上の「+ ベッドを追加」から追加してください。
            </td>
          </tr>
          <tr
            v-for="bed in beds"
            :key="bed.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <div class="font-semibold text-slate-900">
                {{ bed.name }}
              </div>
              <!-- WP 風ホバー時アクション -->
              <div class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  :disabled="busy === bed.id"
                  class="text-blue-700 hover:text-blue-900 hover:underline disabled:text-slate-400"
                  @click="onRename(bed)"
                >
                  名前を変更
                </button>
                <span class="text-slate-300 mx-1.5">|</span>
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
                <span class="text-slate-300 mx-1.5">|</span>
                <button
                  type="button"
                  :disabled="busy === bed.id"
                  class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400"
                  @click="onDelete(bed)"
                >
                  削除
                </button>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              {{ bed.displayOrder }}
            </td>
            <td class="px-3 py-2.5 align-top">
              <span
                v-if="bed.isActive"
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
              {{ dateFmt.format(new Date(bed.createdAt)) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
