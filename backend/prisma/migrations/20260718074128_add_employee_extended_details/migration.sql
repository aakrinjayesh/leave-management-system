-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aadharDocumentUrl" TEXT,
ADD COLUMN     "aadharHolderName" TEXT,
ADD COLUMN     "aadharNumber" TEXT,
ADD COLUMN     "bankDocumentUrl" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "ifscCode" TEXT,
ADD COLUMN     "maritalStatus" "MaritalStatus",
ADD COLUMN     "nationality" TEXT,
ADD COLUMN     "panDocumentUrl" TEXT,
ADD COLUMN     "panHolderName" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "spouseName" TEXT;

-- CreateTable
CREATE TABLE "EmployeeCustomField" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT,
    "documentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeCustomField_userId_idx" ON "EmployeeCustomField"("userId");

-- AddForeignKey
ALTER TABLE "EmployeeCustomField" ADD CONSTRAINT "EmployeeCustomField_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
