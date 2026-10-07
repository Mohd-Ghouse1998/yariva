import {
  buildHttpCorsOptions,
  parseCorsAllowedOrigins,
  resolveCorsOriginSetting,
} from "./cors-origin";

describe("cors-origin", () => {
  it("parses comma-separated allowed origins", () => {
    expect(
      parseCorsAllowedOrigins("https://app.example.com, https://admin.example.com"),
    ).toEqual(["https://app.example.com", "https://admin.example.com"]);
  });

  it("defaults to explicit deny in production when validation has not supplied origins", () => {
    expect(resolveCorsOriginSetting({ NODE_ENV: "production" } as any)).toEqual(
      [],
    );
  });

  it("allows only configured browser origins", () => {
    const options = buildHttpCorsOptions({
      NODE_ENV: "production",
      CORS_ALLOWED_ORIGINS: "https://app.example.com",
    } as any);
    const origin = options.origin as (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => void;
    const callback = jest.fn();

    origin("https://app.example.com", callback);
    origin("https://evil.example.com", callback);

    expect(callback).toHaveBeenNthCalledWith(1, null, true);
    expect(callback).toHaveBeenNthCalledWith(2, null, false);
  });
});
