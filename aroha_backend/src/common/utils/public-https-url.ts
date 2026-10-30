import { isIP } from "node:net";
import { AppException } from "../errors/app.exception";
import { ERROR_CODES } from "../constants/error-codes";

function invalidEvent(message: string): never {
  throw new AppException(400, ERROR_CODES.VALIDATION_FAILED, message);
}

// URLs are displayed externally, never fetched by the server. Restrict destinations
// anyway; this is not a DNS/redirect safety guarantee for external sites.
export function publicHttpsUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { return invalidEvent("A valid public HTTPS URL is required"); }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !host.includes(".") || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal") ||
      isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost") {
    return invalidEvent("A public HTTPS hostname without credentials is required");
  }
  url.hash = "";
  return url.toString();
}
