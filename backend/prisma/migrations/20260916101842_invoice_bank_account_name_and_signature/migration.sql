/*
  Warnings:

  - You are about to drop the column `bankBranch` on the `Invoice` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "signatureUrl" TEXT;

-- AlterTable
ALTER TABLE "Invoice" DROP COLUMN "bankBranch",
ADD COLUMN     "bankAccountName" TEXT;
