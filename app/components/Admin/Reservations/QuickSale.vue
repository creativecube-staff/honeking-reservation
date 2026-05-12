<script setup lang="ts">
// 予約に紐付かない物販販売を素早く登録するインラインフォーム。
// 顧客検索（hash 一致なので部分検索不可、完全一致）+ 店舗 + 商品 + 数量。
const props = defineProps<{
  stores: { id: number, name: string }[]
}>()
const emit = defineEmits<{ added: [], close: [] }>()

type CustomerResult = { id: number, name: string | null, phone: string | null, email: string | null }
type ProductMaster = {
  id: number
  storeId: number | null
  kind: 'PRODUCT' | 'VOUCHER'
  name: string
  priceJpy: number
  stock: number
  isActive: boolean
}

// 顧客検索
const customerQuery = ref('')
const customerResults = ref<CustomerResult[]>([])
const customerSearching = ref(false)
const selectedCustomer = ref<CustomerResult | null>(null)

async function searchCustomer() {
  const q = customerQuery.value.trim()
  if (!q) {
    customerResults.value = []
    return
  }
  customerSearching.value = true
  try {
    const res = await $fetch<CustomerResult[]>('/api/admin/customers/search', { query: { q } })
    customerResults.value = res
  }
  finally {
    customerSearching.value = false
  }
}

function selectCustomer(c: CustomerResult) {
  selectedCustomer.value = c
  customerResults.value = []
  customerQuery.value = ''
}

function unselectCustomer() {
  selectedCustomer.value = null
}

// 商品マスタ
const { data: allProducts } = await useFetch<ProductMaster[]>('/api/admin/products', { query: { status: 'active' } })

// フォーム状態
const form = reactive({
  storeId: null as number | null,
  productId: null as number | null,
  quantity: 1,
  note: '',
})

const availableProducts = computed(() => {
  if (!form.storeId) return []
  return (allProducts.value ?? [])
    .filter(p => p.isActive && (p.storeId === null || p.storeId === form.storeId))
    .filter(p => p.kind === 'VOUCHER' || p.stock > 0)
})

const formError = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  formError.value = null
  if (!selectedCustomer.value) {
    formError.value = 'お客様を選択してください'
    return
  }
  if (!form.storeId) {
    formError.value = '店舗を選択してください'
    return
  }
  if (!form.productId) {
    formError.value = '商品を選択してください'
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/admin/sales', {
      method: 'POST',
      body: {
        productId: form.productId,
        storeId: form.storeId,
        customerId: selectedCustomer.value.id,
        reservationId: null,
        quantity: form.quantity,
        note: form.note.trim() || undefined,
      },
    })
    emit('added')
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    formError.value = err.data?.statusMessage || err.statusMessage || '販売登録に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

function yen(n: number): string { return n.toLocaleString('ja-JP') }
</script>

<template>
  <div class="bg-purple-50 border border-purple-300 rounded-sm p-4 mb-4 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-purple-900 inline-flex items-center gap-1.5">
        <UIcon name="i-lucide-shopping-cart" class="size-4" />
        物販販売を追加（予約なし）
      </h2>
      <button type="button" class="text-xs text-slate-600 hover:text-slate-900" @click="emit('close')">
        ✕ 閉じる
      </button>
    </div>

    <UAlert v-if="formError" color="error" icon="i-lucide-triangle-alert" :title="formError" />

    <!-- 顧客選択 -->
    <div>
      <label class="block text-xs font-semibold text-slate-700 mb-1">お客様</label>
      <div v-if="selectedCustomer" class="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-300 rounded-sm">
        <span class="font-medium text-slate-900">{{ selectedCustomer.name }}</span>
        <span v-if="selectedCustomer.phone" class="text-xs text-slate-600">{{ selectedCustomer.phone }}</span>
        <button type="button" class="ml-auto text-xs text-red-700 hover:text-red-900" @click="unselectCustomer">
          選び直す
        </button>
      </div>
      <div v-else>
        <div class="flex items-center gap-2">
          <input
            v-model="customerQuery"
            type="text"
            placeholder="お客様名・電話番号・メールで完全一致検索"
            class="flex-1 px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            @keydown.enter.prevent="searchCustomer"
          >
          <button
            type="button"
            :disabled="customerSearching"
            class="px-3 py-2 text-sm bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-sm"
            @click="searchCustomer"
          >
            検索
          </button>
        </div>
        <ul v-if="customerResults.length > 0" class="mt-2 bg-white border border-purple-300 rounded-sm divide-y divide-[#f0f0f1] max-h-60 overflow-y-auto">
          <li v-for="c in customerResults" :key="c.id">
            <button
              type="button"
              class="w-full text-left px-3 py-2 text-sm hover:bg-purple-50"
              @click="selectCustomer(c)"
            >
              <div class="font-medium text-slate-900">{{ c.name ?? '(復号失敗)' }}</div>
              <div class="text-xs text-slate-600">
                <template v-if="c.phone">📞 {{ c.phone }}</template>
                <template v-if="c.email">　✉ {{ c.email }}</template>
              </div>
            </button>
          </li>
        </ul>
        <p v-else-if="customerQuery && !customerSearching" class="text-xs text-slate-500 mt-1">
          ※ 「検索」を押してください。検索は完全一致のため、既存予約のお客様で正確な名前・電話・メールを入力してください。
        </p>
      </div>
    </div>

    <!-- 店舗選択 -->
    <div>
      <label class="block text-xs font-semibold text-slate-700 mb-1">店舗</label>
      <select
        v-model.number="form.storeId"
        class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
      >
        <option :value="null">
          -- 選択 --
        </option>
        <option v-for="s in props.stores" :key="s.id" :value="s.id">
          {{ s.name }}
        </option>
      </select>
    </div>

    <!-- 商品 + 数量 -->
    <div class="flex items-end gap-2 flex-wrap">
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-semibold text-slate-700 mb-1">商品</label>
        <select
          v-model.number="form.productId"
          :disabled="!form.storeId"
          class="w-full px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
        >
          <option :value="null">
            -- 選択 --
          </option>
          <option v-for="p in availableProducts" :key="p.id" :value="p.id">
            {{ p.kind === 'VOUCHER' ? '【回数券】' : '' }}{{ p.name }}（¥{{ yen(p.priceJpy) }}{{ p.kind === 'PRODUCT' ? ` / 在庫 ${p.stock}` : '' }}）
          </option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-700 mb-1">数量</label>
        <input
          v-model.number="form.quantity"
          type="number"
          min="1"
          class="w-20 px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
        >
      </div>
      <button
        type="button"
        :disabled="submitting || !selectedCustomer || !form.storeId || !form.productId"
        class="px-4 py-2 text-sm rounded-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold"
        @click="submit"
      >
        {{ submitting ? '販売中...' : '販売する' }}
      </button>
    </div>
  </div>
</template>
