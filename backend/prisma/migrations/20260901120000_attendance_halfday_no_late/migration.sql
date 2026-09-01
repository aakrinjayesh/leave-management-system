-- AlterTable
ALTER TABLE "Attendance" DROP COLUMN "isLate",
DROP COLUMN "workStartTime",
ADD COLUMN     "isHalfDay" BOOLEAN NOT NULL DEFAULT false;
