-- Product-wide recipient suppression. There is intentionally NO foreign key
-- to Business: a recipient stop / definitive delivery failure must survive
-- tenant deletion.
CREATE TABLE "GlobalOutreachSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "sourceBusinessId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalOutreachSuppression_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GlobalOutreachSuppression_email_normalized_check"
      CHECK ("email" = lower(btrim("email")) AND length("email") > 0),
    CONSTRAINT "GlobalOutreachSuppression_reason_check"
      CHECK ("reason" IN (
        'unsubscribe',
        'cease-and-desist',
        'spam-complaint',
        'hard-bounce',
        'invalid-recipient'
      ))
);

CREATE UNIQUE INDEX "GlobalOutreachSuppression_email_key"
ON "GlobalOutreachSuppression"("email");

-- Only unambiguous recipient-authored stops are eligible. Owner skips and
-- matching feedback remain tenant-local and are deliberately excluded.
WITH eligible AS (
  SELECT DISTINCT ON (lower(btrim(os."email")))
    lower(btrim(os."email")) AS "email",
    os."reason",
    os."businessId" AS "sourceBusinessId",
    os."createdAt"
  FROM "OutreachSuppression" os
  WHERE os."reason" IN ('unsubscribe', 'cease-and-desist')
    AND length(btrim(os."email")) > 0
  ORDER BY
    lower(btrim(os."email")),
    CASE WHEN os."reason" = 'cease-and-desist' THEN 0 ELSE 1 END,
    os."createdAt" ASC
)
INSERT INTO "GlobalOutreachSuppression" (
  "id",
  "email",
  "reason",
  "sourceBusinessId",
  "createdAt",
  "updatedAt"
)
SELECT
  'global_' || md5("email"),
  "email",
  "reason",
  "sourceBusinessId",
  "createdAt",
  CURRENT_TIMESTAMP
FROM eligible;
