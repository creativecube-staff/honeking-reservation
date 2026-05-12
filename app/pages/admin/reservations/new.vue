<script setup lang="ts">
definePageMeta({ layout: 'admin' })

const router = useRouter()

type Store = { id: number, name: string }
type Menu = {
  id: number
  storeId: number | null
  name: string
  durationMinutes: number
  priceJpy: number
  isActive: boolean
}
type Practitioner = { id: number, name: string, storeId: number }
type Bed = { id: number, name: string }

// マスタ取得
const { data: stores } = await useFetch<Store[]>('/api/admin/stores', { query: { status: 'active' } })

// フォーム状態
function pad(n: number): string { return String(n).padStart(2, '0') }
function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const form = reactive({
  storeId: null as number | null,
  date: todayYmd(),
  time: '10:00',
  menuId: null as number | null,
  practitionerId: null as number | null, // null = 自動割当
  bedId: null as number | null, // null = 自動割当
  customerName: '',
  customerPhone: '',
  customerEmail: '',
  note: '',
  forceOverride: false,
})

// 店舗が選ばれたら、その店舗のメニュー・スタッフ・ベッドを取れるようにする
const { data: menus } = await useFetch<Menu[]>('/api/admin/menus', {
  query: { status: 'active' },
})
const visibleMenus = computed(() => {
  if (!form.storeId) return []
  return (menus.value ?? []).filter(m => m.isActive && (m.storeId === null || m.storeId === form.storeId))
})

// 予約に割り当てられるスタッフのみ（オーナー等の特別アカウントは除外）
const { data: practitioners } = await useFetch<Practitioner[]>('/api/admin/staff', {
  query: { status: 'active', assignable: 'true' },
})
const visiblePractitioners = computed(() => {
  if (!form.storeId) return []
  return (practitioners.value ?? []).filter(p => p.storeId === form.storeId)
})

// ベッドは店舗ごとに別 API
const bedsCache = ref<Record<number, Bed[]>>({})
async function loadBeds(storeId: number) {
  if (bedsCache.value[storeId]) return
  const beds = await $fetch<Bed[]>(`/api/admin/stores/${storeId}/beds`)
  bedsCache.value[storeId] = beds
}
watch(() => form.storeId, (v) => {
  if (v) loadBeds(v).catch(() => {})
  // 店舗が変わったら依存項目をリセット
  form.menuId = null
  form.practitionerId = null
  form.bedId = null
})
const visibleBeds = computed(() => form.storeId ? (bedsCache.value[form.storeId] ?? []) : [])

// startAt 文字列構築
const startAtStr = computed(() => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date) || !/^\d{2}:\d{2}$/.test(form.time)) return null
  return `${form.date}T${form.time.replace(':', '')}`
})

const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = reactive<Record<string, string>>({})

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  errorMessage.value = null
  if (!form.storeId) fieldErrors.storeId = '店舗を選んでください'
  if (!form.menuId) fieldErrors.menuId = 'メニューを選んでください'
  if (!form.date) fieldErrors.date = '日付を入力してください'
  if (!form.time) fieldErrors.time = '時刻を入力してください'
  if (!form.customerName.trim()) fieldErrors.customerName = 'お名前を入力してください'
  if (!form.customerPhone.trim() && !form.customerEmail.trim()) {
    fieldErrors.customerPhone = '電話番号またはメールアドレスのどちらかを入力してください'
  }
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  const sa = startAtStr.value
  if (!sa) {
    errorMessage.value = '日時の形式が不正です'
    return
  }
  submitting.value = true
  try {
    const result = await $fetch<{ id: number, confirmationCode: string }>('/api/admin/reservations', {
      method: 'POST',
      body: {
        storeId: form.storeId,
        menuId: form.menuId,
        practitionerId: form.practitionerId ?? undefined,
        bedId: form.bedId ?? undefined,
        startAt: sa,
        customer: {
          name: form.customerName.trim(),
          phone: form.customerPhone.trim() || undefined,
          email: form.customerEmail.trim() || undefined,
        },
        note: form.note.trim() || undefined,
        forceOverride: form.forceOverride,
      },
    })
    await router.push(`/admin/reservations/${result.id}`)
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '予約作成に失敗しました'
  }
  finally {
    submitting.value = false
  }
}

// 30 分刻みの時刻オプション（7:00 〜 21:30）
const timeOptions = computed(() => {
  const list: string[] = []
  for (let h = 7; h <= 21; h++) {
    list.push(`${pad(h)}:00`, `${pad(h)}:30`)
  }
  return list
})
</script>

<template>
  <div>
    <div class="mb-4">
      <NuxtLink to="/admin/reservations" class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1">
        <UIcon name="i-lucide-chevron-left" class="size-4" />
        予約一覧へ戻る
      </NuxtLink>
    </div>

    <h1 class="text-2xl font-semibold text-slate-900 mb-1">
      予約を手動で追加
    </h1>
    <p class="text-sm text-slate-600 mb-6">
      電話受付した予約などをこちらから登録します。施術者・ベッドは空きから自動割当もできます。
    </p>

    <UAlert
      v-if="errorMessage"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="errorMessage"
      class="mb-4"
    />

    <form class="space-y-6 max-w-2xl" @submit.prevent="onSubmit">
      <!-- 予約内容 -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="text-sm font-semibold text-slate-900">予約内容</h2>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">
              店舗 <span class="text-red-600">*</span>
            </label>
            <select
              v-model="form.storeId"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              :class="fieldErrors.storeId ? 'border-red-500' : ''"
            >
              <option :value="null">選んでください</option>
              <option v-for="s in (stores ?? [])" :key="s.id" :value="s.id">
                {{ s.name }}
              </option>
            </select>
            <p v-if="fieldErrors.storeId" class="mt-1 text-xs text-red-600">{{ fieldErrors.storeId }}</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">
              メニュー <span class="text-red-600">*</span>
            </label>
            <select
              v-model="form.menuId"
              :disabled="!form.storeId"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              :class="fieldErrors.menuId ? 'border-red-500' : ''"
            >
              <option :value="null">選んでください</option>
              <option v-for="m in visibleMenus" :key="m.id" :value="m.id">
                {{ m.name }} ({{ m.durationMinutes }}分 / ¥{{ m.priceJpy.toLocaleString('ja-JP') }})
                <template v-if="m.storeId !== null"> ★店舗限定</template>
              </option>
            </select>
            <p v-if="fieldErrors.menuId" class="mt-1 text-xs text-red-600">{{ fieldErrors.menuId }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                日付 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="form.date"
                type="date"
                class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              >
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                開始時刻 <span class="text-red-600">*</span>
              </label>
              <select
                v-model="form.time"
                class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500"
              >
                <option v-for="t in timeOptions" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                担当スタッフ
                <span class="text-xs font-normal text-slate-500">（空欄=自動）</span>
              </label>
              <select
                v-model="form.practitionerId"
                :disabled="!form.storeId"
                class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              >
                <option :value="null">自動割当</option>
                <option v-for="p in visiblePractitioners" :key="p.id" :value="p.id">
                  {{ p.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                ベッド
                <span class="text-xs font-normal text-slate-500">（空欄=自動）</span>
              </label>
              <select
                v-model="form.bedId"
                :disabled="!form.storeId"
                class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm bg-white focus:outline-none focus:border-orange-500 disabled:bg-slate-100"
              >
                <option :value="null">自動割当</option>
                <option v-for="b in visibleBeds" :key="b.id" :value="b.id">
                  {{ b.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="inline-flex items-start gap-2 text-sm text-slate-700">
              <input
                v-model="form.forceOverride"
                type="checkbox"
                class="mt-1 size-4 border-slate-300 rounded text-orange-500 focus:ring-orange-500"
              >
              <span>
                営業時間外・店休日・シフト外の予約を許可する（特例予約）
              </span>
            </label>
          </div>
        </div>
      </div>

      <!-- お客様情報 -->
      <div class="bg-white border border-[#c3c4c7] rounded-sm">
        <div class="px-4 py-2.5 border-b border-[#dcdcde] bg-[#f6f7f7]">
          <h2 class="text-sm font-semibold text-slate-900">
            お客様情報
            <span class="text-xs font-normal text-slate-500">（同一電話/メールの既存お客様があれば紐付け、無ければ新規作成）</span>
          </h2>
        </div>
        <div class="p-4 space-y-4">
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">
              お名前 <span class="text-red-600">*</span>
            </label>
            <input
              v-model="form.customerName"
              type="text"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              :class="fieldErrors.customerName ? 'border-red-500' : ''"
              placeholder="山田 太郎"
            >
            <p v-if="fieldErrors.customerName" class="mt-1 text-xs text-red-600">{{ fieldErrors.customerName }}</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">
              電話番号
              <span class="text-xs font-normal text-slate-500">（電話 or メールどちらか必須）</span>
            </label>
            <input
              v-model="form.customerPhone"
              type="tel"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              :class="fieldErrors.customerPhone ? 'border-red-500' : ''"
              placeholder="090-1234-5678"
            >
            <p v-if="fieldErrors.customerPhone" class="mt-1 text-xs text-red-600">{{ fieldErrors.customerPhone }}</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">メールアドレス</label>
            <input
              v-model="form.customerEmail"
              type="email"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              placeholder="example@example.com"
            >
          </div>

          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">備考</label>
            <textarea
              v-model="form.note"
              rows="3"
              class="w-full px-2 py-2 text-sm border border-[#8c8f94] rounded-sm focus:outline-none focus:border-orange-500"
              placeholder="腰痛が気になる、初回、など"
            />
          </div>
        </div>
      </div>

      <!-- 送信 -->
      <div class="flex gap-3">
        <NuxtLink
          to="/admin/reservations"
          class="px-4 py-2 text-sm border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-sm"
        >
          キャンセル
        </NuxtLink>
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 text-sm bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold rounded-sm"
        >
          {{ submitting ? '作成中...' : 'この内容で予約を作成' }}
        </button>
      </div>
    </form>
  </div>
</template>
