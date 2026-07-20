-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "pfNumber" TEXT,
ADD COLUMN     "salaryCtc" DOUBLE PRECISION,
ADD COLUMN     "uan" TEXT;
