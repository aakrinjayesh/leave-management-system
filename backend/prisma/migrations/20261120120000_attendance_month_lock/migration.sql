-- Replaces the single global "allow past-month edits" switch with per-month
-- locks: a locked month can't be marked/changed by employees (admins still can).

-- CreateEnum
CREATE TYPE "AttendanceLockSource" AS ENUM ('MANUAL', 'PAYROLL');

-- AlterTable
ALTER TABLE "CompanySettings" DROP COLUMN "allowPastMonthAttendanceEdits";

-- CreateTable
CREATE TABLE "AttendanceMonthLock" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "source" "AttendanceLockSource" NOT NULL DEFAULT 'MANUAL',
    "lockedById" INTEGER,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceMonthLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthLock_year_month_key" ON "AttendanceMonthLock"("year", "month");

-- AddForeignKey
ALTER TABLE "AttendanceMonthLock" ADD CONSTRAINT "AttendanceMonthLock_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every month BEFORE the current one that already has payslips is
-- treated as paid out and locked, so old months don't reopen for employees.
-- The current month is never locked here. Admins can unlock any of these.
INSERT INTO "AttendanceMonthLock" ("year", "month", "source", "lockedById", "lockedAt")
SELECT p."year", p."month", 'PAYROLL'::"AttendanceLockSource", MIN(p."generatedById"), CURRENT_TIMESTAMP
FROM "Payslip" p
WHERE p."year" * 12 + p."month" <
      EXTRACT(YEAR FROM CURRENT_DATE)::int * 12 + EXTRACT(MONTH FROM CURRENT_DATE)::int
GROUP BY p."year", p."month";
