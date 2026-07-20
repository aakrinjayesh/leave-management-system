/*
  Warnings:

  - You are about to drop the column `designation` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LeavePolicy" ADD COLUMN     "maxAdvanceBookingDays" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "designation";
