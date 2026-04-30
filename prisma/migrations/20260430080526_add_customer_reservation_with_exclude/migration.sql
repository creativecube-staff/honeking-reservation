-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nameHash" TEXT NOT NULL,
    "phone" TEXT,
    "phoneHash" TEXT,
    "email" TEXT,
    "emailHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "bedId" INTEGER NOT NULL,
    "practitionerId" INTEGER NOT NULL,
    "menuId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "confirmationCode" TEXT NOT NULL,
    "note" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_nameHash_key" ON "Customer"("nameHash");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phoneHash_key" ON "Customer"("phoneHash");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_emailHash_key" ON "Customer"("emailHash");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_confirmationCode_key" ON "Reservation"("confirmationCode");

-- CreateIndex
CREATE INDEX "Reservation_storeId_startAt_idx" ON "Reservation"("storeId", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_practitionerId_startAt_idx" ON "Reservation"("practitionerId", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_bedId_startAt_idx" ON "Reservation"("bedId", "startAt");

-- CreateIndex
CREATE INDEX "Reservation_customerId_idx" ON "Reservation"("customerId");

-- CreateIndex
CREATE INDEX "Reservation_startAt_idx" ON "Reservation"("startAt");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "Menu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Customer は電話 or メールのどちらかが必須（両方 null は不可）
ALTER TABLE "Customer"
  ADD CONSTRAINT "customer_contact_required"
  CHECK ("phoneHash" IS NOT NULL OR "emailHash" IS NOT NULL);

-- ダブルブッキング防止: 同じベッドの時間重複を禁止（CANCELLED は除外）
ALTER TABLE "Reservation"
  ADD CONSTRAINT "no_double_booking_bed"
  EXCLUDE USING gist (
    "bedId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

-- ダブルブッキング防止: 同じ施術者の時間重複を禁止（CANCELLED は除外）
ALTER TABLE "Reservation"
  ADD CONSTRAINT "no_double_booking_practitioner"
  EXCLUDE USING gist (
    "practitionerId" WITH =,
    tsrange("startAt", "endAt", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');
