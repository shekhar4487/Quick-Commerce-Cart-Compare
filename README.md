# 🛒 CartCompare

**Quick commerce ka sabse sasta option.** Enter your grocery list once — CartCompare checks live prices, delivery fees and your bank-card offers across **Zepto, Swiggy Instamart, BigBasket and Flipkart Minutes**, and tells you exactly where to order.

> The original single-file prototype lives at [`cart-compare.jsx`](cart-compare.jsx) — its card-selection flow, offer-matching engine and dark theme were migrated into this full-stack app.

## How it works

```
effectivePrice = productPrice + deliveryFee − bestApplicableOffer(userCards, cartValue, platform)
```

1. **Prices** — a BullMQ worker runs Playwright scrapers against each platform's web search, fuzzy-matches products with Fuse.js (so "Amul Butter 500g" matches "Amul Butter - Pasteurised, 500 g"), normalizes unit prices, and caches results in Redis for 15 minutes (Postgres keeps the long-term history as fallback).
2. **Offers** — the offer engine checks min-order value, first-order eligibility, and whether you actually hold the required bank card, then applies the single highest-saving offer per platform.
3. **Result** — sorted effective totals with full breakdowns, a deep link into the winning app, and (Pro) a queued auto cart-add job.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend + API | Next.js 14 (App Router), Tailwind CSS, shadcn-style components |
| Database | PostgreSQL (Supabase) + Prisma ORM |
| Auth | NextAuth — Google, Apple, Email/SMS OTP (Resend + Twilio), JWT sessions |
| Payments | Razorpay Subscriptions (₹99/mo, ₹799/yr) + webhook |
| Scraping | Playwright (headless Chromium, rotating UAs, en-IN context) |
| Cache / queue | Redis — 15-min price cache, rate limiting, BullMQ jobs |
| Hosting | Vercel (app) + Railway/Render or Docker (worker) |

## Local setup

### Prerequisites
- Node.js 20+
- Docker (easiest way to run Postgres + Redis), or your own instances
- `npx playwright install chromium` if you'll run the worker outside Docker

### Steps

```bash
# 1. Install
npm install

# 2. Infra (Postgres on :5432, Redis on :6379, plus the worker container)
docker compose -f docker/docker-compose.yml up -d postgres redis

# 3. Environment
cp .env.example .env
# Minimal local config:
#   DATABASE_URL=postgresql://cartcompare:cartcompare@localhost:5432/cartcompare
#   DIRECT_URL=  (same as DATABASE_URL locally)
#   REDIS_URL=redis://localhost:6379
#   NEXTAUTH_SECRET=$(openssl rand -base64 32)
#   NEXTAUTH_URL=http://localhost:3000

# 4. Database
npm run db:push     # create tables
npm run db:seed     # seed the launch offer set

# 5. Run (two terminals)
npm run dev         # Next.js on http://localhost:3000
npm run worker      # BullMQ scrape worker (needs: npx playwright install chromium)
```

**Dev conveniences**
- No Resend/Twilio keys? OTP codes are printed to the server console in development.
- No Redis? The app still works — prices fall back to DB/estimates, rate limiting fails open, OTP login is disabled.
- No live scrape yet? Comparisons use the built-in estimate table and queue scrape jobs so the next run is live.

## Deployment

### Frontend + API → Vercel
1. Import the repo, framework = Next.js. `npm run build` already runs `prisma generate`.
2. Set all env vars from `.env.example` (use the **pooled** Supabase URL for `DATABASE_URL`, direct URL for `DIRECT_URL`).
3. Run migrations from CI or locally: `npx prisma migrate deploy`.

### Worker → Railway / Render (Docker)
1. Create a service from `docker/Dockerfile.worker` (Railway: "Deploy from repo", set the Dockerfile path).
2. Env vars: `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `SCRAPER_HEADLESS=true`.
3. Use the same Redis instance as the app (Upstash/Railway Redis). BullMQ requires a Redis that supports blocking commands — Upstash works on the paid tier.

### Supabase
- Create the project in `ap-south-1` (Mumbai) for Indian users.
- Because all DB access goes through Prisma with the service connection (never the client-side anon key), enable **RLS on all tables with no public policies** — this blocks any direct PostgREST access:
  ```sql
  alter table "User" enable row level security;            -- repeat per table, or:
  -- in SQL editor: select format('alter table %I enable row level security;', tablename)
  --                from pg_tables where schemaname = 'public';
  ```

### Razorpay
1. Create two **Plans** in the dashboard: ₹99/month and ₹799/year → paste ids into `RAZORPAY_PLAN_MONTHLY` / `RAZORPAY_PLAN_YEARLY`.
2. Add a webhook → `https://<your-domain>/api/payments/webhook` with secret = `RAZORPAY_WEBHOOK_SECRET`, events: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted`, `subscription.completed`, `subscription.expired`.

### Auth providers
- **Google**: OAuth client with redirect URI `https://<domain>/api/auth/callback/google`.
- **Apple**: Services ID + key from the Apple Developer portal; `APPLE_CLIENT_SECRET` is the signed JWT (regenerate before its 6-month expiry). Redirect URI `https://<domain>/api/auth/callback/apple`.

## API

All routes (except the Razorpay webhook and OTP send/verify) require a NextAuth session. Rate limits are per-IP and per-user via Redis.

| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/otp/send` | Send a 6-digit OTP to email or +91 phone |
| POST | `/api/auth/otp/verify` | Validate an OTP (web clients use `signIn("otp")` instead) |
| GET/PUT | `/api/user/profile` | Profile, plan, platform & notification prefs |
| GET/PUT | `/api/user/cards` | Saved bank cards (PUT replaces the set) |
| POST | `/api/compare` | Run a comparison (free plan: 5/month) |
| GET | `/api/compare/history` | Last 30 days of comparisons |
| GET/POST | `/api/lists` | Saved grocery lists |
| DELETE | `/api/lists/:id` | Delete a list |
| POST | `/api/payments/create-subscription` | Create a Razorpay subscription |
| POST | `/api/payments/webhook` | Razorpay webhook (signature-verified) |
| GET | `/api/offers` | Active offers (`?refresh=1` = admin re-scrape) |
| POST | `/api/cart/auto-add` | Pro: queue auto cart-add on a platform |

## Project structure

```
app/                Next.js App Router pages + API routes
components/         UI (shadcn-style primitives + the compare wizard)
hooks/              useCompare, useCards
lib/                prisma, redis, auth, razorpay, offer engine, compare service
prisma/             schema.prisma + seed
scraper/            Playwright scrapers (one per platform) + offers + autocart
jobs/               BullMQ queues + worker entrypoint
docker/             Worker Dockerfile + local docker-compose
types/              Shared TypeScript interfaces
```

## Security

- JWT-backed sessions on every protected route; ownership checks on all user data
- Redis rate limiting on auth, compare, payment and autocart endpoints (fails open)
- Zod validation on every request body; Prisma parameterizes all SQL
- Razorpay webhook HMAC verification on the raw body (constant-time compare)
- HSTS, X-Frame-Options, nosniff, CORS restricted to the production origin
- OTPs stored as SHA-256 hashes, single-use, 10-min TTL, 5 verify attempts
- Scraper runs in an isolated Docker container as a non-root user
- All secrets via environment variables; Supabase RLS as defense-in-depth

## Honest limitations (read before launch)

- **Scraper selectors need maintenance.** Quick-commerce frontends are obfuscated React apps that change weekly and are location-gated. The scrapers use resilient href + ₹-regex extraction with a Bengaluru geolocation default, but expect to tune them. Empty scrape = soft fail = last cached price wins.
- **Auto cart-add** works against an anonymous browser session. Zepto/Instamart bind carts to logged-in accounts, so for those apps the deep link is the realistic UX; the Playwright auto-add flow is the foundation for a browser-extension companion (see `scraper/autocart.ts`).
- **Scraping ToS** — review each platform's terms before commercial launch; prefer official affiliate/partner APIs where available.
- WhatsApp deal alerts need a WhatsApp Business API provider (e.g. Twilio/Gupshup) — notification prefs are stored, sender not yet wired.
