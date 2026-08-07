/*
  Warnings:

  - Made the column `lastWorkingDate` on table `Resignation` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Resignation" ALTER COLUMN "lastWorkingDate" SET NOT NULL;
