<script setup lang="ts">
// 予約フロー(SPA) ステップ 3/3: 顧客情報・確認
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

interface Props {
  store: Store
  menu: Menu
  startAt: string // "YYYY-MM-DDTHHMM"
}
const props = defineProps<Props>()

const emit = defineEmits<{
  submitted: [code: string]
  back: []
}>()

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

const parsedStart = computed(() => {
  const s = props.startAt
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
  if (!p) return ''
  const total = p.hh * 60 + p.mm + props.menu.durationMinutes
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
const { loggedIn, member } = useMember()

// ゲストモード
const guestMode = ref(false)

// 認証モーダル
const authModalOpen = ref(false)
const authModalTab = ref<'login' | 'signup'>('login')

function openAuthModal(tab: 'login' | 'signup') {
  authModalTab.value = tab
  authModalOpen.value = true
}

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

const route = useRoute()

async function onSubmit() {
  if (submitting.value) return
  if (!validate()) return
  submitting.value = true
  errorMessage.value = null
  try {
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
        storeSlug: props.store.slug,
        menuId: props.menu.id,
        startAt: props.startAt,
        customer: customerBody,
      },
    })
    emit('submitted', result.confirmationCode)
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
  <div>
    <!-- 中央寄せ見出し(MenuStep / DateTimeStep と同パターン)を最上部に -->
    <div class="text-center mb-6">
      <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
        ご予約内容を<br class="sm:hidden"><span class="text-orange-600">ご確認</span>ください
      </h1>
      <p class="mt-3 inline-flex items-center gap-1.5 text-xs sm:text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-full px-3.5 py-1.5">
        <UIcon name="i-lucide-check-circle-2" class="shrink-0 w-3.5 h-3.5 text-orange-600" />
        下記情報をご入力のうえ「予約する」を押して確定します
      </p>
      <div class="mt-4 flex justify-center">
        <UIcon name="i-lucide-chevron-down" class="w-6 h-6 text-orange-500 animate-bounce" />
      </div>
    </div>

    <!-- 予約内容ストリップ(見出しの下に配置) -->
    <!-- 店舗 -->
    <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-store" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご予約中の店舗</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ store.name }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-xs sm:text-sm text-slate-700 leading-tight">{{ store.prefecture }}{{ store.city }}</p>
      </div>
    </div>

    <!-- メニュー -->
    <div class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-3">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-list" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">選択中のメニュー</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ menu.name }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-base sm:text-lg font-extrabold text-orange-600 tabular-nums leading-none">
          ¥{{ yen(menu.priceJpy) }}
        </p>
        <p class="text-[10px] sm:text-xs text-slate-500 mt-0.5">{{ duration(menu.durationMinutes) }}</p>
      </div>
    </div>

    <div v-if="parsedStart" class="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 mb-6">
      <div class="flex items-center gap-2 min-w-0">
        <UIcon name="i-lucide-calendar" class="size-4 sm:size-5 text-orange-600 shrink-0" />
        <div class="min-w-0">
          <p class="text-[10px] sm:text-xs text-slate-500 leading-tight">ご予約日時</p>
          <p class="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">{{ dateLabel }}</p>
        </div>
      </div>
      <div class="shrink-0 text-right">
        <p class="text-base sm:text-lg font-extrabold text-orange-600 tabular-nums leading-none">
          {{ parsedStart.time }}〜{{ endTimeLabel }}
        </p>
      </div>
    </div>

    <!-- お客様情報セクション以下は読みやすい幅(max-w-lg)で中央寄せ -->
    <div class="max-w-lg mx-auto">
      <UAlert
        v-if="errorMessage"
        color="error"
        icon="i-lucide-triangle-alert"
        :title="errorMessage"
        class="mb-4"
      />

      <h2 class="text-lg sm:text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <UIcon name="i-lucide-user-round" class="size-5 sm:size-6 text-orange-600" />
        お客様情報
      </h2>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <!-- 会員ログイン中: プロフィール表示(読み取り専用) -->
        <div
          v-if="loggedIn && member"
          class="rounded-xl border-2 border-orange-300 bg-orange-50 p-4 sm:p-5"
        >
          <div class="flex items-center gap-2 text-sm font-bold text-orange-900 mb-3">
            <UIcon name="i-lucide-badge-check" class="size-5 text-orange-600" />
            <span>会員情報を使用します</span>
          </div>
          <dl class="text-sm text-slate-700 space-y-2.5">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-user" class="size-4 text-slate-400 shrink-0" />
              <dd class="font-medium">{{ member.name }}</dd>
            </div>
            <div v-if="member.phone" class="flex items-center gap-3">
              <UIcon name="i-lucide-phone" class="size-4 text-slate-400 shrink-0" />
              <dd class="tabular-nums">{{ member.phone }}</dd>
            </div>
            <div v-if="member.email" class="flex items-center gap-3 min-w-0">
              <UIcon name="i-lucide-mail" class="size-4 text-slate-400 shrink-0" />
              <dd class="truncate">{{ member.email }}</dd>
            </div>
          </dl>
        </div>

        <!-- 未ログイン: CTA + ゲスト切り替えリンク + (ゲスト選択時のみ)入力フォーム -->
        <template v-else>
          <div
            class="rounded-xl border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 p-4 sm:p-5 shadow-sm"
          >
            <div class="flex items-start gap-3 mb-4">
              <div class="size-10 shrink-0 rounded-full bg-orange-500 flex items-center justify-center">
                <UIcon name="i-lucide-sparkles" class="size-6 text-white" />
              </div>
              <div class="min-w-0">
                <p class="text-base sm:text-lg font-bold text-slate-900 mb-0.5">
                  会員登録で簡単予約!
                </p>
                <p class="text-xs sm:text-sm text-slate-700">
                  次回からお名前・連絡先の入力が不要になります
                </p>
              </div>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                class="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-md border border-orange-500 bg-white text-orange-700 font-semibold hover:bg-orange-50 transition text-sm sm:text-base cursor-pointer"
                @click="openAuthModal('login')"
              >
                <UIcon name="i-lucide-log-in" class="size-4" />
                ログイン
              </button>
              <button
                type="button"
                class="flex-1 inline-flex items-center justify-center gap-1 px-4 py-2.5 rounded-md bg-orange-500 text-white font-semibold hover:bg-orange-600 transition text-sm sm:text-base shadow-sm cursor-pointer"
                @click="openAuthModal('signup')"
              >
                <UIcon name="i-lucide-user-plus" class="size-4" />
                新規会員登録
              </button>
            </div>
          </div>

          <div v-if="!guestMode" class="text-center">
            <button
              type="button"
              class="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 transition cursor-pointer"
              @click="guestMode = true"
            >
              会員登録せずにゲストとして予約する
            </button>
          </div>

          <template v-if="guestMode">
            <div class="flex items-center justify-between text-sm border-t border-slate-200 pt-4">
              <span class="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                <UIcon name="i-lucide-user" class="size-4 text-orange-600" />
                ゲストでの予約
              </span>
              <button
                type="button"
                class="text-xs text-slate-500 hover:text-slate-700 underline underline-offset-2 cursor-pointer"
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
              <div class="relative">
                <UIcon name="i-lucide-user" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <input
                  v-model="form.name"
                  type="text"
                  autocomplete="name"
                  required
                  class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
                  :class="fieldErrors.name ? 'border-red-500' : ''"
                  placeholder="山田 太郎"
                >
              </div>
              <p v-if="fieldErrors.name" class="mt-1 text-xs text-red-600">
                {{ fieldErrors.name }}
              </p>
            </div>

            <!-- 電話番号 -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                電話番号 <span class="text-red-600">*</span>
              </label>
              <div class="relative">
                <UIcon name="i-lucide-phone" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <input
                  v-model="form.phone"
                  type="tel"
                  autocomplete="tel"
                  required
                  class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
                  :class="fieldErrors.phone ? 'border-red-500' : ''"
                  placeholder="090-1234-5678"
                >
              </div>
              <p v-if="fieldErrors.phone" class="mt-1 text-xs text-red-600">
                {{ fieldErrors.phone }}
              </p>
            </div>

            <!-- メールアドレス -->
            <div>
              <label class="block text-sm font-semibold text-slate-700 mb-1">
                メールアドレス <span class="text-red-600">*</span>
              </label>
              <div class="relative">
                <UIcon name="i-lucide-mail" class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
                <input
                  v-model="form.email"
                  type="email"
                  autocomplete="email"
                  required
                  class="w-full pl-9 pr-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
                  :class="fieldErrors.email ? 'border-red-500' : ''"
                  placeholder="example@example.com"
                >
              </div>
              <p v-if="fieldErrors.email" class="mt-1 text-xs text-red-600">
                {{ fieldErrors.email }}
              </p>
            </div>
          </template>
        </template>

        <!-- 備考 -->
        <div>
          <label class="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-1">
            <UIcon name="i-lucide-message-square" class="size-4 text-slate-500" />
            ご要望・お困りの症状など
            <span class="text-xs font-normal text-slate-500">(任意)</span>
          </label>
          <textarea
            v-model="form.note"
            rows="3"
            class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 bg-white"
            placeholder="腰痛が気になります、など"
          />
        </div>

        <!-- プライバシーポリシー同意(ゲスト時のみ) -->
        <div v-if="!loggedIn && guestMode" class="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
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
          <p class="mt-2 text-xs text-slate-500 inline-flex items-center gap-1">
            <UIcon name="i-lucide-shield-check" class="size-3.5 text-slate-400" />
            お名前・電話番号・メールアドレスは暗号化(AES-256-GCM)して保存します
          </p>
        </div>

        <!-- 送信ボタン -->
        <button
          v-if="loggedIn || guestMode"
          type="submit"
          :disabled="submitting"
          class="w-full inline-flex items-center justify-center gap-2 py-3.5 text-base font-bold bg-orange-500 text-white rounded-lg shadow-sm hover:bg-orange-600 disabled:bg-orange-300 transition cursor-pointer"
        >
          <UIcon
            :name="submitting ? 'i-lucide-loader-2' : 'i-lucide-check-circle-2'"
            class="size-5"
            :class="submitting ? 'animate-spin' : ''"
          />
          {{ submitting ? '予約処理中...' : 'この内容で予約する' }}
        </button>
      </form>
    </div>

    <!-- 認証モーダル(ログイン / 新規登録 / LINE) -->
    <!-- resume-state を渡すと LINE ボタン押下時に予約フローへの復帰用 sessionStorage を保存する -->
    <AuthModal
      v-model:open="authModalOpen"
      :initial-tab="authModalTab"
      :resume-state="{
        slug: store.slug,
        menuId: menu.id,
        startAt: startAt,
      }"
    />
  </div>
</template>
