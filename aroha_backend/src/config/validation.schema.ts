import Joi from "joi";

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "test", "production")
    .default("development"),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default("api/v1"),
  APP_NAME: Joi.string().default("aroha-backend"),
  BLIND_EVENT_WEEKDAY: Joi.number().integer().min(0).max(6).default(4),
  BLIND_EVENT_START_HOUR_IST: Joi.number().integer().min(0).max(23).default(20),
  BLIND_EVENT_DURATION_MINUTES: Joi.number().integer().min(15).max(240).default(120),
  CORS_ALLOWED_ORIGINS: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().trim().min(1).required(),
    otherwise: Joi.string().allow("").optional().default(""),
  }),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .required(),
  SHADOW_DATABASE_URL: Joi.string()
    .uri({ scheme: ["postgres", "postgresql"] })
    .optional(),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(10),
  DATABASE_CONNECTION_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .default(5000),
  DATABASE_IDLE_TIMEOUT_MS: Joi.number().integer().min(1000).default(300000),
  DATABASE_MAX_LIFETIME_SECONDS: Joi.number().integer().min(0).default(0),
  REDIS_URL: Joi.string()
    .uri({ scheme: ["redis", "rediss"] })
    .required(),
  BULLMQ_PREFIX: Joi.string().default("aroha"),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  REFRESH_TOKEN_GRACE_SECONDS: Joi.number().integer().min(1).default(30),
  PASSWORD_PEPPER: Joi.string().min(32).required(),
  REFRESH_TOKEN_PEPPER: Joi.string().min(32).required(),
  OTP_PROVIDER: Joi.string()
    .valid("disabled", "twilio", "msg91")
    .default("disabled"),
  OTP_TTL_SECONDS: Joi.number().integer().min(60).max(600).default(600),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(15)
    .max(300)
    .default(30),
  OTP_MAX_VERIFY_ATTEMPTS: Joi.number().integer().min(3).max(10).default(5),
  OTP_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(8000),
  TWILIO_ACCOUNT_SID: Joi.when("OTP_PROVIDER", {
    is: "twilio",
    then: Joi.string()
      .pattern(/^AC[0-9a-fA-F]{32}$/)
      .required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TWILIO_AUTH_TOKEN: Joi.when("OTP_PROVIDER", {
    is: "twilio",
    then: Joi.string().min(20).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  TWILIO_VERIFY_SERVICE_SID: Joi.when("OTP_PROVIDER", {
    is: "twilio",
    then: Joi.string()
      .pattern(/^VA[0-9a-fA-F]{32}$/)
      .required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MSG91_AUTH_KEY: Joi.when("OTP_PROVIDER", {
    is: "msg91",
    then: Joi.string().min(12).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  MSG91_TEMPLATE_ID: Joi.when("OTP_PROVIDER", {
    is: "msg91",
    then: Joi.string().min(4).required(),
    otherwise: Joi.string().allow("").optional(),
  }),
  OBJECT_STORAGE_ENDPOINT: Joi.string().uri().required(),
  OBJECT_STORAGE_REGION: Joi.string().required(),
  OBJECT_STORAGE_ACCESS_KEY: Joi.string().required(),
  OBJECT_STORAGE_SECRET_KEY: Joi.string().required(),
  OBJECT_STORAGE_FORCE_PATH_STYLE: Joi.boolean().truthy("true").falsy("false"),
  OBJECT_STORAGE_BUCKET_PROFILE_PHOTOS: Joi.string().required(),
  OBJECT_STORAGE_BUCKET_MESSAGE_ATTACHMENTS: Joi.string().required(),
  OBJECT_STORAGE_BUCKET_VIBE_MEDIA: Joi.string().default("vibe-media"),
  VIBES_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  VIBE_MAX_DURATION_SECONDS: Joi.number().min(1).max(15).default(5),
  VIBE_MAX_VIDEO_SIZE_BYTES: Joi.number()
    .integer()
    .min(1048576)
    .default(41943040),
  VIBE_MAX_MUSIC_SIZE_BYTES: Joi.number()
    .integer()
    .min(1048576)
    .default(12582912),
  VIBE_UPLOAD_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(900),
  VIBE_PLAYBACK_URL_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(3600)
    .default(900),
  FFMPEG_PATH: Joi.string().allow("").optional(),
  FFPROBE_PATH: Joi.string().allow("").optional(),
  VIBE_MODERATION_PROVIDER: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().valid("manual").default("manual"),
    otherwise: Joi.string()
      .valid("manual", "local-development-stub")
      .default("local-development-stub"),
  }),
  RTC_STUN_URLS: Joi.string().optional(),
  RTC_TURN_URLS: Joi.string().optional(),
  RTC_TURN_USERNAME: Joi.string().optional(),
  RTC_TURN_CREDENTIAL: Joi.string().optional(),
  RTC_RING_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(30),
  RTC_CONNECT_TIMEOUT_SECONDS: Joi.number().integer().min(5).default(60),
  RTC_VOICE_INTRODUCTIONS_ENABLED: Joi.boolean().default(true),
  RTC_INTRODUCTION_SUGGESTED_SECONDS: Joi.number().integer().min(30).max(900).default(180),
  RTC_SIGNAL_TTL_SECONDS: Joi.number().integer().min(30).default(120),
  SCENE_LIFETIME_HOURS: Joi.number().integer().min(1).max(24).default(12),
  SCENE_RADIUS_METERS: Joi.number()
    .integer()
    .min(1000)
    .max(15000)
    .default(15000),
  SCENE_LOCATION_MAX_AGE_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(720)
    .default(168),
  SCENE_DISCOVERY_CACHE_SECONDS: Joi.number()
    .integer()
    .min(15)
    .max(900)
    .default(120),
  WINGMAN_INVITATION_TTL_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(168)
    .default(48),
  WINGMAN_INVITE_TOKEN_PEPPER: Joi.string().min(32).optional(),
  WINGMAN_DEEP_LINK_BASE: Joi.string()
    .uri({ scheme: ["yariva"] })
    .default("yariva://wingman/invite"),
  WINGMAN_DISCOVERY_RADIUS_METERS: Joi.number()
    .integer()
    .min(1000)
    .max(15000)
    .default(15000),
  WINGMAN_LOCATION_MAX_AGE_HOURS: Joi.number()
    .integer()
    .min(1)
    .max(720)
    .default(168),
  WINGMAN_DISCOVERY_CACHE_SECONDS: Joi.number()
    .integer()
    .min(15)
    .max(300)
    .default(60),
  VENUE_REVIEW_MAX_AGE_DAYS: Joi.number().integer().min(1).max(365).default(30),
  VENUE_SUGGESTIONS_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),
  VENUE_SUGGESTION_RADIUS_METERS: Joi.number()
    .integer()
    .min(1000)
    .max(50000)
    .default(12000),
  VENUE_SUGGESTION_LIMIT: Joi.number().integer().min(1).max(12).default(8),
  PUSH_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(8000),
  FCM_PROJECT_ID: Joi.string().allow("").optional(),
  FCM_CLIENT_EMAIL: Joi.string().email().allow("").optional(),
  FCM_PRIVATE_KEY: Joi.string().allow("").optional(),
  FCM_AUTH_URL: Joi.string()
    .uri()
    .default("https://oauth2.googleapis.com/token"),
  FCM_API_BASE_URL: Joi.string().uri().default("https://fcm.googleapis.com"),
  APNS_TEAM_ID: Joi.string().allow("").optional(),
  APNS_KEY_ID: Joi.string().allow("").optional(),
  APNS_PRIVATE_KEY: Joi.string().allow("").optional(),
  APNS_BUNDLE_ID: Joi.string().allow("").optional(),
  APNS_USE_SANDBOX: Joi.boolean().truthy("true").falsy("false").default(false),
});
