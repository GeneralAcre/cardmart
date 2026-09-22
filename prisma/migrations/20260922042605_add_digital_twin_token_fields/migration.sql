/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "ProvenanceType" ADD VALUE 'LISTING_APPROVED';

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "mintAddress" TEXT,
ADD COLUMN     "transferApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerified";
