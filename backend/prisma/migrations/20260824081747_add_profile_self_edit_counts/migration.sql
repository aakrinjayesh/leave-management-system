-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankInfoEditCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "personalInfoEditCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "statutoryInfoEditCount" INTEGER NOT NULL DEFAULT 0;
