-- スタッフ（Practitioner）にログイン情報・役職・権限を統合し、User テーブルを廃止する。
-- 既存 User データは事前に取り出してアプリ側で Practitioner として再投入する想定。
-- これ以降「ログイン可能ユーザー = Practitioner.canLogin = true」となる。

-- AlterTable
ALTER TABLE "Practitioner" ADD COLUMN     "canLogin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isAssignable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "role" "Role",
ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "username" TEXT;

-- DropTable
DROP TABLE "User";

-- CreateIndex
CREATE UNIQUE INDEX "Practitioner_username_key" ON "Practitioner"("username");
