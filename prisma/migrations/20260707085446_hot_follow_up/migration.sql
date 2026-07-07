-- AlterTable
ALTER TABLE "VenuePitch" ADD COLUMN     "followUpOfId" TEXT;

-- AddForeignKey
ALTER TABLE "VenuePitch" ADD CONSTRAINT "VenuePitch_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "VenuePitch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
