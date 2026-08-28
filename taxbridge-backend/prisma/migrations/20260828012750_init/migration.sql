-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'PROFESSIONAL');

-- CreateEnum
CREATE TYPE "FirmCapacity" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "FirmAvailability" AS ENUM ('ACCEPTING', 'LIMITED', 'FULLY_BOOKED');

-- CreateEnum
CREATE TYPE "FirmVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'INFO_REQUIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EngagementSensitivity" AS ENUM ('STANDARD', 'CONFIDENTIAL', 'HIGH', 'HIGHLY_SENSITIVE');

-- CreateEnum
CREATE TYPE "EngagementStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'MATCHING', 'FIRM_SELECTED', 'INTRODUCTION_SENT', 'CLIENT_ACCEPTED', 'FIRM_ACCEPTED', 'ACTIVE', 'COMPLETED', 'DECLINED', 'CLOSED', 'REMATCH');

-- CreateEnum
CREATE TYPE "MessageSenderRole" AS ENUM ('CLIENT', 'FIRM', 'ADMIN');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('PENDING', 'MATCHED', 'ENGAGED', 'PAID', 'DELIVERED', 'RELEASED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "professionalBody" TEXT,
    "registrationNumber" TEXT,
    "yearsExperience" TEXT,
    "expertise" TEXT,
    "rate" TEXT,
    "bio" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firms" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firmName" TEXT NOT NULL,
    "phone" TEXT,
    "logoInitials" TEXT,
    "website" TEXT,
    "yearEstablished" TEXT,
    "headquarters" TEXT,
    "citiesServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "statesServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "countriesServed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remoteAvailable" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "credentialIcan" TEXT,
    "credentialAnan" TEXT,
    "credentialCitn" TEXT,
    "credentialOther" TEXT,
    "verificationDocs" TEXT,
    "specialisations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "industries" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "capacity" "FirmCapacity" NOT NULL DEFAULT 'SMALL',
    "availability" "FirmAvailability" NOT NULL DEFAULT 'ACCEPTING',
    "verificationStatus" "FirmVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifyIdentity" BOOLEAN NOT NULL DEFAULT false,
    "verifyCredentials" BOOLEAN NOT NULL DEFAULT false,
    "verifyFirm" BOOLEAN NOT NULL DEFAULT false,
    "verifiedSpecialisations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagements" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientEmail" TEXT NOT NULL,
    "clientPhone" TEXT,
    "company" TEXT,
    "industry" TEXT NOT NULL,
    "businessSize" TEXT NOT NULL,
    "engagementType" TEXT NOT NULL,
    "typeAnswers" JSONB,
    "details" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "estimatedValue" TEXT,
    "expectedDuration" TEXT,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "onSiteRequired" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity" "EngagementSensitivity" NOT NULL DEFAULT 'STANDARD',
    "status" "EngagementStatus" NOT NULL DEFAULT 'NEW',
    "selectedFirmIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "matchReasonNote" TEXT,
    "interestedFirmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "engagementId" TEXT NOT NULL,
    "senderRole" "MessageSenderRole" NOT NULL,
    "senderName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderUserId" TEXT,
    "senderFirmId" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "company" TEXT,
    "need" TEXT NOT NULL,
    "budget" TEXT,
    "details" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'PENDING',
    "matches" JSONB,
    "chosenPro" TEXT,
    "feeAmount" TEXT,
    "scopeNote" TEXT,
    "rating" INTEGER,
    "review" TEXT,
    "interestedFirmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "firms_email_key" ON "firms"("email");

-- CreateIndex
CREATE UNIQUE INDEX "engagements_refCode_key" ON "engagements"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "leads_refCode_key" ON "leads"("refCode");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "engagements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderFirmId_fkey" FOREIGN KEY ("senderFirmId") REFERENCES "firms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
