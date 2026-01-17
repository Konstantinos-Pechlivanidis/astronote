-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangeCurrency" VARCHAR(3),
ADD COLUMN     "pendingChangeEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "pendingChangeInterval" VARCHAR(10),
ADD COLUMN     "pendingChangePlanCode" VARCHAR(50),
ADD COLUMN     "sourceOfTruth" VARCHAR(32);

