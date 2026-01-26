-- Add messageType to Campaign and Automation (default marketing)
ALTER TABLE "Campaign" ADD COLUMN "messageType" "MessageType" NOT NULL DEFAULT 'marketing';
ALTER TABLE "Automation" ADD COLUMN "messageType" "MessageType" NOT NULL DEFAULT 'marketing';
