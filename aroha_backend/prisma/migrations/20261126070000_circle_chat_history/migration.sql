BEGIN;

ALTER TABLE "CircleMembership" ADD COLUMN "chatGrantId" UUID;
ALTER TABLE "ConversationMember" ADD COLUMN "circleChatGrantId" UUID;

UPDATE "CircleMembership"
SET "chatGrantId" = gen_random_uuid()
WHERE status = 'APPROVED';

-- A replacement roster was created on every approval or departure. A roster
-- missing the member ends the current run of grants. At a timestamp tie with
-- such a roster, preserve only the grants whose ordering is certain.
-- The column change holds the table lock until the immutable roster trigger
-- has been re-enabled and the migration commits.
ALTER TABLE "ConversationMember" DISABLE TRIGGER "ConversationMember_immutable";

WITH current_grants AS (
  SELECT membership."circleId", membership."userId", membership."chatGrantId",
         max(prior."closedAt") FILTER (WHERE prior_member."userId" IS NULL) AS last_gap
  FROM "CircleMembership" membership
  JOIN "Conversation" active ON active."circleId" = membership."circleId" AND active.status = 'ACTIVE'
  JOIN "ConversationMember" active_member ON active_member."conversationId" = active.id
    AND active_member."userId" = membership."userId"
  LEFT JOIN "Conversation" prior ON prior."circleId" = membership."circleId"
    AND prior.status = 'CLOSED_UNMATCHED' AND prior."closedAt" IS NOT NULL
  LEFT JOIN "ConversationMember" prior_member ON prior_member."conversationId" = prior.id
    AND prior_member."userId" = membership."userId"
  WHERE membership.status = 'APPROVED'
  GROUP BY membership."circleId", membership."userId", membership."chatGrantId"
)
UPDATE "ConversationMember" snapshot
SET "circleChatGrantId" = grant_row."chatGrantId"
FROM "Conversation" chat JOIN current_grants grant_row ON grant_row."circleId" = chat."circleId"
WHERE snapshot."conversationId" = chat.id AND snapshot."userId" = grant_row."userId"
  AND (chat.status = 'ACTIVE' OR (chat.status = 'CLOSED_UNMATCHED' AND chat."closedAt" IS NOT NULL
    AND (grant_row.last_gap IS NULL OR chat."closedAt" > grant_row.last_gap)));

ALTER TABLE "ConversationMember" ENABLE TRIGGER "ConversationMember_immutable";

COMMIT;
