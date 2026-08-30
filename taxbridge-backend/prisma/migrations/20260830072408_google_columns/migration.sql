/*
  Warnings:

  - The `matches` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `feeAmount` column on the `leads` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ENGAGEMENT_MATCHED', 'FIRM_VERIFIED', 'FIRM_INFO_REQUIRED', 'FIRM_REJECTED', 'MESSAGE_RECEIVED');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "paidAt" TIMESTAMP(3),
DROP COLUMN "matches",
ADD COLUMN     "matches" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "feeAmount",
ADD COLUMN     "feeAmount" INTEGER;

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "recipientUserId" TEXT,
    "recipientFirmId" TEXT,
    "recipientAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipientUserId_read_idx" ON "notifications"("recipientUserId", "read");

-- CreateIndex
CREATE INDEX "notifications_recipientFirmId_read_idx" ON "notifications"("recipientFirmId", "read");

-- CreateIndex
CREATE INDEX "notifications_recipientAdminId_read_idx" ON "notifications"("recipientAdminId", "read");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientFirmId_fkey" FOREIGN KEY ("recipientFirmId") REFERENCES "firms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientAdminId_fkey" FOREIGN KEY ("recipientAdminId") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
