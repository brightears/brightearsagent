-- Onboarding deepening (June 2026): capture WHO the artist is so the AI can
-- write/pitch as them convincingly.
--   socialLinks — IG/TikTok/X/SoundCloud/Mixcloud/Spotify/YouTube etc. (full URLs;
--                 platform inferred from host at render). Kept OUT of videoLinks
--                 (that's an embeddable YouTube/Vimeo feed + the strength proof bar).
--   riderNotes  — free-text "how you perform & what you need" (space, power, sound,
--                 setup, what's included). Feeds the reactive drafter + venue pitch.
ALTER TABLE "Business" ADD COLUMN     "socialLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "riderNotes" TEXT;
