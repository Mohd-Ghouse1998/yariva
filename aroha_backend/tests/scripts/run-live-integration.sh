#!/usr/bin/env sh
set -eu

COMPOSE_FILE="docker-compose.integration.yml"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down -v
}

docker compose -f "$COMPOSE_FILE" up -d --wait
trap cleanup EXIT

export AROHA_RUN_LIVE_INTEGRATION=1
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--experimental-vm-modules"
export NODE_ENV=test
export PORT=3000
export API_PREFIX=api/v1
export APP_NAME=aroha-backend-live-test
export CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
export DATABASE_URL=postgresql://aroha:aroha@127.0.0.1:55432/aroha_live
export REDIS_URL=redis://127.0.0.1:56379/0
export BULLMQ_PREFIX=aroha-live
export JWT_ACCESS_SECRET=live-test-access-secret-value-0000000000
export ACCESS_TOKEN_TTL_SECONDS=900
export REFRESH_TOKEN_TTL_DAYS=30
export REFRESH_TOKEN_GRACE_SECONDS=30
export PASSWORD_PEPPER=live-test-password-pepper-value-000000000
export REFRESH_TOKEN_PEPPER=live-test-refresh-pepper-value-00000000
export OBJECT_STORAGE_ENDPOINT=http://127.0.0.1:59000
export OBJECT_STORAGE_REGION=us-east-1
export OBJECT_STORAGE_ACCESS_KEY=minioadmin
export OBJECT_STORAGE_SECRET_KEY=minioadmin
export OBJECT_STORAGE_FORCE_PATH_STYLE=true
export OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS=profile-photos
export OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS=message-attachments
export OBJECT_STORAGE_BUCKET_VIBE_MEDIA=vibe-media
export RTC_RING_TIMEOUT_SECONDS=30
export RTC_CONNECT_TIMEOUT_SECONDS=60
export RTC_SIGNAL_TTL_SECONDS=120

npm run prisma:migrate:deploy
npm run prisma:seed
npm run test:integration:live
