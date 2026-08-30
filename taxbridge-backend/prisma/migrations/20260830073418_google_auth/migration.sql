/*
  Warnings:

  - A unique constraint covering the columns `[googleId]` on the table `firms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[googleId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "firms" ADD COLUMN     "googleId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "firms_googleId_key" ON "firms"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
