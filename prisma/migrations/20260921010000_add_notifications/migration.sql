-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ITEM_SOLD', 'INSPECTION_PASSED', 'GRADING_COMPLETE', 'PRICE_DROP_WATCHED', 'NEW_SUBMISSION', 'DUPLICATE_CERT_ATTEMPT');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_audience_readAt_idx" ON "Notification"("audience", "readAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
