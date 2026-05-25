// 会員（お客様）セッション情報のクライアント側コンポーザブル。
// /api/member/me を SWR で参照し、ログイン状態と簡易プロフィールを返す。

type MemberMe = {
  loggedIn: boolean
  member: {
    id: number
    name: string
    phone: string | null
    email: string | null
    lastLoginAt: string | null
    lineLinked: boolean
    lineDisplayName: string | null
  } | null
}

export function useMember() {
  const { data, refresh, pending } = useFetch<MemberMe>('/api/member/me', {
    key: 'member-me',
    default: () => ({ loggedIn: false, member: null }),
  })

  const loggedIn = computed(() => !!data.value?.loggedIn)
  const member = computed(() => data.value?.member ?? null)

  async function logout() {
    await $fetch('/api/member/logout', { method: 'POST' })
    await refresh()
  }

  return {
    loggedIn,
    member,
    pending,
    refresh,
    logout,
  }
}
