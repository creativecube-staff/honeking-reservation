-- 部分閉店テーブルを追加
-- 同日に複数レンジ可。終日休みは既存 Holiday テーブルで引き続き表現する。

CREATE TABLE "Closure" (
    "id"        SERIAL NOT NULL,
    "storeId"   INTEGER NOT NULL,
    "date"      DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime"   TEXT NOT NULL,
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Closure_pkey" PRIMARY KEY ("id")
);

-- 同一店舗・同一日付・同一開始時刻は重複禁止
CREATE UNIQUE INDEX "Closure_storeId_date_startTime_key"
    ON "Closure"("storeId", "date", "startTime");

CREATE INDEX "Closure_storeId_date_idx"
    ON "Closure"("storeId", "date");

ALTER TABLE "Closure"
    ADD CONSTRAINT "Closure_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "Store"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- 開始時刻 < 終了時刻
ALTER TABLE "Closure"
    ADD CONSTRAINT "closure_time_order"
    CHECK ("startTime" < "endTime");
