/*
  Warnings:

  - You are about to drop the `Shift` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_practitionerId_fkey";

-- DropForeignKey
ALTER TABLE "Shift" DROP CONSTRAINT "Shift_workStoreId_fkey";

-- AlterTable
ALTER TABLE "Practitioner" ADD COLUMN     "baseShiftDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "gender" "Gender";

-- DropTable
DROP TABLE "Shift";
