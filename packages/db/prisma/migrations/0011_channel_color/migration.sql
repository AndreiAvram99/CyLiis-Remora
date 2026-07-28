-- Per-channel accent color shown as a bar in the channel pickers. Admin-set and
-- shared across everyone. Left untouched by the bot's channel sync.
ALTER TABLE "Channel" ADD COLUMN "color" TEXT;
