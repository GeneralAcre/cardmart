-- AlterEnum
ALTER TYPE "GradingCompany" ADD VALUE 'RAW';

-- AlterTable
ALTER TABLE "Asset" ALTER COLUMN "grade" DROP NOT NULL;
