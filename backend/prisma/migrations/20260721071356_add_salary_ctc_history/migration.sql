-- CreateTable
CREATE TABLE "SalaryCtcHistory" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ctc" DOUBLE PRECISION NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedById" INTEGER,

    CONSTRAINT "SalaryCtcHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalaryCtcHistory_userId_effectiveFrom_idx" ON "SalaryCtcHistory"("userId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "SalaryCtcHistory" ADD CONSTRAINT "SalaryCtcHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryCtcHistory" ADD CONSTRAINT "SalaryCtcHistory_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
