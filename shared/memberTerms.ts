// 会員規約・プライバシーポリシーのバージョン定数。
// app/pages/terms.vue と app/pages/privacy.vue で公開してる内容と同じバージョンを指す。
// 規約改定時は両方のページのバージョン表記とこの定数を一緒に更新する。
// 会員登録時に Customer.termsVersionAgreedAt に保存する。
export const MEMBER_TERMS_VERSION = 'v1.1-2026-05-25'
