-- CreateEnum
CREATE TYPE "CardLanguage" AS ENUM ('ENGLISH', 'JAPANESE');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "language" "CardLanguage" NOT NULL DEFAULT 'ENGLISH';

-- AlterTable
ALTER TABLE "GradingSubmission" ADD COLUMN     "language" "CardLanguage" NOT NULL DEFAULT 'ENGLISH';
