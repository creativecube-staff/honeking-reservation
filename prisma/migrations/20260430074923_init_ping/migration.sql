-- CreateTable
CREATE TABLE "PingTest" (
    "id" SERIAL NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PingTest_pkey" PRIMARY KEY ("id")
);
