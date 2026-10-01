-- AlterTable
ALTER TABLE "AgentMandate" ADD COLUMN     "feeThb" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "feeTxSignature" TEXT;

-- CreateTable
CREATE TABLE "AgentPlanRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPlanRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPlanRequest_userId_createdAt_idx" ON "AgentPlanRequest"("userId", "createdAt");
