-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'VENUE_OUTREACH';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "venueId" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "repliedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
