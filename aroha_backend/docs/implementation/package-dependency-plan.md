# Package And Dependency Plan

## Runtime
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`: HTTP application runtime
- `@nestjs/config`: typed environment configuration
- `@nestjs/jwt`: access-token signing and verification
- `@nestjs/throttler`: global rate-limiting foundation
- `@nestjs/bullmq`, `bullmq`: async job infrastructure
- `ioredis`: Redis client for ephemeral state and BullMQ connectivity
- `@prisma/client`, `@prisma/adapter-pg`, `pg`: Prisma 7 PostgreSQL access with driver adapter
- `class-validator`, `class-transformer`: DTO validation and transformation
- `bcryptjs`: password hashing
- `libphonenumber-js`: canonical phone normalization
- `helmet`: HTTP hardening
- `dotenv`, `joi`: env loading and validation
- `reflect-metadata`, `rxjs`: Nest runtime requirements

## Development
- `prisma`: schema, generate, and migration CLI
- `typescript`, `ts-node`: TypeScript toolchain
- `@nestjs/cli`, `@nestjs/schematics`: Nest build and local tooling
- `jest`, `ts-jest`, `@types/jest`: unit/integration test runner
- `supertest`, `@types/supertest`: HTTP endpoint testing
- `@nestjs/testing`: Nest testing module support
- `@types/node`, `@types/express`: TypeScript ambient types

## Current implementation slice
- foundation
- config
- common infrastructure
- Prisma/database layer
- auth module
- sessions module

## Deferred to next slice
- users
- profiles
- interests
- discovery
- likes
- matches
- conversations
- messages
- presence
- notifications
- calls
- reports
- blocks
- moderation
- analytics
- feature-flags
- admin
- jobs/workers beyond base queue wiring
