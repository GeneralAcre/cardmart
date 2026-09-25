-- CreateEnum
CREATE TYPE "CardGame" AS ENUM ('POKEMON', 'ONE_PIECE');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "game" "CardGame" NOT NULL DEFAULT 'POKEMON';

