<template>
  <div class="min-h-screen flex flex-col bg-white">
    <header class="bg-[#fff3db] border-b-4 border-amber-300">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="flex items-center gap-3 hover:opacity-80 transition">
          <img
            src="https://honeking.jp/wp/wp-content/themes/honeking/assets/img/common/header-logo.svg"
            alt="ほねキング整骨院"
            class="h-10 sm:h-12 w-auto"
          >
          <span class="hidden sm:inline text-base sm:text-lg font-semibold text-slate-700">
            予約システム
          </span>
        </NuxtLink>
        <a
          href="https://honeking.jp/"
          target="_blank"
          rel="noopener"
          class="text-xs sm:text-sm text-slate-700 hover:text-orange-600 whitespace-nowrap"
        >
          本サイトへ →
        </a>
      </div>
    </header>

    <main class="flex-1 bg-white">
      <slot />
    </main>

    <footer class="bg-white border-t-4 border-amber-300">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 py-4 text-xs text-slate-600 text-center">
        © ほねキング整骨院
      </div>
    </footer>
  </div>
</template>
