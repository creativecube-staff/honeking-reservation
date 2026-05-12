<script setup lang="ts">
// 予約フロー 4/4: 顧客情報・確認
const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug ?? ''))
const menuId = computed(() => Number(route.params.menuId ?? 0))
const startAtRaw = computed(() => String(route.params.startAt ?? '')) // "YYYY-MM-DDTHHMM"

type Store = {
  id: number
  slug: string
  prefecture: string
  city: string
  name: string
  address: string
  phone: string | null
}
type Menu = {
  id: number
  storeId: number | null
  name: string
  description: string | null
  durationMinutes: number
  priceJpy: number
}

const { data: store, error: storeError } = await useFetch<Store>(() => `/api/stores/${slug.value}`)
const { data: menus } = await useFetch<Menu[]>(() => `/api/stores/${slug.value}/menus`)
const menu = computed<Menu | null>(() => (menus.value ?? []).find(m => m.id === menuId.value) ?? null)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// startAt 解析
const parsedStart = computed(() => {
  const s = startAtRaw.value
  if (!/^\d{4}-\d{2}-\d{2}T\d{4}$/.test(s)) return null
  return {
    ymd: s.slice(0, 10),
    hh: Number(s.slice(11, 13)),
    mm: Number(s.slice(13, 15)),
    time: `${s.slice(11, 13)}:${s.slice(13, 15)}`,
  }
})

const dateLabel = computed(() => {
  const p = parsedStart.value
  if (!p) return ''
  const [y, m, d] = p.ymd.split('-').map(Number)
  const dt = new Date(y!, m! - 1, d!)
  const dow = ['日', '月', '火', '水', '木', '金', '土'][dt.getDay()]
  return `${y}年${m}月${d}日 (${dow})`
})

const endTimeLabel = computed(() => {
  const p = parsedStart.value
  const m = menu.value
  if (!p || !m) return ''
  const total = p.hh * 60 + p.mm + m.durationMinutes
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`
})

function duration(min: number): string {
  if (min < 60) return `${min} 分`
  const h = Math.floor(min / 60)
  const mm = min % 60
  return mm === 0 ? `${h} 時間` : `${h} 時間 ${mm} 分`
}
function yen(n: number): string {
  return n.toLocaleString('ja-JP')
}

// フォーム状態
const form = reactive({
  name: '',
  phone: '',
  email: '',
  note: '',
  agree: false,
})
const submitting = ref(false)
const errorMessage = ref<string | null>(null)
const fieldErrors = reactive<Record<string, string>>({})

function validate(): boolean {
  for (const k of Object.keys(fieldErrors)) delete fieldErrors[k]
  errorMessage.value = null
  const name = form.name.trim()
  const phone = form.phone.trim()
  const email = form.email.trim()
  if (!name) {
    fieldErrors.name = 'お名前を入力してください'
  }
  if (!phone && !email) {
    fieldErrors.phone = '電話番号またはメールアドレスのどちらかを入力してください'
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fieldErrors.email = 'メールアドレスの形式が正しくありません'
  }
  if (!form.agree) {
    fieldErrors.agree = '利用規約に同意してください'
  }
  return Object.keys(fieldErrors).length === 0
}

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
    const result = await $fetch<{ confirmationCode: string }>('/api/reservations', {
      method: 'POST',
      body: {
        storeSlug: slug.value,
        menuId: menuId.value,
        startAt: startAtRaw.value,
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          note: form.note.trim() || undefined,
        },
      },
    })
    await router.push(`/reserve/complete/${result.confirmationCode}`)
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || err.statusMessage || '予約処理に失敗しました'
  }
  finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 sm:px-6 py-8">
    <ol class="flex items-center text-xs sm:text-sm text-slate-500 mb-6 gap-2">
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">1</span>
        <span>店舗</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">2</span>
        <span>メニュー</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1">
        <span class="size-6 rounded-full bg-slate-300 text-white flex items-center justify-center text-xs">3</span>
        <span>日時</span>
      </li>
      <li class="text-slate-300">→</li>
      <li class="flex items-center gap-1 font-semibold text-orange-700">
        <span class="size-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs">4</span>
        <span>確認</span>
      </li>
    </ol>

    <UAlert
      v-if="storeError"
      color="error"
      icon="i-lucide-triangle-alert"
      :title="`店舗の取得に失敗しました: ${storeError.message}`"
    />

    <div v-else-if="store && menu && parsedStart">
      <h1 class="text-xl sm:text-2xl font-bold text-slate-900 mb-4">
        ご予約内容の確認
      </h1>

      <!-- 予約サマリ -->
      <div class="rounded-xl border-2 border-amber-300 bg-[#fff3db] p-5 mb-6 space-y-3">
        <div>
          <p class="text-xs text-slate-600">店舗</p>
          <p class="text-base font-bold text-slate-900">{{ store.name }}</p>
          <p class="text-sm text-slate-600">{{ store.address }}</p>
        </div>
        <div>
          <p class="text-xs text-slate-600">メニュー</p>
          <p class="text-base font-bold text-slate-900">{{ menu.name }}</p>
          <p class="text-sm text-slate-700">
            所要時間: {{ duration(menu.durationMinutes) }} / ¥{{ yen(menu.priceJpy) }}
          </p>
        </div>
        <div>
          <p class="text-xs text-slate-600">日時</p>
          <p class="text-lg font-bold text-orange-800 tabular-nums">
            {{ dateLabel }} {{ parsedStart.time }}–{{ endTimeLabel }}
          </p>
        </div>
      </div>

      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
        class="mb-4"
      />

      <h2 class="text-lg font-bold text-slate-900 mb-3">
        お客様情報
      </h2>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- お名前 -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            お名前 <span class="text-red-600">*</span>
          </label>
          <input
            v-model="form.name"
            type="text"
            autocomplete="name"
            required
            class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            :class="fieldErrors.name ? 'border-red-500' : ''"
            placeholder="山田 太郎"
          >
          <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.name }}
          </p>
        </div>

        <!-- 電話番号 -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            電話番号
            <span class="text-xs font-normal text-slate-500">（電話 or メールどちらか必須）</span>
          </label>
          <input
            v-model="form.phone"
            type="tel"
            autocomplete="tel"
            class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            :class="fieldErrors.phone ? 'border-red-500' : ''"
            placeholder="090-1234-5678"
          >
          <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.phone }}
          </p>
        </div>

        <!-- メール -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            メールアドレス
          </label>
          <input
            v-model="form.email"
            type="email"
            autocomplete="email"
            class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            :class="fieldErrors.email ? 'border-red-500' : ''"
            placeholder="example@example.com"
          >
          <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.email }}
          </p>
        </div>

        <!-- 備考 -->
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">
            ご要望・お困りの症状など（任意）
          </label>
          <textarea
            v-model="form.note"
            rows="3"
            class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
            placeholder="腰痛が気になります、など"
          />
        </div>

        <!-- 同意 -->
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label class="inline-flex items-start gap-2 text-sm text-slate-700">
            <input
              v-model="form.agree"
              type="checkbox"
              class="mt-1 size-4 border-slate-300 rounded text-orange-500 focus:ring-orange-500"
            >
            <span>
              <NuxtLink
                to="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                class="text-orange-700 font-semibold underline hover:text-orange-800"
              >
                プライバシーポリシー
              </NuxtLink>
              に同意し、入力した個人情報を予約・連絡のために利用することに同意します
            </span>
          </label>
          <p v-if="fieldErrors.agree" class="mt-1 text-xs text-red-600">
            {{ fieldErrors.agree }}
          </p>
          <p class="mt-2 text-xs text-slate-500">
            ※ お名前・電話番号・メールアドレスは暗号化（AES-256-GCM）して保存します
          </p>
        </div>

        <!-- 送信ボタン -->
        <button
          type="submit"
          :disabled="submitting"
          class="w-full py-3 text-base font-bold bg-orange-500 text-white rounded-md shadow-sm hover:bg-orange-600 disabled:bg-orange-300 transition"
        >
          {{ submitting ? '予約処理中...' : 'この内容で予約する' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <NuxtLink
          :to="`/reserve/${slug}/menu/${menuId}/datetime`"
          class="text-sm text-slate-600 hover:text-orange-700 inline-flex items-center gap-1"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" />
          日時の選択に戻る
        </NuxtLink>
      </div>
    </div>

    <UAlert
      v-else
      color="warning"
      icon="i-lucide-info"
      title="不正な URL です"
      description="予約フローの最初からやり直してください。"
    />
  </div>
</template>
