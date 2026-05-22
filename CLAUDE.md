# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

像素农场 (Pixel Farm) — a social farming game designed for elderly users. Players plant, water, and harvest crops on an 8×6 grid, earn coins/experience, befriend other players, visit their farms, send messages, and receive push notifications when crops mature.

## Commands

```bash
npm start              # Start the server (port 3000)
npm run dev            # Same as start
npm run db:init        # Re-initialize the SQLite database
npm run server         # Same as start
```

No test suite, no build step, no linter configured. The server serves static files from `client/` directly.

## Architecture

```
Browser (Canvas + vanilla JS)
  ├── HTTP REST (JSON) ── Express routes
  └── WebSocket (ws) ──── Real-time push (crop mature, notifications, achievements)
         ↓
    Services layer (farmService, friendService, notificationService, etc.)
         ↓
    SQLite via better-sqlite3 (server/database.js provides a thin wrapper)
```

### Key architectural patterns

- **Server entry point**: `server/index.js` wires up database init, WebSocket, cron job, notification provider, and demo data seeding, then starts the HTTP server.
- **Express app**: `server/app.js` configures middleware (security headers, JSON parsing, rate limiting) and mounts all route modules under `/api/`.
- **Database**: SQLite (`better-sqlite3`) with WAL mode. `server/database.js` wraps the native driver behind `prepare(sql).get/all/run()` methods. Schema includes users, farms, plots, crop_types, plantings, friends, notifications, messages, daily_actions, gifts, push_subscriptions, checkins, user_achievements, and user_stats tables. A legacy JSON-based database (`server/database-json.js`) still exists but is no longer used.
- **Auth**: JWT-based. `server/middleware/auth.js` verifies the Bearer token and attaches `req.userId` and `req.username`. JWT secret is auto-generated and persisted to `database/.jwt_secret` on first run.
- **WebSocket**: `server/websocket.js` manages per-user connections (`Map<userId, Set<ws>>`). Clients authenticate via a `{ type: "auth", token }` message. Server pushes `crop_mature`, `notification`, and `achievement_unlocked` events. Includes ping/pong heartbeat and message rate limiting.
- **Notification layer**: Provider pattern in `server/notifications/`. `notifier.js` is the central dispatcher; `inAppProvider.js` stores to DB and pushes via WebSocket. Placeholder providers exist for SMS, email, WeChat, and push.
- **Cron job**: `server/jobs/cropGrowthJob.js` runs every 60s via `node-cron`, checks all active plantings for maturity, and triggers notifications + achievement checks.
- **Rate limiting**: `express-rate-limit` applied per-endpoint — auth routes (5/min/IP), general API (60/min/IP), farm actions (30/min/user via JWT key), checkins (5/day/user).

### Client architecture

- `client/index.html` — single-page app with two views: a **senior-friendly home** (3 big buttons: my garden, visit friends, daily tasks) and a **traditional farm grid** (8×6 Canvas + tool bar).
- `client/js/network.js` — `NetworkManager` class: HTTP helpers (`get`/`post`/`delete` with auth headers), WebSocket connection with auto-reconnect and event emitter (`on`/`off`/`emit`).
- `client/js/game.js` — `FarmGame` class: game loop via `requestAnimationFrame`, Canvas click/touch handling, tool-based interaction (cursor/plant/water/harvest), auto-refresh every 5s, particle effects.
- `client/js/ui.js` — `UIManager` class: auth forms, modals (seeds, notifications, friends, messages, checkin, achievements, gifts, tasks, settings), toasts, tool selection, senior home view.
- `client/js/renderer.js` — Canvas rendering: plot grid, crop growth stages, watering indicators, maturity sparkle animation.
- `client/js/push.js` — Browser Push API subscription management.
- `client/js/voice.js` — Speech synthesis for accessibility (crop mature announcements, operation feedback).
- `client/sw.js` — Service Worker for web push notifications.

### Route modules

| Route | File | Key endpoints |
|-------|------|--------------|
| `/api/auth` | `routes/auth.js` | register, login, me |
| `/api/farm` | `routes/farm.js` | GET farm, POST plant/water/harvest, GET friend farm |
| `/api/crops` | `routes/crops.js` | GET crop types, POST water-friend |
| `/api/friends` | `routes/friends.js` | search, request, accept, list, messages, gifts |
| `/api/notifications` | `routes/notifications.js` | list, mark read, push subscribe |
| `/api/checkin` | `routes/checkin.js` | daily check-in with streak |
| `/api/achievements` | `routes/achievements.js` | list and check progress |

### Repository state notes

- The `/review/` directory contains past review reports; the `/screenshots/` directory contains game screenshots. Neither is relevant to active development.
- `scripts/` contains database migration and screenshot/debug scripts — not part of the running application.
- `AUTO_DEV.log` and `AUTO_DEV_STATE.json` are auto-development artifacts, not project files.
