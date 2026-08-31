-- CreateEnum
CREATE TYPE "ProfileChangeSection" AS ENUM ('PERSONAL', 'STATUTORY', 'BANK');

-- CreateEnum
CREATE TYPE "ProfileChangeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProfileChangeRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "section" "ProfileChangeSection" NOT NULL,
    "changes" JSONB NOT NULL,
    "status" "ProfileChangeStatus" NOT NULL DEFAULT 'PENDING',
    "adminRemarks" TEXT,
    "decidedById" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_userId_idx" ON "ProfileChangeRequest"("userId");

-- CreateIndex
CREATE INDEX "ProfileChangeRequest_status_idx" ON "ProfileChangeRequest"("status");

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfileChangeRequest" ADD CONSTRAINT "ProfileChangeRequest_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
