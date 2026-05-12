-- COMPLETED ステータスを enum から削除する。
-- 「完了」はアプリ層で「CONFIRMED かつ終了時刻が過去」と自動判定する設計に切り替える。
-- shared/reservationStatus.ts の displayStatus を参照。
--
-- EXCLUDE 制約 (no_double_booking_bed / no_double_booking_practitioner) は
-- status 列の型に紐づいているため、型変更前後に drop / re-create が必要。

-- Step A: 既存 COMPLETED データを CONFIRMED に戻す
UPDATE "Reservation" SET status = 'CONFIRMED' WHERE status = 'COMPLETED';
UPDATE "ReservationHistory" SET "prevStatus" = 'CONFIRMED' WHERE "prevStatus" = 'COMPLETED';
UPDATE "ReservationHistory" SET "newStatus" = 'CONFIRMED' WHERE "newStatus" = 'COMPLETED';

-- Step B: EXCLUDE 制約を一旦削除（型変更のため）
ALTER TABLE "Reservation" DROP CONSTRAINT "no_double_booking_bed";
ALTER TABLE "Reservation" DROP CONSTRAINT "no_double_booking_practitioner";

-- Step C: enum を COMPLETED なしで再定義
ALTER TYPE "ReservationStatus" RENAME TO "ReservationStatus_old";
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'NO_SHOW');

ALTER TABLE "Reservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Reservation" ALTER COLUMN "status" TYPE "ReservationStatus" USING "status"::text::"ReservationStatus";
ALTER TABLE "Reservation" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';

ALTER TABLE "ReservationHistory" ALTER COLUMN "prevStatus" TYPE "ReservationStatus" USING "prevStatus"::text::"ReservationStatus";
ALTER TABLE "ReservationHistory" ALTER COLUMN "newStatus" TYPE "ReservationStatus" USING "newStatus"::text::"ReservationStatus";

DROP TYPE "ReservationStatus_old";

-- Step D: EXCLUDE 制約を再作成
ALTER TABLE "Reservation"
  ADD CONSTRAINT "no_double_booking_bed"
  EXCLUDE USING gist (
    "bedId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

ALTER TABLE "Reservation"
  ADD CONSTRAINT "no_double_booking_practitioner"
  EXCLUDE USING gist (
    "practitionerId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');
