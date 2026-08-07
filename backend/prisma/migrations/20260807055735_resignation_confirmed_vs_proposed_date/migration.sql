/*
  Warnings:

  - Made the column `proposedLastWorkingDate` on table `Resignation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Resignation" ALTER COLUMN "lastWorkingDate" DROP NOT NULL,
ALTER COLUMN "proposedLastWorkingDate" SET NOT NULL;
