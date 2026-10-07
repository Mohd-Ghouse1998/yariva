import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { createSign } from "node:crypto";
import { connect } from "node:http2";
import pushConfig from "../../../config/push.config";

export interface PushPayload {
  token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export type PushTransportResult =
  | { outcome: "DELIVERED"; providerMessageId: string | null }
  | { outcome: "INVALID_TOKEN"; reason: string };

export class PushTransportError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "PushTransportError";
  }
}

@Injectable()
export class FcmPushTransport {
  private accessToken: { value: string; expiresAtMs: number } | null = null;

  constructor(
    @Inject(pushConfig.KEY)
    private readonly config: ConfigType<typeof pushConfig>,
  ) {}

  isConfigured(): boolean {
    const { projectId, clientEmail, privateKey } = this.config.fcm;
    return Boolean(projectId && clientEmail && privateKey);
  }

  async send(payload: PushPayload): Promise<PushTransportResult> {
    const { projectId } = this.config.fcm;
    if (!this.isConfigured() || !projectId) {
      throw new PushTransportError("FCM credentials are not configured", "FCM_NOT_CONFIGURED", false);
    }
    const accessToken = await this.getAccessToken();
    const response = await fetch(
      `${this.config.fcm.apiBaseUrl.replace(/\/$/, "")}/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: payload.token,
            notification: { title: payload.title, body: payload.body },
            data: stringifyData(payload.data),
            android: { priority: "high" },
            apns: { headers: { "apns-priority": "10" } },
          },
        }),
        signal: AbortSignal.timeout(this.config.requestTimeoutMs),
      },
    );
    const raw = await response.text();
    const body = parseJsonObject(raw);
    if (response.ok) {
      return {
        outcome: "DELIVERED",
        providerMessageId: typeof body.name === "string" ? body.name : null,
      };
    }
    const classified = classifyFcmFailure(response.status, body);
    if (classified.invalidToken) {
      return { outcome: "INVALID_TOKEN", reason: classified.code };
    }
    throw new PushTransportError(
      `FCM rejected push (${classified.code})`,
      classified.code,
      classified.retryable,
    );
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAtMs > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    const { clientEmail, privateKey, authUrl } = this.config.fcm;
    if (!clientEmail || !privateKey) {
      throw new PushTransportError("FCM credentials are not configured", "FCM_NOT_CONFIGURED", false);
    }
    const now = Math.floor(Date.now() / 1000);
    const assertion = signJwt(
      { alg: "RS256", typ: "JWT" },
      {
        iss: clientEmail,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: authUrl,
        iat: now,
        exp: now + 3600,
      },
      privateKey,
      "RSA-SHA256",
    );
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: AbortSignal.timeout(this.config.requestTimeoutMs),
    });
    const raw = await response.text();
    const body = parseJsonObject(raw);
    if (!response.ok || typeof body.access_token !== "string") {
      throw new PushTransportError(
        "FCM OAuth authentication failed",
        `FCM_AUTH_${response.status}`,
        response.status >= 500,
      );
    }
    const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
    this.accessToken = {
      value: body.access_token,
      expiresAtMs: Date.now() + expiresIn * 1000,
    };
    return body.access_token;
  }
}

@Injectable()
export class ApnsPushTransport {
  private bearer: { value: string; expiresAtMs: number } | null = null;

  constructor(
    @Inject(pushConfig.KEY)
    private readonly config: ConfigType<typeof pushConfig>,
  ) {}

  isConfigured(): boolean {
    const { teamId, keyId, privateKey, bundleId } = this.config.apns;
    return Boolean(teamId && keyId && privateKey && bundleId);
  }

  async send(payload: PushPayload): Promise<PushTransportResult> {
    const { bundleId, host } = this.config.apns;
    if (!this.isConfigured() || !bundleId) {
      throw new PushTransportError("APNs credentials are not configured", "APNS_NOT_CONFIGURED", false);
    }
    const result = await this.request(host, {
      ":method": "POST",
      ":path": `/3/device/${encodeURIComponent(payload.token)}`,
      authorization: `bearer ${this.getBearer()}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    }, JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      data: payload.data,
    }));

    if (result.status === 200) {
      return { outcome: "DELIVERED", providerMessageId: result.apnsId };
    }
    const reason =
      typeof result.body.reason === "string" ? result.body.reason : `HTTP_${result.status}`;
    const classified = classifyApnsFailure(result.status, reason);
    if (classified.invalidToken) {
      return { outcome: "INVALID_TOKEN", reason };
    }
    throw new PushTransportError(
      `APNs rejected push (${reason})`,
      reason,
      classified.retryable,
    );
  }

  private getBearer(): string {
    if (this.bearer && this.bearer.expiresAtMs > Date.now() + 60_000) return this.bearer.value;
    const { teamId, keyId, privateKey } = this.config.apns;
    if (!teamId || !keyId || !privateKey) {
      throw new PushTransportError("APNs credentials are not configured", "APNS_NOT_CONFIGURED", false);
    }
    const issuedAt = Math.floor(Date.now() / 1000);
    const value = signJwt(
      { alg: "ES256", kid: keyId },
      { iss: teamId, iat: issuedAt },
      privateKey,
      "SHA256",
      "ieee-p1363",
    );
    this.bearer = { value, expiresAtMs: Date.now() + 50 * 60_000 };
    return value;
  }

  private request(
    authority: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ status: number; apnsId: string | null; body: Record<string, unknown> }> {
    return new Promise((resolve, reject) => {
      const client = connect(authority);
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new PushTransportError("APNs request timed out", "APNS_TIMEOUT", true));
      }, this.config.requestTimeoutMs);
      client.once("error", (error) => {
        clearTimeout(timeout);
        reject(new PushTransportError(error.message, "APNS_CONNECTION", true));
      });
      const request = client.request(headers);
      const chunks: Buffer[] = [];
      let status = 0;
      let apnsId: string | null = null;
      request.on("response", (responseHeaders) => {
        status = Number(responseHeaders[":status"] ?? 0);
        apnsId = typeof responseHeaders["apns-id"] === "string" ? responseHeaders["apns-id"] : null;
      });
      request.on("data", (chunk: Buffer) => chunks.push(chunk));
      request.once("error", (error) => {
        clearTimeout(timeout);
        client.destroy();
        reject(new PushTransportError(error.message, "APNS_REQUEST", true));
      });
      request.on("end", () => {
        clearTimeout(timeout);
        client.close();
        resolve({
          status,
          apnsId,
          body: parseJsonObject(Buffer.concat(chunks).toString("utf8")),
        });
      });
      request.end(body);
    });
  }
}

function stringifyData(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      typeof item === "string" ? item : JSON.stringify(item),
    ]),
  );
}

function signJwt(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  privateKey: string,
  algorithm: string,
  dsaEncoding?: "der" | "ieee-p1363",
): string {
  const unsigned = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signer = createSign(algorithm);
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey, ...(dsaEncoding ? { dsaEncoding } : {}) });
  return `${unsigned}.${signature.toString("base64url")}`;
}

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseJsonObject(value: string): Record<string, any> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, any>)
      : {};
  } catch {
    return {};
  }
}

function findFcmErrorCode(body: Record<string, any>): string | null {
  const details = Array.isArray(body.error?.details) ? body.error.details : [];
  for (const detail of details) {
    if (typeof detail?.errorCode === "string") return detail.errorCode;
  }
  return typeof body.error?.status === "string" ? body.error.status : null;
}

export function classifyFcmFailure(
  status: number,
  body: Record<string, any>,
): { code: string; invalidToken: boolean; retryable: boolean } {
  const code = findFcmErrorCode(body) ?? `HTTP_${status}`;
  return {
    code,
    invalidToken: code === "UNREGISTERED",
    retryable: status === 408 || status === 429 || status >= 500,
  };
}

export function classifyApnsFailure(
  status: number,
  reason: string,
): { invalidToken: boolean; retryable: boolean } {
  return {
    invalidToken: ["BadDeviceToken", "DeviceTokenNotForTopic", "Unregistered"].includes(reason),
    retryable: status === 429 || status >= 500,
  };
}
