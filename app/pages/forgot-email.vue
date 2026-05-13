<script setup lang="ts">
// メールアドレスを忘れた方への案内ページ
//
// セキュリティ上、メアドを Web 経由で「電話番号で照会 → 表示」する仕組みは設けていない
// （第三者が他人の電話番号を入力してメアドを盗める脆弱性を作らないため）。
// 店舗での本人確認による対応に誘導する。

useHead({ title: 'メールアドレスをお忘れの方 | ほねキング整骨院 予約' })

type Store = {
  id: number
  slug: string
  prefecture: string
  city: string
  name: string
  address: string
  phone: string | null
}

const { data: stores } = await useFetch<Store[]>('/api/stores')
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 sm:px-6 py-10">
    <h1 class="text-2xl font-bold text-slate-900 mb-2">
      メールアドレスをお忘れの方
    </h1>
    <p class="text-sm text-slate-600 mb-6">
      ご登録のメールアドレスは、セキュリティ保護のため Web 上から再表示することができません。<br>
      お手数ですが、下記店舗までお電話ください。
    </p>

    <!-- 店舗での対応案内 -->
    <div class="rounded-xl border-2 border-orange-300 bg-orange-50 p-5 mb-6">
      <h2 class="text-base sm:text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
        <UIcon name="i-lucide-phone" class="size-5 text-orange-600" />
        お電話でのご案内手順
      </h2>
      <ol class="list-decimal list-inside space-y-2 text-sm text-slate-700">
        <li>下記いずれかの店舗にお電話ください</li>
        <li>受付スタッフが <span class="font-semibold">お名前 + 電話番号</span> で本人確認させていただきます</li>
        <li>確認できましたら、ご登録のメールアドレスを口頭でお伝えします</li>
        <li>メールアドレスがわかりましたら、改めてログイン画面からご利用ください</li>
      </ol>
      <p class="mt-3 text-xs text-slate-600">
        ※ パスワードもお忘れの場合は、メールアドレス確認後に
        <NuxtLink to="/password-reset" class="text-orange-700 underline hover:text-orange-800">
          パスワード再設定
        </NuxtLink>
        をご利用ください。
      </p>
    </div>

    <!-- 店舗一覧 -->
    <h2 class="text-base font-bold text-slate-900 mb-3">
      店舗一覧
    </h2>
    <div class="space-y-3 mb-8">
      <div
        v-for="store in stores ?? []"
        :key="store.id"
        class="rounded-lg border border-slate-200 bg-white p-4 hover:border-orange-300 transition"
      >
        <p class="text-base font-bold text-slate-900">
          {{ store.name }}
        </p>
        <p class="text-xs text-slate-500 mt-0.5">
          {{ store.prefecture }} {{ store.city }}
        </p>
        <p class="text-sm text-slate-700 mt-1">
          {{ store.address }}
        </p>
        <a
          v-if="store.phone"
          :href="`tel:${store.phone.replace(/[^\d+]/g, '')}`"
          class="inline-flex items-center gap-2 mt-3 px-3 py-2 rounded-md bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition"
        >
          <UIcon name="i-lucide-phone" class="size-4" />
          {{ store.phone }}
        </a>
        <p v-else class="text-xs text-slate-500 mt-2">
          電話番号は未登録です
        </p>
      </div>
    </div>

    <div class="border-t border-slate-200 pt-6 text-center text-sm">
      <NuxtLink to="/login" class="text-orange-700 font-semibold underline hover:text-orange-800">
        ← ログイン画面に戻る
      </NuxtLink>
    </div>
  </div>
</template>
