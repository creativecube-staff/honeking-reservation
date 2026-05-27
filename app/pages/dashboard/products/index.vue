<script setup lang="ts">
definePageMeta({ layout: 'admin', requirePermission: 'product:view' })

// 店舗スイッチャーのコンテキスト。
// 管理者(全店)モード = 共通商品（storeId=null）/ 店舗モード = 自店の店舗特別商品。
const { selectedStoreId, canAccessAll, selectedStoreName } = useStoreContext()
const isAdminView = computed(() => canAccessAll.value && selectedStoreId.value === null)

type ProductRow = {
  id: number
  storeId: number | null
  kind: 'PRODUCT' | 'VOUCHER'
  name: string
  description: string | null
  priceJpy: number
  stock: number
  voucherTotalUses: number | null
  isActive: boolean
  displayOrder: number
  createdAt: string
  store: { id: number, name: string, slug: string } | null
}

type Status = 'all' | 'active' | 'inactive'
type KindFilter = 'all' | 'PRODUCT' | 'VOUCHER'
const status = ref<Status>('all')
const kind = ref<KindFilter>('all')

const { data: products, refresh } = await useFetch<ProductRow[]>('/api/admin/products', { query: { status: 'all' } })

// コンテキストで対象を絞る: 管理者 = 共通商品(storeId=null) / 店舗モード = その店の店舗特別商品
const contextProducts = computed(() => {
  const list = products.value ?? []
  if (isAdminView.value) return list.filter(p => p.storeId === null)
  return list.filter(p => p.storeId === selectedStoreId.value)
})

const filtered = computed(() => contextProducts.value
  .filter((p) => {
    if (status.value === 'active') return p.isActive
    if (status.value === 'inactive') return !p.isActive
    return true
  })
  .filter((p) => {
    if (kind.value === 'all') return true
    return p.kind === kind.value
  }))

const counts = computed(() => ({
  all: contextProducts.value.length,
  active: contextProducts.value.filter(p => p.isActive).length,
  inactive: contextProducts.value.filter(p => !p.isActive).length,
}))

const tabs: { v: Status, label: string }[] = [
  { v: 'all', label: 'すべて' },
  { v: 'active', label: '有効' },
  { v: 'inactive', label: '無効' },
]

const canEdit = computed(() => hasPermission('product:edit'))

const busy = ref<number | null>(null)
async function softDelete(p: ProductRow) {
  if (!confirm(`商品「${p.name}」を無効化しますか？`)) return
  busy.value = p.id
  try {
    await $fetch(`/api/admin/products/${p.id}`, { method: 'DELETE' })
    await refresh()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    alert(err.data?.statusMessage || err.statusMessage || '無効化に失敗しました')
  }
  finally { busy.value = null }
}
async function activate(p: ProductRow) {
  busy.value = p.id
  try {
    await $fetch(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { isActive: true } })
    await refresh()
  }
  finally { busy.value = null }
}

function yen(n: number): string { return n.toLocaleString('ja-JP') }
</script>

<template>
  <div>
    <!-- 管理者(全店)モードの「共通商品管理」は全店共通の商品マスタを構築予定。現在は改修中のプレースホルダーを表示する -->
    <div v-if="isAdminView" class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-orange-50 text-orange-500">
        <UIcon name="i-lucide-hard-hat" class="size-8" />
      </div>
      <h1 class="mt-4 text-2xl font-semibold text-slate-900">
        共通商品管理
      </h1>
      <p class="mt-2 max-w-md text-sm text-slate-600">
        全店舗共通の物販商品・回数券マスタは現在改修中です。<br>
        店舗ごとの特別商品は、ヘッダーの店舗スイッチャーで店舗を選ぶと管理できます。
      </p>
      <span class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-700">
        <UIcon name="i-lucide-wrench" class="size-3.5" />
        改修中
      </span>
    </div>

    <!-- 店舗モード: 自店の店舗特別商品 -->
    <template v-else>
    <div class="flex items-center gap-3 mb-1">
      <h1 class="text-2xl font-semibold text-slate-900">
        {{ isAdminView ? '共通商品管理' : `${selectedStoreName} の店舗特別商品` }}
      </h1>
      <NuxtLink
        v-if="canEdit"
        to="/dashboard/products/new"
        class="inline-flex items-center px-3 py-1 border border-[#8c8f94] bg-[#f6f7f7] hover:bg-white text-slate-700 hover:text-slate-900 text-sm rounded-sm"
      >
        新規追加
      </NuxtLink>
    </div>
    <p class="text-sm text-slate-600 mb-4">
      <template v-if="isAdminView">
        全店舗で販売できる共通の物販商品・回数券を管理します。店舗だけの特別商品は、ヘッダーで店舗を選んで登録します。
      </template>
      <template v-else>
        {{ selectedStoreName }} だけで販売する物販商品・回数券を管理します。全店共通の商品は管理者モードの「共通商品管理」で扱います。
      </template>
    </p>

    <ul class="text-sm mb-3 flex items-center">
      <li v-for="(tab, i) in tabs" :key="tab.v" class="flex items-center">
        <button
          class="hover:underline"
          :class="status === tab.v ? 'text-slate-900 font-semibold' : 'text-blue-700 hover:text-blue-900'"
          @click="status = tab.v"
        >
          {{ tab.label }}
          <span :class="status === tab.v ? 'text-slate-500' : 'text-slate-400'">({{ counts[tab.v] }})</span>
        </button>
        <span v-if="i < tabs.length - 1" class="text-slate-300 mx-2">|</span>
      </li>
    </ul>

    <div class="flex items-center gap-3 mb-3 text-sm flex-wrap">
      <label class="text-slate-700">種別:</label>
      <select v-model="kind" class="px-2 py-1 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500">
        <option value="all">
          すべて
        </option>
        <option value="PRODUCT">
          物販
        </option>
        <option value="VOUCHER">
          回数券
        </option>
      </select>
    </div>

    <div class="bg-white border border-[#c3c4c7] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-[#f6f7f7] text-slate-900">
          <tr>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              商品名
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              種別
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              価格
            </th>
            <th class="px-3 py-2.5 text-right font-semibold border-b border-[#c3c4c7]">
              在庫 / 回数
            </th>
            <th class="px-3 py-2.5 text-left font-semibold border-b border-[#c3c4c7]">
              状態
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filtered.length === 0">
            <td colspan="5" class="px-3 py-6 text-center text-slate-500">
              該当する商品はありません。
            </td>
          </tr>
          <tr
            v-for="p in filtered"
            :key="p.id"
            class="group border-b border-[#f0f0f1] last:border-b-0 hover:bg-[#f6f7f7]"
          >
            <td class="px-3 py-2.5 align-top">
              <NuxtLink :to="`/dashboard/products/${p.id}`" class="font-semibold text-blue-700 hover:text-blue-900 hover:underline">
                {{ p.name }}
              </NuxtLink>
              <div v-if="canEdit" class="text-xs text-slate-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <NuxtLink :to="`/dashboard/products/${p.id}`" class="text-blue-700 hover:text-blue-900 hover:underline">
                  編集
                </NuxtLink>
                <span class="text-slate-300 mx-1.5">|</span>
                <button v-if="p.isActive" type="button" :disabled="busy === p.id" class="text-red-700 hover:text-red-900 hover:underline disabled:text-slate-400" @click="softDelete(p)">
                  無効化
                </button>
                <button v-else type="button" :disabled="busy === p.id" class="text-green-700 hover:text-green-900 hover:underline disabled:text-slate-400" @click="activate(p)">
                  復活
                </button>
              </div>
            </td>
            <td class="px-3 py-2.5 align-top">
              <span class="inline-flex items-center text-xs px-2 py-0.5 rounded-sm border" :class="p.kind === 'VOUCHER' ? 'bg-purple-50 text-purple-800 border-purple-300' : 'bg-slate-100 text-slate-700 border-slate-300'">
                {{ p.kind === 'VOUCHER' ? '回数券' : '物販' }}
              </span>
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              ¥{{ yen(p.priceJpy) }}
            </td>
            <td class="px-3 py-2.5 align-top text-right tabular-nums">
              <template v-if="p.kind === 'VOUCHER'">
                {{ p.voucherTotalUses ?? '-' }} 回券
              </template>
              <template v-else>
                <span :class="p.stock === 0 ? 'text-red-700 font-semibold' : ''">
                  {{ p.stock }}
                </span>
              </template>
            </td>
            <td class="px-3 py-2.5 align-top">
              <span v-if="p.isActive" class="inline-flex items-center text-xs text-green-800 bg-green-50 border border-green-200 px-2 py-0.5 rounded-sm">
                有効
              </span>
              <span v-else class="inline-flex items-center text-xs text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-sm">
                無効
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </template>
  </div>
</template>
