-- CreateEnum
CREATE TYPE "CardRarity" AS ENUM ('SAR', 'AR', 'SR', 'UR', 'SEC', 'RR', 'R', 'UC');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "rarity" "CardRarity";

