-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hoursWorked" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "timesheetSubmissionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetSubmission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "routedToId" INTEGER,
    "approvedById" INTEGER,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "managerRemarks" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetEntry_userId_idx" ON "TimesheetEntry"("userId");

-- CreateIndex
CREATE INDEX "TimesheetEntry_weekStartDate_idx" ON "TimesheetEntry"("weekStartDate");

-- CreateIndex
CREATE INDEX "TimesheetEntry_timesheetSubmissionId_idx" ON "TimesheetEntry"("timesheetSubmissionId");

-- CreateIndex
CREATE INDEX "TimesheetSubmission_userId_idx" ON "TimesheetSubmission"("userId");

-- CreateIndex
CREATE INDEX "TimesheetSubmission_routedToId_idx" ON "TimesheetSubmission"("routedToId");

-- CreateIndex
CREATE INDEX "TimesheetSubmission_status_idx" ON "TimesheetSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetSubmission_userId_weekStartDate_key" ON "TimesheetSubmission"("userId", "weekStartDate");

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_timesheetSubmissionId_fkey" FOREIGN KEY ("timesheetSubmissionId") REFERENCES "TimesheetSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetSubmission" ADD CONSTRAINT "TimesheetSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetSubmission" ADD CONSTRAINT "TimesheetSubmission_routedToId_fkey" FOREIGN KEY ("routedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetSubmission" ADD CONSTRAINT "TimesheetSubmission_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
