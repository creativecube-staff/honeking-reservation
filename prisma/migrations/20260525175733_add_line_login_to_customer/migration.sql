-- AlterTable: Customer に LINE 連携用カラムを追加。
-- lineUserId: LINE Login で取得できるユーザー固有 ID（"U" 始まり 33 文字）。1 顧客 = 0 or 1 LINE アカウント。
-- lineDisplayName: 連携時点の LINE プロフィール表示名（マイページ「LINE と連携中」表記用）。
-- 既存 Customer はすべて NULL になるため、unique 制約も既存データ無影響で追加可能。

ALTER TABLE "Customer"
  ADD COLUMN "lineUserId" TEXT,
  ADD COLUMN "lineDisplayName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_lineUserId_key" ON "Customer"("lineUserId");
