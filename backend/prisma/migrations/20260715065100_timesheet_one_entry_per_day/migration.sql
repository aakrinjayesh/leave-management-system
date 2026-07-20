/*
  Warnings:

  - A unique constraint covering the columns `[userId,date]` on the table `TimesheetEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TimesheetEntry" ALTER COLUMN "description" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetEntry_userId_date_key" ON "TimesheetEntry"("userId", "date");
