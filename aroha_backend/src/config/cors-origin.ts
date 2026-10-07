import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";

export function parseCorsAllowedOrigins(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function resolveCorsOriginSetting(
  env: NodeJS.ProcessEnv = process.env,
): true | string[] {
  const origins = parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  if (origins.length > 0) {
    return origins;
  }

  return env.NODE_ENV === "production" ? [] : true;
}

export function buildHttpCorsOptions(
  env: NodeJS.ProcessEnv = process.env,
): CorsOptions {
  const originSetting = resolveCorsOriginSetting(env);

  if (originSetting === true) {
    return {
      origin: true,
      credentials: false,
    };
  }

  return {
    origin: (origin, callback) => {
      if (!origin || originSetting.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: false,
  };
}

export function buildSocketIoCorsOptions(
  env: NodeJS.ProcessEnv = process.env,
): { origin: true | string[]; credentials: false } {
  return {
    origin: resolveCorsOriginSetting(env),
    credentials: false,
  };
}
