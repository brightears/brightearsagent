-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "oneOffHours" INTEGER,
ADD COLUMN     "residencyRateUnit" TEXT NOT NULL DEFAULT 'night';
