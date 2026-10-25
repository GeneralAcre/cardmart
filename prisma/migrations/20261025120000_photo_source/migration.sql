-- Who took a verification photo: the seller when listing, or warehouse staff
-- at inspection. Existing photos were all taken by sellers.

-- CreateEnum
CREATE TYPE "PhotoSource" AS ENUM ('SELLER', 'WAREHOUSE');

-- AlterTable
ALTER TABLE "VerificationPhoto" ADD COLUMN "source" "PhotoSource" NOT NULL DEFAULT 'SELLER';
