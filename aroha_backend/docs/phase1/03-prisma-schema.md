# 3. COMPLETE PRISMA SCHEMA

The finalized migration-ready Prisma schema is in:

- `prisma/schema.prisma`

Prisma 7 datasource configuration is in:

- `prisma.config.ts`

Schema guarantees captured there:
- UUID primary keys on all models
- nullable `email` and `phone` with uniqueness only when present
- canonical `(userLowId, userHighId)` match pair
- unique actor-target pair for likes and passes
- unique conversation per match
- unique communication-setting row per user per match
- explicit relations, indexes, defaults, timestamps, and soft-delete fields where appropriate
- moderation-safe photo and message metadata for discovery/chat flows
