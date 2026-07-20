-- AlterTable
ALTER TABLE "LeavePolicy" ADD COLUMN     "isUnpaid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SalaryStructureConfig" (
    "id" SERIAL NOT NULL,
    "basicPercentOfCtc" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "hraPercentOfBasic" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "ltaPercentOfBasic" DOUBLE PRECISION NOT NULL DEFAULT 8.33,
    "guaranteedAllowancePercentOfBasic" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "conveyanceMonthly" DOUBLE PRECISION NOT NULL DEFAULT 1600,
    "pfPercentOfBasic" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "professionalTax" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryStructureConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "basic" DOUBLE PRECISION NOT NULL,
    "hra" DOUBLE PRECISION NOT NULL,
    "lta" DOUBLE PRECISION NOT NULL,
    "conveyance" DOUBLE PRECISION NOT NULL,
    "guaranteedAllowance" DOUBLE PRECISION NOT NULL,
    "specialAllowance" DOUBLE PRECISION NOT NULL,
    "annualBonusPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pfEmployee" DOUBLE PRECISION NOT NULL,
    "pfEmployer" DOUBLE PRECISION NOT NULL,
    "professionalTax" DOUBLE PRECISION NOT NULL,
    "tds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lopDays" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lopAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grossPay" DOUBLE PRECISION NOT NULL,
    "grossDeductions" DOUBLE PRECISION NOT NULL,
    "netPay" DOUBLE PRECISION NOT NULL,
    "generatedById" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payslip_userId_idx" ON "Payslip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_userId_month_year_key" ON "Payslip"("userId", "month", "year");

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
