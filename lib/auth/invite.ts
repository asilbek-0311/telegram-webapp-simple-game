import { createHmac, timingSafeEqual } from "node:crypto";

type InvitePayload = {
  inviterUserId: string;
  exp: number;
};

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function decodePayload(encodedPayload: string): InvitePayload | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as InvitePayload;

    if (!parsed.inviterUserId || !parsed.exp) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function createInviteToken(options: {
  inviterUserId: string;
  secret: string;
  ttlSec: number;
  nowSec?: number;
}): { token: string; expiresAt: string } {
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  const payload: InvitePayload = {
    inviterUserId: options.inviterUserId,
    exp: now + options.ttlSec,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = sign(encodedPayload, options.secret);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}

export function verifyInviteToken(options: {
  token: string;
  secret: string;
  nowSec?: number;
}): { inviterUserId: string; expiresAt: string } {
  const [encodedPayload, signature] = options.token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid invite token format");
  }

  const expected = sign(encodedPayload, options.secret);
  const valid = timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expected, "utf8")
  );

  if (!valid) {
    throw new Error("Invalid invite token signature");
  }

  const payload = decodePayload(encodedPayload);
  if (!payload) {
    throw new Error("Invalid invite token payload");
  }

  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new Error("Invite token expired");
  }

  return {
    inviterUserId: payload.inviterUserId,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
  };
}
