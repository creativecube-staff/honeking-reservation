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

// 会員ログイン状態
// ログイン中なら DB の会員情報を使うため、name/phone/email は入力不要。
// ゲストの場合のみ既存フォームを表示する。
const { loggedIn, member } = useMember()

// ゲストモード: 未ログイン状態で「ゲストとして予約」を明示的に選択したら true。
// 初期は false で、まずは会員登録/ログインを促す方針。
const guestMode = ref(false)

// フォーム状態（ゲスト用フィールド + 共通の note）
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

  // 会員ログイン中は名前・電話・メアド・同意の検証をスキップ（サーバ側がセッションから取得）
  if (loggedIn.value && member.value) return true

  const name = form.name.trim()
  const phone = form.phone.trim()
  const email = form.email.trim()
  if (!name) {
    fieldErrors.name = 'お名前を入力してください'
  }
  if (!phone) {
    fieldErrors.phone = '電話番号を入力してください'
  }
  if (!email) {
    fieldErrors.email = 'メールアドレスを入力してください'
  }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    // 会員ログイン中はセッションから DB の暗号化済み情報を使うため、body の customer は
    // バリデーション通過用にセッションの member データを詰めて送る（サーバ側は無視）。
    const customerBody = loggedIn.value && member.value
      ? {
          name: member.value.name,
          phone: member.value.phone ?? '',
          email: member.value.email ?? '',
          note: form.note.trim() || undefined,
        }
      : {
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          note: form.note.trim() || undefined,
        }

    const result = await $fetch<{ confirmationCode: string }>('/api/reservations', {
      method: 'POST',
      body: {
        storeSlug: slug.value,
        menuId: menuId.value,
        startAt: startAtRaw.value,
        customer: customerBody,
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
        <!-- 会員ログイン中: プロフィール表示（読み取り専用） -->
        <div
          v-if="loggedIn && member"
          class="rounded-lg border-2 border-orange-300 bg-orange-50 p-4 space-y-2"
        >
          <div class="flex items-center gap-2 text-sm font-semibold text-orange-900 mb-1">
            <UIcon name="i-lucide-circle-user-round" class="size-5" />
            <span>会員情報を使用します</span>
          </div>
          <dl class="text-sm text-slate-700 space-y-1">
            <div class="flex gap-2">
              <dt class="w-20 shrink-0 text-slate-500">お名前</dt>
              <dd class="font-medium">{{ member.name }}</dd>
            </div>
            <div v-if="member.phone" class="flex gap-2">
              <dt class="w-20 shrink-0 text-slate-500">電話番号</dt>
              <dd class="tabular-nums">{{ member.phone }}</dd>
            </div>
            <div v-if="member.email" class="flex gap-2">
              <dt class="w-20 shrink-0 text-slate-500">メール</dt>
              <dd>{{ member.email }}</dd>
            </div>
          </dl>
        </div>

        <!-- 未ログイン: CTA + ゲスト切り替えリンク + (ゲスト選択時のみ)入力フォーム -->
        <template v-else>
          <!-- 大きく目立つ CTA バナー（ログイン / 新規会員登録） -->
          <div
            class="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-5 shadow-sm"
          >
            <div class="flex items-start gap-3 mb-4">
              <div class="size-10 shrink-0 rounded-full bg-orange-500 flex items-center justify-center">
                <UIcon name="i-lucide-sparkles" class="size-6 text-white" />
              </div>
              <div>
                <p class="text-base sm:text-lg font-bold text-slate-900 mb-0.5">
                  会員登録で簡単予約!
                </p>
                <p class="text-xs sm:text-sm text-slate-700">
                  次回からお名前・連絡先の入力が不要になります
                </p>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <NuxtLink
                :to="`/login?redirect=${$route.fullPath}`"
                class="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-md border border-orange-500 bg-white text-orange-700 font-semibold hover:bg-orange-50 transition text-sm sm:text-base"
              >
                <UIcon name="i-lucide-log-in" class="size-4" />
                ログイン
              </NuxtLink>
              <NuxtLink
                to="/signup"
                class="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-md bg-orange-500 text-white font-semibold hover:bg-orange-600 transition text-sm sm:text-base shadow-sm"
              >
                <UIcon name="i-lucide-user-plus" class="size-4" />
                新規会員登録
              </NuxtLink>
            </div>
          </div>

          <!-- 「ゲストで予約」リンク（控えめ表示）。クリックでフォーム展開 -->
          <div v-if="!guestMode" class="text-center">
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition"
              @click="guestMode = true"
            >
              会員登録せずにゲストとして予約する
            </button>
          </div>

          <!-- ゲストフォーム（guestMode 時のみ展開） -->
          <template v-if="guestMode">
            <div class="flex items-center justify-between text-sm text-slate-600 border-t border-slate-200 pt-4">
              <span class="font-semibold text-slate-700">
                <UIcon name="i-lucide-user" class="inline size-4 mr-1 align-text-bottom" />
                ゲストでの予約
              </span>
              <button
                type="button"
                class="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2"
                @click="guestMode = false"
              >
                やめる
              </button>
            </div>

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
                電話番号 <span class="text-red-600">*</span>
              </label>
              <input
                v-model="form.phone"
                type="tel"
                autocomplete="tel"
                required
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
                メールアドレス <span class="text-red-600">*</span>
              </label>
              <input
                v-model="form.email"
                type="email"
                autocomplete="email"
                required
                class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                :class="fieldErrors.email ? 'border-red-500' : ''"
                placeholder="example@example.com"
              >
              <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600">
                {{ fieldErrors.email }}
              </p>
            </div>
          </template>
        </template>

        <!-- 備考（会員・ゲスト共通） -->
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

        <!-- 同意（ゲスト選択時のみ。会員は登録時に同意済み） -->
        <div v-if="!loggedIn && guestMode" class="rounded-lg border border-slate-200 bg-slate-50 p-3">
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

        <!-- 送信ボタン: 会員ログイン中 or ゲスト選択中のときのみ表示 -->
        <button
          v-if="loggedIn || guestMode"
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
