type EnvConfig = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  telegramBotToken: string;
  telegramBotUsername: string;
  appBaseUrl: string;
  sessionSecret: string;
  authMaxAgeSec: number;
  secondDegreeLimit: number;
  inviteTtlSec: number;
};

let cachedEnv: EnvConfig | null = null;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

export function getEnv(): EnvConfig {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = {
    supabaseUrl: required("SUPABASE_URL"),
    supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
    telegramBotUsername: required("TELEGRAM_BOT_USERNAME"),
    appBaseUrl: required("APP_BASE_URL"),
    sessionSecret: required("SESSION_SECRET"),
    authMaxAgeSec: optionalNumber("TELEGRAM_AUTH_MAX_AGE_SEC", 300),
    secondDegreeLimit: optionalNumber("SECOND_DEGREE_LIMIT", 60),
    inviteTtlSec: optionalNumber("INVITE_TTL_SEC", 60 * 60 * 24 * 30),
  };

  return cachedEnv;
}
