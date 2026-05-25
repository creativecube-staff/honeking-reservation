<script setup lang="ts">
// 予約フロー(SPA)中にログイン/新規登録するためのモーダル。
// 別ページに遷移しないので SPA ステート(選択中メニュー・日時)が保持される。

interface Props {
  open: boolean
  initialTab?: 'login' | 'signup'
  // LINE Login 後に予約フロー SPA を復元するための情報。
  // 渡された場合、LINE ボタン押下時に sessionStorage に保存して、
  // 認証完了後 /[slug] に戻ったとき onMounted で確認ステップまでジャンプする。
  resumeState?: {
    slug: string
    menuId: number
    startAt: string // "YYYY-MM-DDTHHMM"
  } | null
}
const props = withDefaults(defineProps<Props>(), { initialTab: 'login', resumeState: null })

// 予約フロー復元用 sessionStorage キー（[slug]/index.vue 側で同じキーを参照）
const RESUME_KEY = 'honeking_pending_reservation'

const liff = useLiff()
const router = useRouter()
const { refresh: refreshMemberForLiff } = useMember()
const lineProcessing = ref(false)
const lineError = ref<string | null>(null)

/** LINE ログイン開始。LIFF webview なら SDK 経由(リダイレクトなし)、
 *  PC ブラウザ等は従来の OAuth リダイレクトに自動フォールバック。 */
async function goLineLogin() {
  if (!import.meta.client) return
  if (lineProcessing.value) return
  lineError.value = null

  // 予約フロー復元用ステートを sessionStorage に保存(OAuth リダイレクト経由でも復帰できるように)
  if (props.resumeState) {
    try {
      sessionStorage.setItem(RESUME_KEY, JSON.stringify({
        ...props.resumeState,
        savedAt: Date.now(),
      }))
    }
    catch {
      // sessionStorage 無効でも続行
    }
  }
  const redirectPath = props.resumeState ? `/${props.resumeState.slug}` : '/'

  // LIFF SDK が利用可能なら、webview/PC 問わず liff.login() に任せる(SDK が最適な動作を選ぶ)
  const liffOk = await liff.isReady()
  if (liffOk) {
    lineProcessing.value = true
    try {
      const loggedIn = await liff.isLoggedIn()
      if (!loggedIn) {
        // SDK が webview なら内部完結、外部ブラウザなら OAuth リダイレクト。
        // どちらの場合も、戻ってきたら自動で isLoggedIn() = true になる。
        // redirectUri は LIFF の Endpoint URL と同じオリジンの絶対 URL を指定。
        const origin = window.location.origin
        await liff.login({ redirectUri: `${origin}${redirectPath}` })
        // redirect する場合はこの行に到達しない
        return
      }
      const idToken = await liff.getIdToken()
      if (!idToken) {
        // LIFF からは login したのに id_token が無い場合のフォールバック
        lineProcessing.value = false
        window.location.href = `/api/auth/line/start?redirect=${encodeURIComponent(redirectPath)}`
        return
      }
      const res = await $fetch<{ status: 'logged-in' | 'need-link' | 'need-signup' | 'linked' | 'conflict' }>(
        '/api/auth/line/liff-login',
        {
          method: 'POST',
          body: { idToken, redirectAfter: redirectPath },
        },
      )
      if (res.status === 'logged-in' || res.status === 'linked') {
        await refreshMemberForLiff()
        emit('logged-in')
        close()
        return
      }
      if (res.status === 'need-link') {
        await router.push('/auth/line/link')
        return
      }
      if (res.status === 'need-signup') {
        await router.push('/auth/line/signup')
        return
      }
      if (res.status === 'conflict') {
        lineError.value = 'この LINE アカウントは別の会員に既に連携されています。'
      }
    }
    catch (e) {
      console.error('[AuthModal] LIFF login flow failed:', (e as Error).message)
      // SDK 経由がダメだった場合の最後の保険として OAuth リダイレクトに逃がす
      window.location.href = `/api/auth/line/start?redirect=${encodeURIComponent(redirectPath)}`
      return
    }
    finally {
      lineProcessing.value = false
    }
    return
  }

  // LIFF が使えない(LIFF_ID 未設定など)→ 従来の OAuth リダイレクト
  window.location.href = `/api/auth/line/start?redirect=${encodeURIComponent(redirectPath)}`
}

const emit = defineEmits<{
  'update:open': [value: boolean]
  // ログイン成功時に親へ通知(親が画面を再描画して会員モードに切り替える)
  'logged-in': []
}>()

const { refresh: refreshMember } = useMember()

const activeTab = ref<'login' | 'signup'>(props.initialTab)
// open される度に initialTab を反映(別ボタンから開かれたとき用)
watch(() => props.open, (v) => {
  if (v) {
    activeTab.value = props.initialTab
    loginError.value = null
    signupError.value = null
    signupSent.value = false
  }
})

function close() {
  emit('update:open', false)
}

// ESC キーで閉じる
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) close()
}
onMounted(() => {
  if (import.meta.client) window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKeydown)
})

// === ログインフォーム ===
const loginForm = reactive({ email: '', password: '' })
const loginFieldErrors = reactive<Record<string, string>>({})
const loginError = ref<string | null>(null)
const loginSubmitting = ref(false)

function validateLogin(): boolean {
  for (const k of Object.keys(loginFieldErrors)) delete loginFieldErrors[k]
  if (!loginForm.email.trim()) loginFieldErrors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email.trim())) loginFieldErrors.email = 'メールアドレスの形式が正しくありません'
  if (!loginForm.password) loginFieldErrors.password = 'パスワードを入力してください'
  return Object.keys(loginFieldErrors).length === 0
}

async function onLogin() {
  if (loginSubmitting.value) return
  if (!validateLogin()) return
  loginSubmitting.value = true
  loginError.value = null
  try {
    await $fetch('/api/member/login', {
      method: 'POST',
      body: { email: loginForm.email.trim(), password: loginForm.password },
    })
    await refreshMember()
    emit('logged-in')
    close()
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    loginError.value = err.data?.statusMessage || err.statusMessage || 'ログインに失敗しました'
  }
  finally {
    loginSubmitting.value = false
  }
}

// === 新規登録フォーム ===
const signupForm = reactive({
  name: '',
  phone: '',
  email: '',
  password: '',
  passwordConfirm: '',
  agreeTerms: false,
})
const signupFieldErrors = reactive<Record<string, string>>({})
const signupError = ref<string | null>(null)
const signupSubmitting = ref(false)
const signupSent = ref(false)

function validateSignup(): boolean {
  for (const k of Object.keys(signupFieldErrors)) delete signupFieldErrors[k]
  if (!signupForm.name.trim()) signupFieldErrors.name = 'お名前を入力してください'
  if (!signupForm.phone.trim()) signupFieldErrors.phone = '電話番号を入力してください'
  if (!signupForm.email.trim()) signupFieldErrors.email = 'メールアドレスを入力してください'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupForm.email.trim())) signupFieldErrors.email = 'メールアドレスの形式が正しくありません'
  if (!signupForm.password) signupFieldErrors.password = 'パスワードを入力してください'
  else if (signupForm.password.length < 8) signupFieldErrors.password = 'パスワードは 8 文字以上で入力してください'
  if (signupForm.password && signupForm.passwordConfirm !== signupForm.password) {
    signupFieldErrors.passwordConfirm = 'パスワード(確認)が一致しません'
  }
  if (!signupForm.agreeTerms) signupFieldErrors.agreeTerms = '会員規約とプライバシーポリシーへの同意が必要です'
  return Object.keys(signupFieldErrors).length === 0
}

async function onSignup() {
  if (signupSubmitting.value) return
  if (!validateSignup()) return
  signupSubmitting.value = true
  signupError.value = null
  try {
    await $fetch('/api/member/signup', {
      method: 'POST',
      body: {
        email: signupForm.email.trim(),
        password: signupForm.password,
        name: signupForm.name.trim(),
        phone: signupForm.phone.trim(),
        agreeTerms: true,
      },
    })
    signupSent.value = true
  }
  catch (e) {
    const err = e as { statusMessage?: string, data?: { statusMessage?: string } }
    signupError.value = err.data?.statusMessage || err.statusMessage || '会員登録に失敗しました'
  }
  finally {
    signupSubmitting.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="close"
      >
        <Transition
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          appear
        >
          <div
            class="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
          >
            <!-- ヘッダー(タブ + 閉じる) -->
            <div class="sticky top-0 bg-white border-b border-slate-200 z-10">
              <div class="flex items-center justify-between px-4 pt-3">
                <div class="flex gap-1">
                  <button
                    type="button"
                    :class="[
                      'px-3 py-1.5 text-sm font-semibold rounded-t-md transition cursor-pointer',
                      activeTab === 'login' ? 'text-orange-700 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-700',
                    ]"
                    @click="activeTab = 'login'"
                  >
                    ログイン
                  </button>
                  <button
                    type="button"
                    :class="[
                      'px-3 py-1.5 text-sm font-semibold rounded-t-md transition cursor-pointer',
                      activeTab === 'signup' ? 'text-orange-700 border-b-2 border-orange-500' : 'text-slate-500 hover:text-slate-700',
                    ]"
                    @click="activeTab = 'signup'"
                  >
                    新規会員登録
                  </button>
                </div>
                <button
                  type="button"
                  class="p-1.5 -mr-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  aria-label="閉じる"
                  @click="close"
                >
                  <UIcon name="i-lucide-x" class="size-5" />
                </button>
              </div>
            </div>

            <!-- LINE で続行(両タブ共通の最上部) -->
            <div class="px-5 pt-4">
              <UAlert
                v-if="lineError"
                color="error"
                icon="i-lucide-triangle-alert"
                :title="lineError"
                class="mb-3"
              />
              <button
                type="button"
                :disabled="lineProcessing"
                class="w-full inline-flex items-center justify-center gap-2 py-3 text-base font-bold text-white bg-[#06C755] hover:bg-[#05a647] disabled:opacity-60 rounded-lg shadow-sm transition cursor-pointer"
                @click="goLineLogin"
              >
                <svg viewBox="0 0 24 24" class="size-5" fill="currentColor" aria-hidden="true">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
                </svg>
                {{ activeTab === 'login' ? 'LINE でログイン' : 'LINE で登録' }}
              </button>
              <div class="flex items-center gap-3 my-3">
                <div class="flex-1 h-px bg-slate-200" />
                <span class="text-xs text-slate-500">または</span>
                <div class="flex-1 h-px bg-slate-200" />
              </div>
            </div>

            <!-- ログインタブ -->
            <div v-if="activeTab === 'login'" class="p-5 pt-0">
              <p class="text-sm text-slate-600 mb-4">
                会員登録時のメールアドレスとパスワードを入力してください。
              </p>

              <form class="space-y-4" @submit.prevent="onLogin">
                <UAlert
                  v-if="loginError"
                  color="error"
                  icon="i-lucide-triangle-alert"
                  :title="loginError"
                />

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    メールアドレス
                  </label>
                  <input
                    v-model="loginForm.email"
                    type="email"
                    autocomplete="email"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                  <p v-if="loginFieldErrors.email" class="mt-1 text-xs text-red-600">
                    {{ loginFieldErrors.email }}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    パスワード
                  </label>
                  <input
                    v-model="loginForm.password"
                    type="password"
                    autocomplete="current-password"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                  <p v-if="loginFieldErrors.password" class="mt-1 text-xs text-red-600">
                    {{ loginFieldErrors.password }}
                  </p>
                </div>

                <button
                  type="submit"
                  :disabled="loginSubmitting"
                  class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition cursor-pointer"
                >
                  {{ loginSubmitting ? 'ログイン中…' : 'ログイン' }}
                </button>

                <div class="text-center text-xs text-slate-600 space-y-1 mt-3">
                  <p>
                    パスワードをお忘れの方は
                    <NuxtLink to="/password-reset" class="text-orange-700 font-semibold underline hover:text-orange-800" target="_blank" rel="noopener">
                      こちら
                    </NuxtLink>
                  </p>
                  <p>
                    メールアドレスをお忘れの方は
                    <NuxtLink to="/forgot-email" class="text-orange-700 font-semibold underline hover:text-orange-800" target="_blank" rel="noopener">
                      こちら
                    </NuxtLink>
                  </p>
                </div>
              </form>
            </div>

            <!-- 新規登録タブ -->
            <div v-else class="p-5 pt-0">
              <!-- 送信完了表示 -->
              <div v-if="signupSent" class="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 text-center">
                <UIcon name="i-lucide-mail-check" class="size-10 text-orange-600 mx-auto mb-2" />
                <h3 class="text-base font-bold text-slate-900 mb-2">
                  確認メールを送信しました
                </h3>
                <p class="text-sm text-slate-700 leading-relaxed">
                  入力いただいたメールアドレス宛に確認メールをお送りしました。<br>
                  24 時間以内にメール内のリンクをクリックして、会員登録を完了してください。
                </p>
                <p class="mt-3 text-xs text-slate-500">
                  ※ メール認証完了までは、このまま<strong>ゲストとしてご予約</strong>を続けることもできます。
                </p>
                <button
                  type="button"
                  class="inline-block mt-4 text-sm text-orange-700 underline hover:text-orange-800 cursor-pointer"
                  @click="close"
                >
                  閉じる
                </button>
              </div>

              <!-- 登録フォーム -->
              <form v-else class="space-y-3" @submit.prevent="onSignup">
                <p class="text-sm text-slate-600">
                  会員になると次回からお名前・連絡先の入力が不要になります。
                </p>

                <UAlert
                  v-if="signupError"
                  color="error"
                  icon="i-lucide-triangle-alert"
                  :title="signupError"
                />

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    お名前 <span class="text-red-600">*</span>
                  </label>
                  <input
                    v-model="signupForm.name"
                    type="text"
                    autocomplete="name"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="山田 太郎"
                  >
                  <p v-if="signupFieldErrors.name" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.name }}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    電話番号 <span class="text-red-600">*</span>
                  </label>
                  <input
                    v-model="signupForm.phone"
                    type="tel"
                    autocomplete="tel"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    placeholder="090-1234-5678"
                  >
                  <p v-if="signupFieldErrors.phone" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.phone }}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    メールアドレス <span class="text-red-600">*</span>
                  </label>
                  <input
                    v-model="signupForm.email"
                    type="email"
                    autocomplete="email"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                  <p v-if="signupFieldErrors.email" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.email }}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    パスワード <span class="text-red-600">*</span>
                    <span class="ml-1 text-xs font-normal text-slate-500">(8 文字以上)</span>
                  </label>
                  <input
                    v-model="signupForm.password"
                    type="password"
                    autocomplete="new-password"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                  <p v-if="signupFieldErrors.password" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.password }}
                  </p>
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1">
                    パスワード(確認) <span class="text-red-600">*</span>
                  </label>
                  <input
                    v-model="signupForm.passwordConfirm"
                    type="password"
                    autocomplete="new-password"
                    required
                    class="w-full px-3 py-2 text-base border border-slate-300 rounded-md focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  >
                  <p v-if="signupFieldErrors.passwordConfirm" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.passwordConfirm }}
                  </p>
                </div>

                <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label class="inline-flex items-start gap-2 text-sm text-slate-700">
                    <input
                      v-model="signupForm.agreeTerms"
                      type="checkbox"
                      class="mt-1 size-4 border-slate-300 rounded text-orange-500 focus:ring-orange-500"
                    >
                    <span>
                      <NuxtLink to="/terms" target="_blank" rel="noopener noreferrer" class="text-orange-700 font-semibold underline hover:text-orange-800">
                        会員規約
                      </NuxtLink>
                      と
                      <NuxtLink to="/privacy" target="_blank" rel="noopener noreferrer" class="text-orange-700 font-semibold underline hover:text-orange-800">
                        プライバシーポリシー
                      </NuxtLink>
                      に同意します
                    </span>
                  </label>
                  <p v-if="signupFieldErrors.agreeTerms" class="mt-1 text-xs text-red-600">
                    {{ signupFieldErrors.agreeTerms }}
                  </p>
                </div>

                <button
                  type="submit"
                  :disabled="signupSubmitting"
                  class="w-full py-3 text-base font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-slate-300 rounded-md transition cursor-pointer"
                >
                  {{ signupSubmitting ? '送信中…' : '確認メールを送信' }}
                </button>
              </form>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
