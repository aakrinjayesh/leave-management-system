-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('EMPLOYEE', 'INTERN', 'CONTRACT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "employmentType" "EmploymentType" NOT NULL DEFAULT 'EMPLOYEE';
