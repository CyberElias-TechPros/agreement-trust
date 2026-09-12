# Codebase Analysis Report

## Date: 2026-09-12
## Project: TaskContract (Agreement Trust)

---

## Executive Summary

TaskContract is a **delegation governance platform**: version-locked task agreements with structured interactions, a governed lifecycle and an immutable audit trail. The repository contained a functional React/Vite frontend and an Express/MongoDB backend — but with critical security issues, generic visual design, broken SEO, no way to run without a database, and weak testing. This report documents what was found and what changed.

---

## 1. Critical findings (initial state)

| Severity | Finding | Resolution |
| --- | --- | --- |
| 🔴 Critical | **Leaked MongoDB Atlas credentials** committed in `server/.env` and hardcoded as fallbacks in `server/config/index.js` | Removed from the working tree; config now env-only and refuses to boot in production without `MONGODB_URI` + `JWT_SECRET`; `server/.env` git-ignored; `server/.env.example` added. ⚠️ The credentials were published to git history — **rotate them** |
| 🔴 Critical | `index.html` was Lovable boilerplate ("Lovable App" title, Lovable OG tags) — zero SEO | Complete metadata rewrite: title, description, canonical, OG/Twitter cards, JSON-LD, favicon, theme-color |
| 🟠 High | App unusable without a live MongoDB backend | **Demo mode**: `ApiClient` degrades to an in-browser store (`src/lib/demo/`) implementing the same domain rules, clearly flagged in the UI |
| 🟠 High | No input validation, no rate limiting, no security headers, weak default JWT secret | `server/utils/validate.js`, auth + API rate limiters, security-header middleware, production env enforcement |
| 🟠 High | Landing/auth pages were generic SaaS templates | Full art-directed rebuild ("ink & seal" design system — see below) |
| 🟠 Medium | 1 MB single bundle | Route-level code splitting (app pages lazy-loaded; initial chunk ≈ 595 kB, Reports/recharts isolated at 419 kB) |
| 🟠 Medium | Dead code (`src/pages/Index.tsx`, `src/App.css`, `src/data/mockData.ts`) | Removed |
| 🟠 Medium | One placeholder test | 15 real tests across domain logic, UI components and page smoke tests |
| 🟠 Medium | Thin Lovable README | Rewritten with setup, env, architecture, security, testing docs |

## 2. Design system — "Ink & Seal"

Two coordinated visual worlds:

- **Public experience** (landing, auth, 404): cinematic ink — deep indigo night (`#080a12`), brass seal accents, Fraunces display serif + Plus Jakarta Sans + JetBrains Mono, aurora atmosphere, film grain, blueprint grid. Signature interactions: seal-stamp preloader, live-sealing hero agreement (terms reveal → signature draws → brass stamp lands), interactive contract-lifecycle explorer, marquee, count-up stats, magnetic CTAs, cursor glow, scroll-tracked progress hairline.
- **App workspace**: archival parchment — warm paper background, ink typography, ledger-style badges with the same serif/mono pairing, deep-ink sidebar with organization switcher, page transitions, dark/light theme toggle.

Motion principles: choreographed entrances with a shared easing curve, `prefers-reduced-motion` respected everywhere, keyboard-first focus states, semantic landmarks and aria labels throughout.

## 3. Demo workspace (in-browser)

`src/lib/demo/demoDb.ts` persists a seeded multi-org workspace to `localStorage` and implements the **same business rules** as the server: state-machine transitions with validation, append-only versions, typed interactions, notifications and audit entries. `demoApi` mirrors the exact API contract (`src/types/api.ts`). The demo is unit-tested and entered from the sign-in screen; a dismissible banner keeps the state honest.

## 4. Backend hardening

- Credentials fully externalized; production boot guards
- Validation on register/login/change-password (`validate.js`)
- Rate limiting: auth (20 req / 10 min / IP) and general API (300 req / min)
- Security headers: CSP, HSTS (HTTPS), nosniff, frame-deny, referrer policy, permissions policy
- CORS allow-list with origin callback; `x-powered-by` disabled
- Access token lifetime tightened to 15 min (refresh 7d, rotating)
- Structured request logging

## 5. Testing

```
npm test  →  3 files, 15 tests
```

- `demoDb.test.ts` — state machine (valid + invalid transitions), analytics consistency, audit/interaction side effects, seed integrity
- `components.test.tsx` — badges, logo, reveal
- `landing.test.tsx` — full landing render, seal interaction, login + 404 smoke

`npm run build` (type-checked) and `npm run lint` (0 errors) pass.

## 6. Remaining considerations

1. **Rotate the leaked MongoDB credentials** (they're in git history regardless of removal).
2. The Express backend is the reference implementation; per the blueprint, the production target is the API on Cloudflare Workers + D1/R2/KV — porting `server/routes` is the next infrastructure milestone.
3. Notification preferences and session management UI (Settings) still need backend endpoints.
4. Email delivery (invites, password reset) requires a provider integration.
5. No E2E suite yet (Playwright recommended for the seal interaction and contract flow).
