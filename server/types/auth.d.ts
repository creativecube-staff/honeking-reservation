// nuxt-auth-utils のセッション型拡張。
// `useUserSession()` の `user` プロパティと、サーバー側 `getUserSession()` で参照される。

import type { Permission, RoleName } from '~~/shared/permissions'

declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    displayName: string
    role: RoleName
    permissions: Permission[]
  }

  interface UserSession {
    loggedInAt: string
  }
}

export {}
