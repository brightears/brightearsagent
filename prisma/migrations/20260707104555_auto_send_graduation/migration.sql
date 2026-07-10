-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "autoSendDeclinedSources" "LeadSource"[] DEFAULT ARRAY[]::"LeadSource"[];
