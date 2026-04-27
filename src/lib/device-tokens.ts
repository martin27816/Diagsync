import crypto from "crypto";

type DeviceTokenType = "pin_setup" | "quick_switch";

type DeviceTokenPayloadMap = {
  pin_setup: {
    staffId: string;
    organizationId: string;
    deviceKey: string;
  };
  quick_switch: {
    staffId: string;
    organizationId: string;
    deviceKey: string;
    actorId: string;
  };
};

type SignedTokenBody<T extends DeviceTokenType> = {
  t: T;
  exp: number;
  iat: number;
  d: DeviceTokenPayloadMap[T];
};

const TOKEN_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production" ? "diagsync-local-dev-auth-secret" : undefined);

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function signPayload(payload: string) {
  if (!TOKEN_SECRET) throw new Error("AUTH_SECRET_MISSING");
  return base64UrlEncode(crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest());
}

export function createDeviceToken<T extends DeviceTokenType>(
  type: T,
  data: DeviceTokenPayloadMap[T],
  expiresInSeconds: number
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: SignedTokenBody<T> = {
    t: type,
    iat: now,
    exp: now + Math.max(5, expiresInSeconds),
    d: data,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyDeviceToken<T extends DeviceTokenType>(token: string, type: T) {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) return null;

  const expected = signPayload(encodedPayload);
  const incomingBuffer = Buffer.from(encodedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (incomingBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(incomingBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as SignedTokenBody<T>;
    if (!payload || payload.t !== type) return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.d;
  } catch {
    return null;
  }
}
