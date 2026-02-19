import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "tg_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7;

type SessionPayload = {
  uid: string;
  tid: string;
  exp: number;
};

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(options: {
  userId: string;
  telegramId: string;
  secret: string;
  nowSec?: number;
}): string {
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    uid: options.userId,
    tid: options.telegramId,
    exp: now + SESSION_TTL_SEC,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload, options.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(options: {
  token: string;
  secret: string;
  nowSec?: number;
}): SessionPayload | null {
  const [encodedPayload, signature] = options.token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expected = sign(encodedPayload, options.secret);
  const isValid = timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8")
  );

  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as SessionPayload;
    const now = options.nowSec ?? Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function getSessionTtlSec(): number {
  return SESSION_TTL_SEC;
}
