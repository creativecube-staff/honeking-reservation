-- Practitioner（旧）を Staff（店舗で働く人）と Login（管理画面ログイン）の 2 テーブルに分離する。
-- 方針:
--  - Login: Practitioner.canLogin = true の行を id を保ったまま新 Login テーブルへ移行（既存ログイン維持）。
--  - Staff: 新規空テーブル。既存スタッフ（施術者）データは破棄。
--  - 既存予約・予約履歴・回数券消費は破棄（担当スタッフが消えるため）。
--  - ProductSale: reservationId はクリア、soldByPractitionerId は Login に存在する id だけ移行。
--  - CustomerVoucher: 残回数を totalUses に戻す（消費履歴を破棄したので未消費に戻す）。
--  - LoginHistory: practitionerId を loginId へリネーム、Login に無いものは NULL。

-- 1. 新テーブル Login を作成
CREATE TABLE "Login" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "displayName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "passwordEnc" TEXT,
    "role" "Role" NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "totpSecret" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Login_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Login_username_key" ON "Login"("username");
CREATE INDEX "Login_storeId_idx" ON "Login"("storeId");
ALTER TABLE "Login" ADD CONSTRAINT "Login_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. Practitioner で canLogin = true の行を Login に複製（id 維持）
INSERT INTO "Login" (
    "id", "storeId", "displayName", "username", "passwordHash", "passwordEnc",
    "role", "permissions", "totpSecret", "lastLoginAt", "isActive", "createdAt", "updatedAt"
)
SELECT
    "id", "storeId", "name", "username", "passwordHash", "passwordEnc",
    "role", "permissions", "totpSecret", "lastLoginAt", "isActive", "createdAt", "updatedAt"
FROM "Practitioner"
WHERE "canLogin" = TRUE
  AND "username" IS NOT NULL
  AND "passwordHash" IS NOT NULL
  AND "role" IS NOT NULL;

-- Login id シーケンスを Practitioner の最大 id+1 まで進める（後続の auto-increment 衝突回避）
SELECT setval(
    pg_get_serial_sequence('"Login"', 'id'),
    GREATEST(COALESCE((SELECT MAX("id") FROM "Login"), 0), 1)
);

-- 3. LoginHistory: practitionerId → loginId にリネーム + 値検証
-- 既存 FK / index を落として column rename → 整合性のないものは NULL に → 新 FK / index を張り直す
ALTER TABLE "LoginHistory" DROP CONSTRAINT IF EXISTS "LoginHistory_practitionerId_fkey";
DROP INDEX IF EXISTS "LoginHistory_practitionerId_createdAt_idx";
ALTER TABLE "LoginHistory" RENAME COLUMN "practitionerId" TO "loginId";
UPDATE "LoginHistory" SET "loginId" = NULL
    WHERE "loginId" IS NOT NULL AND "loginId" NOT IN (SELECT "id" FROM "Login");
CREATE INDEX "LoginHistory_loginId_createdAt_idx" ON "LoginHistory"("loginId", "createdAt");
ALTER TABLE "LoginHistory" ADD CONSTRAINT "LoginHistory_loginId_fkey"
    FOREIGN KEY ("loginId") REFERENCES "Login"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. ProductSale: soldByPractitionerId → soldByLoginId にリネーム + 値検証
ALTER TABLE "ProductSale" DROP CONSTRAINT IF EXISTS "ProductSale_soldByPractitionerId_fkey";
ALTER TABLE "ProductSale" RENAME COLUMN "soldByPractitionerId" TO "soldByLoginId";
-- 既存値が canLogin=false の Practitioner（=スタッフ）を指していた場合は Login に存在しないので NULL に
UPDATE "ProductSale" SET "soldByLoginId" = NULL
    WHERE "soldByLoginId" IS NOT NULL AND "soldByLoginId" NOT IN (SELECT "id" FROM "Login");
-- 既存予約紐付けは予約をこれから削除するためクリア
UPDATE "ProductSale" SET "reservationId" = NULL WHERE "reservationId" IS NOT NULL;
ALTER TABLE "ProductSale" ADD CONSTRAINT "ProductSale_soldByLoginId_fkey"
    FOREIGN KEY ("soldByLoginId") REFERENCES "Login"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. CustomerVoucher: 既存の消費履歴を破棄するため残回数を totalUses にリセット
UPDATE "CustomerVoucher" SET "remainingUses" = "totalUses";

-- 6. 予約・予約履歴・回数券消費はスタッフ消滅と同時に破棄（FK Restrict を回避）
DELETE FROM "VoucherUsage";
DELETE FROM "ReservationHistory";
DELETE FROM "Reservation";

-- 7. ReservationHistory: changedByPractitionerId → changedByLoginId, prev/newPractitionerId → prev/newStaffId にリネーム
-- （データは既に空なのでリネームのみ）
ALTER TABLE "ReservationHistory" RENAME COLUMN "changedByPractitionerId" TO "changedByLoginId";
ALTER TABLE "ReservationHistory" RENAME COLUMN "prevPractitionerId" TO "prevStaffId";
ALTER TABLE "ReservationHistory" RENAME COLUMN "newPractitionerId" TO "newStaffId";

-- 8. 新テーブル Staff を作成（既存スタッフは破棄するので空で開始）
CREATE TABLE "Staff" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "assignOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isAssignable" BOOLEAN NOT NULL DEFAULT true,
    "baseShiftDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Staff_storeId_idx" ON "Staff"("storeId");
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. Reservation: practitionerId 列を staffId に置き換え（既存行は削除済み）
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "no_double_booking_practitioner";
ALTER TABLE "Reservation" DROP CONSTRAINT IF EXISTS "Reservation_practitionerId_fkey";
DROP INDEX IF EXISTS "Reservation_practitionerId_startAt_idx";
ALTER TABLE "Reservation" DROP COLUMN "practitionerId";
ALTER TABLE "Reservation" ADD COLUMN "staffId" INTEGER NOT NULL;
CREATE INDEX "Reservation_staffId_startAt_idx" ON "Reservation"("staffId", "startAt");
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 10. EXCLUDE 制約を Staff 版で張り直し（同時刻に同スタッフへ重複予約を入れさせない）
ALTER TABLE "Reservation" ADD CONSTRAINT "no_double_booking_staff"
    EXCLUDE USING gist (
        "staffId" WITH =,
        tsrange("startAt", "endAt", '[)') WITH &&
    ) WHERE (status <> 'CANCELLED');

-- 11. Practitioner テーブルを破棄
DROP TABLE "Practitioner";
