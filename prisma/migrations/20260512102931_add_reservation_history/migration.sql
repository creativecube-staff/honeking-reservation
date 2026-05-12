-- CreateTable
CREATE TABLE "ReservationHistory" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedByPractitionerId" INTEGER,
    "changedByName" TEXT NOT NULL,
    "prevStartAt" TIMESTAMP(3) NOT NULL,
    "prevEndAt" TIMESTAMP(3) NOT NULL,
    "prevStatus" "ReservationStatus" NOT NULL,
    "prevMenuId" INTEGER NOT NULL,
    "prevPractitionerId" INTEGER NOT NULL,
    "prevBedId" INTEGER NOT NULL,
    "newStartAt" TIMESTAMP(3) NOT NULL,
    "newEndAt" TIMESTAMP(3) NOT NULL,
    "newStatus" "ReservationStatus" NOT NULL,
    "newMenuId" INTEGER NOT NULL,
    "newPractitionerId" INTEGER NOT NULL,
    "newBedId" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "ReservationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReservationHistory_reservationId_changedAt_idx" ON "ReservationHistory"("reservationId", "changedAt");

-- AddForeignKey
ALTER TABLE "ReservationHistory" ADD CONSTRAINT "ReservationHistory_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
