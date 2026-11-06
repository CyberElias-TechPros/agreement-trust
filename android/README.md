# TaskContract for Android

Fully native Android client for the TaskContract Agreement Trust Protocol.
**Kotlin + Android framework APIs only** — no WebView, no AndroidX, no Compose,
no third-party runtime dependencies. Every screen is native Views; charts and
the brass seal are drawn with Canvas.

Requires Android 8.0+ (API 26). Targets API 34. ~1.4 MB installed APK.

## Install

Grab `TaskContract-release.apk` (built by `tools/build.sh release`) and open it
on your device — allow "install from unknown sources" when prompted. The APK
is signed with the workspace release key (see *Signing* below).

## Two workspace modes

| | On this device (default) | Team server |
|---|---|---|
| Storage | On-phone SQLite, fully offline | Your TaskContract worker (`/api/v1`) |
| Accounts | Created & stored on the phone (PBKDF2-SHA256, 80k iterations) | Server accounts, JWT + rotating refresh tokens |
| Sync | — | Local mirror + persistent outbox; offline writes replay on reconnect |
| Demo | One tap: Northwind Studio (6 people, 7 contracts) | Server seed with the same dataset |

Demo sign-in (device mode): **alex.morgan@northwind.studio / demo1234**

The server mode speaks the exact same API as the web client — point it at
`https://taskcontract-api.cyberelias.workers.dev/api/v1` (default) or your own
deployment (`node worker/node-server.mjs` for local testing, e.g.
`http://10.0.2.2:8787/api/v1` from the emulator).

## Feature map

- **Auth** — register (creates org), login, 2FA (TOTP + one-time backup codes),
  forgot/reset password (server), invite links (`taskcontract://invite?token=…`),
  biometric/device-credential app lock, change password, profile editing.
- **Contracts** — 4-step create wizard (Basics → People → Terms → Review),
  draft or create-and-send, TCP-YYYY-NNNNN numbering, edit with versioning
  (non-draft edits require a change reason and executor acknowledgment).
- **Lifecycle** — the full state machine: draft → sent → accepted → in progress
  → submitted → approved (sealed ◈) / returned; archive & reopen. Role-aware
  action buttons mirror the server's RBAC exactly.
- **Typed interactions** — comments, progress updates (slider), clarifications,
  scope proposals, issues & resolutions; every entry timestamped and attributed.
- **People** — initiator / executor / observers per contract; org roles
  (owner, admin, manager, executor, observer, auditor), invites with share
  links, role management, categories with colors.
- **Audit trail** — checksummed (SHA-256) tamper-evident log per contract;
  hidden from observers, exportable by auditors.
- **Notifications** — in-app inbox + system notifications (activity & deadline
  channels), per-type preferences, unread badges, deadline sweep (24h before /
  overdue) via JobScheduler + AlarmManager, survives reboot.
- **Reports** — stat cards, weekly activity bars, status donut, sealed-per-month,
  team performance (completed, avg days, on-time %) — all native Canvas.
- **Platform** — home-screen widget (active / to-review / next deadline), app
  shortcut (new contract), deep links (`taskcontract://contract/{id}`, `new`,
  `notifications`, `invite`), SAF file attachments (≤10 MB), share-sheet export
  (JSON/CSV per contract, whole-workspace JSON) via a no-permission
  ContentProvider, light/dark/system theme ("paper & ink" brand).

## Security

- Session tokens encrypted at rest with AES-GCM via Android Keystore.
- Device-mode passwords: PBKDF2-SHA256, 80,000 iterations, per-user salt,
  constant-time comparison.
- 2FA: RFC 6238 TOTP (SHA1, 6 digits, ±1 step skew) + single-use backup codes.
- Biometric app lock: BiometricPrompt with device-credential fallback.
- Cleartext HTTP allowed only for localhost/10.0.2.2 (development); everything
  else requires HTTPS (`network_security_config.xml`).
- Audit entries are checksum-chained per entry (`action|entity|created|prev`).

## Build

### Option A — direct SDK pipeline (no Gradle)

```bash
export JAVA_HOME=/path/to/jdk17+          # javac + java + keytool
export KOTLIN_HOME=/path/to/kotlinc       # Kotlin 2.0.x distribution
export ANDROID_SDK=/path/to/sdk           # build-tools/34.0.0 + platforms/android-34
bash android/tools/build.sh debug         # or: release
# → android/build/TaskContract-{debug|release}.apk (signed + aligned)
```

Pipeline: aapt2 compile/link → kotlinc → javac (R) → d8 → zipalign → apksigner.

### Option B — Gradle / Android Studio

Open the `android/` folder in Android Studio (Koala+) or run:

```bash
cd android && ./gradlew assembleDebug
```

AGP 8.5.2, Kotlin 2.0.21, Gradle 8.7. Zero external dependencies — only the
Kotlin stdlib. CI (`.github/workflows/android.yml`) runs both test suites and
assembles the APK on every push touching `android/` or `worker/`.

### Tests (pure JVM, no emulator needed)

```bash
bash android/tools/test.sh domain   # 80 checks: JSON, PBKDF2, RFC 6238 vectors,
                                    # state machine, RBAC, validators, time
node worker/node-server.mjs &       # local backend on :8787
bash android/tools/test.sh api      # 46 checks: the shipped RemoteApi against
                                    # the real worker — auth, refresh rotation,
                                    # lifecycle, versions, audit, 2FA, reset…
node worker/test.mjs                # the worker's own E2E suite
```

## Signing

- `keystore/debug.jks` — auto-generated on first debug build.
- `keystore/release.jks` — workspace release key (alias `taskcontract`,
  store/key password `taskcontract`). **Both are git-ignored.** For production
  distribution, generate your own key and export `KEYSTORE_PASSWORD` /
  `KEY_ALIAS` before `build.sh release` — and keep it safe: Android requires
  the same key for app updates.

## Architecture

```
app/src/main/java/com/taskcontract/android/
├── core/        Json (parser/writer), Crypto (PBKDF2/TOTP/base32), Async+Bus
├── domain/      Models, Rules — the state machine & RBAC ported 1:1 from
│                worker/src/{rbac,domain}.js (verified by tests)
├── data/        Db (SQLite v3, mirrors worker schema), LocalEngine (full
│                offline domain engine), Repository (device/server facade,
│                mirror + outbox sync), Session (Keystore-encrypted), Seed
├── remote/      RemoteApi — HttpURLConnection client, single-flight token
│                refresh, PATCH tunnelling, offline detection
├── platform/    Notifications, JobService + AlarmManager deadline sweep,
│                BootReceiver, widget, share/export ContentProvider
├── ui/          Palette/Fonts/Shapes ("ink & seal" design system), view DSL,
│                Canvas charts + SealView, dialogs & sheets
│   └── screens/ Welcome/Auth, Dashboard, Contracts, Detail, Create/Edit,
│                Search, Notifications, Reports, Team, Settings, Profile
├── App.kt       Composition root
└── MainActivity.kt  Single activity + view-back-stack Navigator
```

**Sync model (server mode):** reads refresh a local SQLite mirror so the app is
instant and offline-readable. Writes go API-first; when offline they apply to
the mirror and enqueue into a persistent outbox. On reconnect the outbox
replays in order, then the mirror re-pulls (server wins conflicts; rejected
items are dropped after retries and surface via re-sync).
