import { createHmac, timingSafeEqual } from "node:crypto";

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type TelegramAuthPayload = {
  telegramId: string;
  username: string | null;
  displayName: string;
  authDate: number;
};

function toDataCheckString(params: URLSearchParams): string {
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === "hash") {
      continue;
    }
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  return pairs.join("\n");
}

function buildDisplayName(user: TelegramUser): string {
  const first = user.first_name?.trim() ?? "";
  const last = user.last_name?.trim() ?? "";
  const full = `${first} ${last}`.trim();
  if (full) {
    return full;
  }
  if (user.username) {
    return user.username;
  }
  return `user_${user.id}`;
}

export function verifyTelegramInitData(options: {
  initData: string;
  botToken: string;
  maxAgeSec: number;
  nowSec?: number;
}): TelegramAuthPayload {
  const params = new URLSearchParams(options.initData);
  const receivedHash = params.get("hash");

  if (!receivedHash) {
    throw new Error("Telegram initData is missing hash");
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    throw new Error("Telegram initData is missing auth_date");
  }

  const authDate = Number.parseInt(authDateRaw, 10);
  if (!Number.isFinite(authDate)) {
    throw new Error("Invalid auth_date");
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - authDate) > options.maxAgeSec) {
    throw new Error("Telegram initData is expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("Telegram initData is missing user payload");
  }

  let user: TelegramUser;
  try {
    user = JSON.parse(userRaw) as TelegramUser;
  } catch {
    throw new Error("Unable to parse Telegram user payload");
  }

  if (!user.id) {
    throw new Error("Telegram user payload is missing id");
  }

  const dataCheckString = toDataCheckString(params);
  const secret = createHmac("sha256", "WebAppData")
    .update(options.botToken)
    .digest();
  const computedHash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");

  const hashMatches = timingSafeEqual(
    Buffer.from(computedHash, "utf8"),
    Buffer.from(receivedHash, "utf8")
  );

  if (!hashMatches) {
    throw new Error("Invalid Telegram initData hash");
  }

  return {
    telegramId: String(user.id),
    username: user.username?.toLowerCase() ?? null,
    displayName: buildDisplayName(user),
    authDate,
  };
}
