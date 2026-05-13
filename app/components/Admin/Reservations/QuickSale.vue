<script setup lang="ts">
// 予約に紐付かない物販販売を素早く登録するインラインフォーム。
//
// 仕様:
//   - お客様: タブで「ゲスト購入（店頭ふらっと）」「既存顧客」を切替
//     - ゲスト購入: server 側で「店頭ふらっと販売用」固定 Customer に紐付け
//     - 既存顧客: hash 完全一致で検索 → 選択
//   - 商品: カート式（行追加・削除可能）、各行で商品 + 数量
//   - 1 度の送信で複数 ProductSale を生成（トランザクション、API: /api/admin/sales/bulk）
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

// ── お客様モード ─────────────────────────────────────
type CustomerMode = 'guest' | 'existing'
const customerMode = ref<CustomerMode>('guest')

// 顧客検索（existing モード用）
// 入力に応じて debounce で自動検索 → 結果をドロップダウン表示 → クリックで選択
const customerQuery = ref('')
const customerResults = ref<CustomerResult[]>([])
const customerSearching = ref(false)
const selectedCustomer = ref<CustomerResult | null>(null)
const dropdownOpen = ref(false)

let searchTimer: ReturnType<typeof setTimeout> | null = null
let searchSeq = 0

function scheduleSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = customerQuery.value.trim()
  if (q.length < 1) {
    customerResults.value = []
    customerSearching.value = false
    return
  }
  customerSearching.value = true
  const mySeq = ++searchSeq
  searchTimer = setTimeout(async () => {
    try {
      const res = await $fetch<CustomerResult[]>('/api/admin/customers/search', { query: { q } })
      // 古いリクエストの結果で上書きしないようガード
      if (mySeq !== searchSeq) return
      customerResults.value = res
      dropdownOpen.value = true
    }
    finally {
      if (mySeq === searchSeq) customerSearching.value = false
    }
  }, 250)
}

watch(customerQuery, scheduleSearch)

function selectCustomer(c: CustomerResult) {
  selectedCustomer.value = c
  customerResults.value = []
  customerQuery.value = ''
  dropdownOpen.value = false
}

function unselectCustomer() {
  selectedCustomer.value = null
}

// 外側クリックでドロップダウンを閉じる
const searchWrapperRef = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent) {
  if (!searchWrapperRef.value) return
  if (!searchWrapperRef.value.contains(e.target as Node)) {
    dropdownOpen.value = false
  }
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))

function setCustomerMode(m: CustomerMode) {
  customerMode.value = m
  // モードを切り替えたら相手側の選択は捨てる
  if (m === 'guest') {
    selectedCustomer.value = null
    customerResults.value = []
    customerQuery.value = ''
  }
}

// ── 商品マスタ ───────────────────────────────────────
const { data: allProducts } = await useFetch<ProductMaster[]>('/api/admin/products', { query: { status: 'active' } })

// ── カート（複数商品） ───────────────────────────────
type CartItem = { productId: number | null, quantity: number }
const storeId = ref<number | null>(null)
const cart = ref<CartItem[]>([{ productId: null, quantity: 1 }])

function addCartItem() {
  cart.value.push({ productId: null, quantity: 1 })
}
function removeCartItem(i: number) {
  cart.value.splice(i, 1)
  if (cart.value.length === 0) addCartItem()
}

// 店舗を切り替えたらカートをリセット（店舗特別商品が変わるため）
watch(storeId, () => {
  cart.value = [{ productId: null, quantity: 1 }]
})

const availableProducts = computed<ProductMaster[]>(() => {
  if (!storeId.value) return []
  return (allProducts.value ?? [])
    .filter(p => p.isActive && (p.storeId === null || p.storeId === storeId.value))
    .filter(p => p.kind === 'VOUCHER' || p.stock > 0)
})

function findProduct(id: number | null): ProductMaster | null {
  if (!id) return null
  return (allProducts.value ?? []).find(p => p.id === id) ?? null
}

// 小計（行ごと）
function itemSubtotal(item: CartItem): number {
  const p = findProduct(item.productId)
  if (!p) return 0
  return p.priceJpy * item.quantity
}

// 合計
const totalAmount = computed(() =>
  cart.value.reduce((sum, item) => sum + itemSubtotal(item), 0),
)

// 有効な商品行数
const validItemCount = computed(() =>
  cart.value.filter(item => item.productId !== null && item.quantity > 0).length,
)

// ── 送信 ─────────────────────────────────────────────
// yen は app/utils/format.ts の auto-import 経由で利用。

const formError = ref<string | null>(null)
const submitting = ref(false)

async function submit() {
  formError.value = null
  if (!storeId.value) {
    formError.value = '店舗を選択してください'
    return
  }
  if (customerMode.value === 'existing' && !selectedCustomer.value) {
    formError.value = 'お客様を選択してください（または「ゲスト購入」に切り替えてください）'
    return
  }
  const validItems = cart.value
    .filter(item => item.productId !== null && item.quantity > 0)
    .map(item => ({ productId: item.productId!, quantity: item.quantity }))
  if (validItems.length === 0) {
    formError.value = '商品を 1 つ以上選択してください'
    return
  }

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      storeId: storeId.value,
      items: validItems,
    }
    if (customerMode.value === 'guest') {
      body.isGuestPurchase = true
    }
    else {
      body.customerId = selectedCustomer.value!.id
    }
    await $fetch('/api/admin/sales/bulk', { method: 'POST', body })
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
</script>

<template>
  <div class="bg-purple-50 border border-purple-300 rounded-sm p-4 mb-4 space-y-4">
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

    <!-- ① お客様セクション -->
    <div>
      <label class="block text-xs font-semibold text-slate-700 mb-1.5">お客様</label>
      <!-- モード切替タブ -->
      <div class="inline-flex border border-purple-300 rounded-sm overflow-hidden text-sm mb-2">
        <button
          type="button"
          class="px-3 py-1.5 inline-flex items-center gap-1"
          :class="customerMode === 'guest' ? 'bg-purple-600 text-white' : 'bg-white text-slate-700 hover:bg-purple-100'"
          @click="setCustomerMode('guest')"
        >
          <UIcon name="i-lucide-user-round" class="size-3.5" />
          ゲスト購入
        </button>
        <button
          type="button"
          class="px-3 py-1.5 border-l border-purple-300 inline-flex items-center gap-1"
          :class="customerMode === 'existing' ? 'bg-purple-600 text-white' : 'bg-white text-slate-700 hover:bg-purple-100'"
          @click="setCustomerMode('existing')"
        >
          <UIcon name="i-lucide-search" class="size-3.5" />
          既存顧客に紐付ける
        </button>
      </div>

      <!-- 既存顧客検索（入力に応じて候補をドロップダウン表示） -->
      <div v-if="customerMode === 'existing'">
        <div v-if="selectedCustomer" class="flex items-center gap-2 px-2.5 py-2 bg-white border border-purple-300 rounded-sm">
          <UIcon name="i-lucide-user-check" class="size-4 text-purple-600" />
          <span class="font-medium text-slate-900">{{ selectedCustomer.name ?? '(復号失敗)' }}</span>
          <span v-if="selectedCustomer.phone" class="text-xs text-slate-600">{{ selectedCustomer.phone }}</span>
          <button type="button" class="ml-auto text-xs text-red-700 hover:text-red-900" @click="unselectCustomer">
            選び直す
          </button>
        </div>
        <div v-else ref="searchWrapperRef" class="relative">
          <div class="relative">
            <UIcon
              name="i-lucide-search"
              class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none"
            />
            <input
              v-model="customerQuery"
              type="text"
              placeholder="お客様名・電話番号・メールの一部を入力（部分一致）"
              class="w-full pl-8 pr-8 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              @focus="dropdownOpen = true"
            >
            <UIcon
              v-if="customerSearching"
              name="i-lucide-loader-circle"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 animate-spin"
            />
          </div>
          <!-- 候補ドロップダウン -->
          <ul
            v-if="dropdownOpen && customerQuery.trim().length > 0"
            class="absolute z-20 mt-1 left-0 right-0 bg-white border border-purple-300 rounded-sm shadow-lg max-h-72 overflow-y-auto"
          >
            <li v-if="customerResults.length === 0 && !customerSearching" class="px-3 py-2 text-xs text-slate-500">
              該当するお客様が見つかりません
            </li>
            <li v-for="c in customerResults" :key="c.id" class="border-b border-[#f0f0f1] last:border-b-0">
              <button
                type="button"
                class="w-full text-left px-3 py-2 text-sm hover:bg-purple-50"
                @click="selectCustomer(c)"
              >
                <div class="font-medium text-slate-900">{{ c.name ?? '(復号失敗)' }}</div>
                <div class="text-xs text-slate-600 flex items-center gap-3 mt-0.5">
                  <span v-if="c.phone" class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-phone" class="size-3" />{{ c.phone }}
                  </span>
                  <span v-if="c.email" class="inline-flex items-center gap-1">
                    <UIcon name="i-lucide-mail" class="size-3" />{{ c.email }}
                  </span>
                </div>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- ② 店舗 -->
    <div>
      <label class="block text-xs font-semibold text-slate-700 mb-1">店舗</label>
      <select
        v-model.number="storeId"
        class="w-full max-w-xs px-2.5 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
      >
        <option :value="null">
          -- 選択 --
        </option>
        <option v-for="s in props.stores" :key="s.id" :value="s.id">
          {{ s.name }}
        </option>
      </select>
    </div>

    <!-- ③ 商品（カート式） -->
    <div>
      <div class="flex items-center justify-between mb-2">
        <label class="block text-xs font-semibold text-slate-700">商品（複数追加可）</label>
        <button
          type="button"
          :disabled="!storeId"
          class="text-xs px-2.5 py-1 border border-purple-300 bg-white hover:bg-purple-100 disabled:bg-slate-100 disabled:text-slate-400 text-purple-800 rounded-sm inline-flex items-center gap-1"
          @click="addCartItem"
        >
          <UIcon name="i-lucide-plus" class="size-3.5" />
          商品を追加
        </button>
      </div>

      <div v-if="!storeId" class="text-xs text-slate-500 px-3 py-2 bg-white border border-dashed border-purple-200 rounded-sm">
        先に店舗を選択してください
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="(item, i) in cart"
          :key="i"
          class="flex items-end gap-2 bg-white border border-purple-200 rounded-sm p-2"
        >
          <div class="flex-1 min-w-0">
            <label class="block text-[10px] text-slate-500 mb-0.5">商品</label>
            <select
              v-model.number="item.productId"
              class="w-full px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
            >
              <option :value="null">
                -- 選択 --
              </option>
              <option v-for="p in availableProducts" :key="p.id" :value="p.id">
                {{ p.kind === 'VOUCHER' ? '【回数券】' : '' }}{{ p.name }}（¥{{ yen(p.priceJpy) }}{{ p.kind === 'PRODUCT' ? ` / 在庫 ${p.stock}` : '' }}）
              </option>
            </select>
          </div>
          <div class="flex-shrink-0">
            <label class="block text-[10px] text-slate-500 mb-0.5">数量</label>
            <input
              v-model.number="item.quantity"
              type="number"
              min="1"
              class="w-16 px-2 py-1.5 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 tabular-nums"
            >
          </div>
          <div class="flex-shrink-0 min-w-[80px] text-right">
            <div class="text-[10px] text-slate-500 mb-0.5">
              小計
            </div>
            <div class="text-sm font-semibold tabular-nums text-slate-900 px-2 py-1.5">
              ¥{{ yen(itemSubtotal(item)) }}
            </div>
          </div>
          <button
            type="button"
            class="flex-shrink-0 mb-0.5 px-2 py-1.5 text-red-700 hover:bg-red-50 rounded-sm"
            :disabled="cart.length === 1 && !item.productId"
            title="この行を削除"
            @click="removeCartItem(i)"
          >
            <UIcon name="i-lucide-x" class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- ④ 合計 + 送信 -->
    <div class="flex items-center justify-between pt-3 border-t border-purple-200">
      <div class="text-sm">
        <span class="text-slate-600">合計（{{ validItemCount }} 商品）</span>
        <span class="ml-2 text-xl font-bold tabular-nums text-purple-900">
          ¥{{ yen(totalAmount) }}
        </span>
      </div>
      <button
        type="button"
        :disabled="submitting || !storeId || validItemCount === 0 || (customerMode === 'existing' && !selectedCustomer)"
        class="px-5 py-2 text-sm rounded-sm bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold inline-flex items-center gap-1.5"
        @click="submit"
      >
        <UIcon name="i-lucide-credit-card" class="size-4" />
        {{ submitting ? '販売中...' : '販売する' }}
      </button>
    </div>
  </div>
</template>
