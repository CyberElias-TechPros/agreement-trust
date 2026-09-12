# TaskContract — Agreement Trust

> **The contract for how work gets done.**
> Version-locked agreements, structured interactions, and an audit trail that testifies.

TaskContract is a **delegation governance platform**. It replaces ambiguous delegated work — "I thought you meant…" — with immutable task agreements: every contract has a lifecycle (`draft → sent → accepted → in progress → submitted → approved / rejected → archived`), every edit becomes a numbered version with a stated reason, and every interaction is typed and recorded.

The product blueprint lives in [`plan.md`](plan.md) — the single source of truth for domain rules, RBAC and the state machine.

---

## Experience

The product ships two deliberately different visual worlds:

| Surface | Direction |
| --- | --- |
| **Public site** (landing, auth, 404) | Cinematic **ink** — deep indigo night, brass seals, editorial serif display type, film grain, aurora atmosphere, choreographed motion |
| **App workspace** (dashboard, contracts…) | **Archival parchment** — warm paper, ink text, ledger typography, quiet precision |

Signature interactions: a seal-stamp preloader, a hero agreement document you can **seal live** (terms reveal, signature draws itself, the brass stamp lands), an interactive state-machine explorer, magnetic CTAs, count-up stats, scroll-tracked progress, and a full page-transition system. All motion respects `prefers-reduced-motion`; all interactions are keyboard-accessible.

## Demo mode (no backend required)

The frontend detects when the API is unreachable and **gracefully degrades to an in-browser demo workspace** — the same domain logic, persisted in `localStorage`. A dismissible banner always makes the state honest.

- **Demo workspace entry**: on the sign-in screen, click **“Explore the demo workspace”**
- Demo credentials: `alex.morgan@northwind.studio` / `demo1234`
- Demo mode can also be forced with `VITE_DEMO_MODE=true`

Everything works in the demo: create contracts, run the state machine, post interactions, invite members, edit versions, and watch analytics recompute.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 · TypeScript · Vite 5 · Tailwind CSS · shadcn/ui · framer-motion |
| Routing / data | react-router-dom · TanStack Query |
| Backend API | Node.js · Express · Mongoose (MongoDB) |
| Auth | JWT (access + rotating refresh tokens) · bcrypt (cost 12) |
| Tests | Vitest + Testing Library |

## Getting started

```sh
# 1. Install frontend dependencies
npm install

# 2. Run the frontend (http://localhost:8080)
npm run dev
```

That's enough to explore the product in demo mode. To run the **real backend**:

```sh
# 3. Configure the API
cp server/.env.example server/.env   # fill in MONGODB_URI + JWT_SECRET

# 4. Install & run the API (http://localhost:3001)
cd server && npm install && npm run dev
```

Frontend expects the API at `VITE_API_URL` (defaults to `http://localhost:3001/api/v1`).

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-checked production build |
| `npm run lint` | ESLint (0 errors) |
| `npm test` | Vitest suite |
| `npm run preview` | Serve the production build |

## Environment variables

**Frontend** (`.env` at repo root — see `.env.example`)

| Var | Default | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `http://localhost:3001/api/v1` | Backend base URL |
| `VITE_DEMO_MODE` | `false` | Force demo mode |
| `VITE_APP_NAME` | `TaskContract` | Brand name |

**Backend** (`server/.env` — see `server/.env.example`)

| Var | Purpose |
| --- | --- |
| `PORT` | API port (default `3001`) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Signing secret — generate with `openssl rand -hex 48` |
| `JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | Token lifetimes (default `15m` / `7d`) |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `NODE_ENV` | `development` \| `production` |

Production **refuses to start** without `MONGODB_URI` and `JWT_SECRET`.

## Architecture

```
Browser
  ├─ React app (Vite) ── public experience + app workspace
  │    └─ ApiClient ─── live API ⇄ in-browser demo store (fallback)
  └─ HTTPS
        └─ Express API (server/)
             ├─ JWT auth · RBAC (owner/admin/manager/executor/observer)
             ├─ Contract state machine · append-only versions
             ├─ Interactions · notifications · audit log
             └─ MongoDB (Mongoose models + indexes)
```

- **API contract types** are centralized in `src/types/api.ts` and mirrored by the demo adapter — no contract drift.
- **Domain rules** (state machine, analytics) are implemented identically in the server and in `src/lib/demo/demoDb.ts`; the demo store is unit-tested.
- **Frontend deployment**: static SPA — Vercel/Netlify/CDN. The API is a standard Node service (the target production architecture is the API on Cloudflare Workers with D1/R2/KV per the blueprint; the Express server is the reference implementation).

## Security posture

- JWT access tokens (short-lived) + **rotating refresh tokens** stored server-side, capped per user
- Passwords: bcrypt (cost 12); registration/login/change-password validated server-side
- **Rate limiting** on auth (anti brute-force) and API routes
- Security headers on every response (CSP, HSTS over HTTPS, nosniff, frame-deny)
- CORS origin allow-list; no credentials in the repo (see `.gitignore` / `server/.env.example`)
- Authorization is enforced **server-side** via role hierarchy + membership checks (IDOR-safe by design); ownership checks in contract routes
- Audit log for every sensitive action

## Testing

```sh
npm test
```

- **Domain** — state machine transitions (valid + invalid), analytics consistency, audit/interaction side effects, seed integrity
- **UI** — status/priority badges, logo, reveal, landing smoke tests (sections render, the seal interaction works), auth + 404 pages render

## SEO & accessibility

- Complete metadata (title, description, canonical, Open Graph, Twitter cards), JSON-LD (`Organization`, `SoftwareApplication`, `WebSite`, `WebPage`)
- `sitemap.xml`, `robots.txt` (app routes excluded from crawling by design)
- Semantic landmarks, focus-visible rings, aria-labels on icon controls, `prefers-reduced-motion` support, AA-contrast palettes

## Project structure

```
src/
  components/
    landing/      Preloader, AgreementCard (seal interaction), StateMachine
    motion/       Reveal, CountUp, Magnetic, CursorGlow, ScrollProgress
    ui/           shadcn/ui primitives
    ...           AppLayout, AppSidebar, badges, DemoBanner, Logo
  contexts/       AuthContext (session + demo-mode boot)
  hooks/          usePageMeta
  lib/
    api.ts        ApiClient — live ⇄ demo routing, typed contracts
    demo/         demoDb (in-browser store + domain rules), demoApi (adapter)
  pages/          Landing, auth/*, Dashboard, Contract*, Reports, Settings, Profile, Notifications, NotFound
  types/          api.ts (API contracts), contracts.ts (domain types)
  test/           unit + smoke tests
server/
  routes/         auth, organizations, contracts, interactions, notifications, categories, users
  models/         Mongoose schemas (User, Org, Membership, Contract, Version, Interaction, Notification, AuditLog, …)
  middleware/     auth (JWT + RBAC), rateLimit, security, errorHandler
  utils/          validate (input validation)
  config/         env-driven configuration
```

## Documentation

- [`plan.md`](plan.md) — full product blueprint (schema, RBAC, state machine, UI spec)
- [`CODEBASE_ANALYSIS.md`](CODEBASE_ANALYSIS.md) — audit of the original codebase and what changed
- [`server/.env.example`](server/.env.example) — backend configuration reference

## License

Proprietary — all rights reserved.
