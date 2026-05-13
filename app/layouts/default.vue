<script setup lang="ts">
const { loggedIn, member, logout } = useMember();
async function onLogout() {
  await logout();
  await navigateTo("/");
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-white">
    <header class="bg-[#fff3db] border-b-4 border-amber-300">
      <div
        class="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4"
      >
        <NuxtLink
          to="/"
          class="flex items-center gap-3 hover:opacity-80 transition"
        >
          <img
            src="https://honeking.jp/wp/wp-content/themes/honeking/assets/img/common/header-logo.svg"
            alt="ほねキング整骨院"
            class="h-10 sm:h-12 w-auto"
          />
          <span
            class="hidden sm:inline text-base sm:text-lg font-semibold text-slate-700"
          >
            予約システム
          </span>
        </NuxtLink>
        <div class="flex items-center gap-3 text-xs sm:text-sm">
          <template v-if="loggedIn && member">
            <NuxtLink
              to="/me"
              class="inline-flex items-center gap-1.5 text-slate-700 hover:text-orange-700 transition"
            >
              <UIcon
                name="i-lucide-circle-user-round"
                class="size-5 text-orange-500"
              />
              <span class="hidden sm:inline font-medium underline-offset-2 hover:underline"
                >{{ member.name }} 様</span
              >
            </NuxtLink>
            <button
              type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 hover:text-orange-700 text-xs sm:text-sm whitespace-nowrap transition"
              @click="onLogout"
            >
              <UIcon name="i-lucide-log-out" class="size-4" />
              <span>ログアウト</span>
            </button>
          </template>
          <template v-else>
            <NuxtLink
              to="/login"
              class="text-slate-700 hover:text-orange-600 whitespace-nowrap"
            >
              ログイン
            </NuxtLink>
            <NuxtLink
              to="/signup"
              class="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold whitespace-nowrap"
            >
              会員登録
            </NuxtLink>
          </template>
        </div>
      </div>
    </header>

    <main class="flex-1 bg-white">
      <slot />
    </main>

    <footer class="bg-white border-t-4 border-amber-300">
      <div
        class="mx-auto max-w-5xl px-4 sm:px-6 py-4 text-xs text-slate-600 flex flex-col sm:flex-row items-center justify-between gap-2"
      >
        <div class="flex flex-wrap items-center gap-4">
          <NuxtLink
            to="/terms"
            class="hover:text-orange-700 underline-offset-2 hover:underline"
          >
            会員規約
          </NuxtLink>
          <NuxtLink
            to="/privacy"
            class="hover:text-orange-700 underline-offset-2 hover:underline"
          >
            プライバシーポリシー
          </NuxtLink>
          <a
            href="https://honeking.jp/"
            target="_blank"
            rel="noopener"
            class="hover:text-orange-700 underline-offset-2 hover:underline whitespace-nowrap"
          >
            ほねキング整骨院
          </a>
        </div>
        <div>© ほねキング整骨院</div>
      </div>
    </footer>
  </div>
</template>
