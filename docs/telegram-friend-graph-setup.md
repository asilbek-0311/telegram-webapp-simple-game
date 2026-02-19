# Telegram Friend Graph Setup

## 1) Environment Variables
Create `/Users/beks/coding/Projects/telegram_webapp/.env.local`:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
TELEGRAM_BOT_TOKEN=<bot_token>
SESSION_SECRET=<long-random-secret>
TELEGRAM_AUTH_MAX_AGE_SEC=300
SECOND_DEGREE_LIMIT=60
```

## 2) Run SQL Migration
Run this file in your Supabase SQL editor:

- `/Users/beks/coding/Projects/telegram_webapp/supabase/migrations/202602190001_init_friend_graph.sql`

This creates:
- `users`
- `friend_requests`
- `friendships`
- indexes and constraints for pending request uniqueness and canonical friendships

## 3) Telegram Bot Configuration
1. Create bot via `@BotFather` (`/newbot`).
2. Deploy this app to a public HTTPS URL.
3. Set bot menu button or main mini app URL to deployed URL.
4. Open app inside Telegram to pass `initData`.

## 4) Local Run
```bash
npm run dev
```

If you open in normal browser (not Telegram), the app stays in guard mode and asks you to open inside Telegram.

## 5) API Overview
- `POST /api/auth/telegram` verifies Telegram `initData` and sets session cookie.
- `GET /api/friends/graph` returns profile, stats, direct friends, second-degree nodes, and pending requests.
- `GET /api/users/search?q=<username>` searches by username.
- `POST /api/friends/request` creates pending or auto-accepts reciprocal request.
- `POST /api/friends/accept` accepts incoming pending request.

## 6) Notes
- Username search only works for users who have a Telegram username.
- Reciprocal pending requests auto-accept and create friendship immediately.
- Session cookie is signed and HTTP-only.
