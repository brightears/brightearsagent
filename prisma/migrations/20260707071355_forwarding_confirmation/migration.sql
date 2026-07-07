-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "forwardingConfirmAt" TIMESTAMP(3),
ADD COLUMN     "forwardingConfirmCode" TEXT,
ADD COLUMN     "forwardingConfirmUrl" TEXT;
