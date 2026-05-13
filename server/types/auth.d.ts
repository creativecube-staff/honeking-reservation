// nuxt-auth-utils のセッション型拡張。
// `useUserSession()` の `user` プロパティと、サーバー側 `getUserSession()` で参照される。
//
// 1 つの cookie 内で 2 種類のセッションを併存させる:
// - user        : 管理画面ユーザー（Practitioner.role 保持者）
// - member      : お客様会員（Customer 保有者）
// 両方同時にログイン可能（開発者が両方テストできるようにするため）。

import type { Permission, RoleName } from '~~/shared/permissions'

declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    displayName: string
    role: RoleName
    permissions: Permission[]
  }

  // 会員（お客様）セッション
  // 表示用に name を decryptUtf8 した値を保存。email は /api/member/me で必要時のみ復号する。
  interface UserSessionMember {
    id: number
    name: string
  }

  interface UserSession {
    loggedInAt?: string
    member?: UserSessionMember
    memberLoggedInAt?: string
  }
}

export {}
