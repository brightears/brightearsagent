-- Voice step deepening (June 2026): a few structured voice signals to complement
-- the pasted samples, so the drafter nails the artist's real voice even from one
-- example. All optional; the drafter only emits a rule for fields that are set.
--   voiceGreeting  — how they open ("Hey [name]!", "Hi [name],")
--   voiceSignoff   — how they close ("Cheers, Sam", "Talk soon —")
--   voiceUsesEmoji — NULL = unspecified (let samples decide), true = occasional, false = never
--   voicePhrases   — words/expressions they lean on
ALTER TABLE "Business" ADD COLUMN     "voiceGreeting" TEXT,
ADD COLUMN     "voiceSignoff" TEXT,
ADD COLUMN     "voiceUsesEmoji" BOOLEAN,
ADD COLUMN     "voicePhrases" TEXT;
