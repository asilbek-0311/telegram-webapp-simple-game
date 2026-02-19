import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyTelegramInitData } from "@/lib/auth/telegram";

function makeInitData(options: {
  botToken: string;
  authDate: number;
  user: Record<string, unknown>;
}) {
  const params = new URLSearchParams();
  params.set("auth_date", String(options.authDate));
  params.set("query_id", "AAH_test_query");
  params.set("user", JSON.stringify(options.user));

  const pairs = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const dataCheckString = pairs.join("\n");

  const secret = createHmac("sha256", "WebAppData")
    .update(options.botToken)
    .digest();
  const hash = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  params.set("hash", hash);
  return params.toString();
}

test("verifyTelegramInitData validates a signed payload", () => {
  const now = 1_900_000_000;
  const botToken = "123456:ABCDEF-test-token";
  const initData = makeInitData({
    botToken,
    authDate: now,
    user: {
      id: 42,
      username: "alice",
      first_name: "Alice",
      last_name: "Wonder",
    },
  });

  const result = verifyTelegramInitData({
    initData,
    botToken,
    maxAgeSec: 300,
    nowSec: now,
  });

  assert.equal(result.telegramId, "42");
  assert.equal(result.username, "alice");
  assert.equal(result.displayName, "Alice Wonder");
});

test("verifyTelegramInitData rejects tampered payload", () => {
  const now = 1_900_000_000;
  const botToken = "123456:ABCDEF-test-token";
  const initData = makeInitData({
    botToken,
    authDate: now,
    user: {
      id: 42,
      username: "alice",
    },
  });

  const tampered = initData.replace("alice", "mallory");

  assert.throws(
    () =>
      verifyTelegramInitData({
        initData: tampered,
        botToken,
        maxAgeSec: 300,
        nowSec: now,
      }),
    /Invalid Telegram initData hash/
  );
});
