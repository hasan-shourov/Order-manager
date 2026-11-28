# Order Billing App

A private, approval-gated order and billing application. Each approved user gets an independent workspace with categories, items, memos, printable order sheets, and sales summaries. The interface is in English and preserves English/Bengali text entered by users.

## Features

- Firebase Authentication with email/password, optional Google sign-in, and password reset.
- Email/password signups must verify their address with a Firebase verification link.
- Verification screen shows the address, spam reminder, and actions to check, resend, or sign out.
- Server requires the Firebase `email_verified` claim for account data, billing data, and admin actions.
- First owner account is bootstrapped as an approved administrator only after its email is verified.
- New accounts start as Pending and cannot access business data until approved.
- Immediate access blocking for unverified, Pending, Rejected, and Revoked accounts.
- Per-user categories, items, settings, memos, and summaries; users cannot see each other's data.
- Integer-poisha money calculations with percentage or fixed discounts.
- Memo snapshots keep item names, rates, and print headings as they were when saved.
- Idempotent memo saves prevent double submission.
- Sequential per-user memo numbers (`M-000001`).
- Soft-deleted memos disappear from history and reports without double-deducting totals.
- Item rename/archive support without breaking historical summaries.
- Inclusive Dhaka (UTC+6) date-range summaries.
- Responsive UI with a dedicated print layout.
- Server can serve the built web app and API from one process.

## Stack

- Frontend: React 18, Vite 6, TypeScript, Tailwind CSS, React Router
- Backend: Node.js, Express 4, TypeScript, zod
- Database: MongoDB (Atlas or any MongoDB deployment)
- Auth: Firebase Authentication + Firebase Admin SDK token verification
- Tests: Vitest, MongoDB Memory Server, live Firebase E2E checks

## Requirements

- Node.js 18.18 or newer (verified with Node 22.19 / npm 10.9)
- A Firebase project
- A MongoDB database (MongoDB Atlas is supported)

## Quick Start

```powershell
npm install
Copy-Item server\.env.example server\.env
Copy-Item web\.env.example web\.env
```

Fill in both `.env` files, then:

```powershell
npm run dev
```

- Web app: `http://localhost:5173`
- API: `http://localhost:4000`
- Vite proxies `/api` to the API during development.

## Environment Variables

### Browser configuration: `web/.env`

These values are public and are embedded in the frontend bundle. Never put MongoDB credentials, Firebase service-account JSON, or the bootstrap UID here.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Firebase web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase web app ID |
| `VITE_API_BASE_URL` | Optional absolute API base such as `https://api.example.com/api`; leave empty for `/api` |

### Server-only configuration: `server/.env`

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` or `production` |
| `PORT` | API port, default `4000` |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name, default `order_manager` |
| `FIREBASE_PROJECT_ID` | Must match the Firebase web project |
| `BOOTSTRAP_ADMIN_UID` | Firebase UID of the owner's first admin account |
| `CORS_ORIGINS` | Comma-separated allowed browser origins; `*` allows all |
| `SERVE_WEB` | `true` to serve `web/dist` from the API process |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional service-account JSON file path |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Optional service-account JSON string |

`server/.env` is gitignored. Never expose these values to the browser.

## Firebase Setup

1. Create a Firebase project at `https://console.firebase.google.com`.
2. Add a Web app and copy its configuration into `web/.env`.
3. In Authentication, enable **Email/Password**. Enable **Google** only if Google sign-in is wanted.
4. Add your production domain to Authentication > Settings > Authorized domains. `localhost` is normally already allowed for local development.
5. Create the owner account (or have the owner sign in once), then copy its UID from Authentication > Users.
6. Set `BOOTSTRAP_ADMIN_UID` in `server/.env` to that UID and restart the server.
7. Verify the owner's email. The owner is promoted only after a verified token reaches the API.

For this workspace the backend setting is:

```dotenv
BOOTSTRAP_ADMIN_UID=Fx4W3xzQPQVwI7xqbn6Q0KQWtiK2
```

Replace it with the real owner UID in other environments. `.env.example` contains only a placeholder.

On the verified owner's next authenticated request, the server creates or promotes that exact UID to `approved` + `admin`, before the normal approval check. A different UID remains `pending` even if its email is verified. Other new accounts remain `pending` until an administrator approves them.

### Firebase Admin credentials

ID-token signature verification works with only `FIREBASE_PROJECT_ID`; a service account is not required for normal login and API access. If you provide a service account through `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_APPLICATION_CREDENTIALS`, the server also enables Firebase token revocation checks. Application-level access revocation is already enforced on every request. The E2E script also uses an optional service account to mark temporary test users verified.

### Email verification

- Email/password registration sends a Firebase verification email immediately.
- The app shows **Verify your email** with the address, spam reminder, and three actions: **I've verified my email**, **Resend verification email**, and **Sign out**.
- Checking verification reloads the Firebase user and force-refreshes the ID token before calling the API.
- An unverified token receives HTTP `403` with code `EMAIL_NOT_VERIFIED`; no MongoDB account data is exposed.
- Google sign-in uses the same verified-token check. Google accounts normally arrive already verified.
- Email verification does not approve an account or grant the admin role. The verified owner still needs the exact `BOOTSTRAP_ADMIN_UID` match.

## MongoDB Setup

1. Create an Atlas cluster and a database user.
2. In Atlas, open **Network Access** and allow your current IP. For local development only, `0.0.0.0/0` also works but is less restrictive.
3. Copy the connection string into `MONGODB_URI`; keep `retryWrites=true&w=majority`.
4. Set `MONGODB_DB` to the desired database name.

If Atlas connections fail with `tlsv1 alert internal error` / `SSL alert number 80`, the usual cause is that the connecting IP is not on the Atlas access list. Add the current public IP and wait for the rule to become active.

The server creates its indexes on startup, including the unique per-user `clientRequestId` index used for idempotent memo creation.

## Development

```powershell
npm run dev
```

This starts the API with `tsx watch` and Vite with hot reload. `npm run dev` does not require a production build.

## Build and Run

```powershell
npm run build
npm start
```

- `npm run build` compiles the server and builds the Vite app.
- `npm start` runs `server/dist/index.js`.
- With `SERVE_WEB=true`, the server serves `web/dist` and the API from the same origin. Open `http://localhost:4000`.
- With `SERVE_WEB=false`, serve `web/dist` separately and set `VITE_API_BASE_URL` at frontend build time.

## Tests

```powershell
npm run typecheck
npm test
```

Unit and integration tests cover money/rounding rules, Dhaka date boundaries, summary aggregation, web money helpers, the email-verification API gate, bootstrap-owner promotion from Pending, regular-user isolation, and the verification/approval/admin screens. Current results:

- Server: 28 tests passing
- Web: 9 tests passing
- TypeScript typechecks: passing
- Production build: passing
- Live unverified-token enforcement: 11 checks passing against Firebase Auth
- Full live verified-user E2E: requires Firebase Admin service-account credentials; not run in this environment

### End-to-end checks

Build first, then run one of the following.

Temporary local MongoDB with live Firebase Authentication:

```powershell
npm run build
$env:E2E_ALLOW_LIVE="1"
$env:E2E_USE_MEMORY_DB="1"
npm run test:e2e --workspace server
```

Configured MongoDB (for example Atlas) with live Firebase Authentication:

```powershell
npm run build
$env:E2E_ALLOW_LIVE="1"
npm run test:e2e --workspace server
```

The E2E script creates temporary Firebase email/password users, starts the built server on port `4187`, and removes the temporary users and test database afterward. It refuses to run without `E2E_ALLOW_LIVE=1`. The memory mode requires `mongodb-memory-server`; the first run may download a MongoDB binary.

- With `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`, it marks the temporary users' emails verified with Firebase Admin and runs the full verified-user workflow.
- Without a service account, it runs only live unverified-token enforcement checks and prints that the verified-user suite was skipped.
- Real email delivery is not tested by the script because it cannot open the mailbox or click the Firebase verification link.
- Atlas access was not available from the development machine; local MongoDB was used for API checks.

## Business Rules

### Money

- All amounts are integer poisha (`1 BDT = 100 poisha`).
- Line total = `rate * quantity`.
- Subtotal = sum of line totals.
- Percentage discount is limited to 0-100 and is rounded to the nearest poisha.
- Fixed discount cannot exceed the subtotal.
- Payable = subtotal - discount.
- Example: 3 x 11.50 + 2 x 8.00 = 50.50 subtotal; 10% = 5.05; payable = 45.45.

### Memos

- Each memo snapshots item names, unit rates, line totals, category/item references, and the print heading.
- Renaming or archiving an item later does not change historical memos.
- A repeated save with the same `clientRequestId` returns the existing memo instead of creating another.
- Memo numbers are sequential per user.
- Deletes are soft deletes. Repeating a delete is safe and does not change `deletedAt`.

### Summaries

- Grouped by stable item ID, so renames do not split totals.
- Includes active items even when their sales are zero.
- Includes archived items only when they have sales in the selected range.
- Deducts each memo's discount once, not once per line.
- Date ranges use Asia/Dhaka (UTC+6) and include the entire end date.

### Access

- Every protected API request verifies the Firebase token and requires `email_verified === true` before any user or billing data is loaded.
- Every business API request re-checks the caller's MongoDB user status.
- Unverified accounts see the email verification screen and receive `EMAIL_NOT_VERIFIED` from the API.
- Pending, Rejected, and Revoked accounts receive a structured error and are redirected to an account-status screen by the web app.
- Pending accounts with a verified email see **Awaiting admin approval**.
- Administrators can approve, reject, revoke, and re-approve accounts.
- Administrators cannot change their own access.
- The owner bootstrap applies only to an exact UID match, before the approval check, and only after email verification.
- All catalogs, memos, settings, and summaries are scoped to the authenticated owner UID.

## Deployment Notes

1. Set production values in `server/.env` on the host and production Firebase values in `web/.env` at build time.
2. Set the production backend variable `BOOTSTRAP_ADMIN_UID=Fx4W3xzQPQVwI7xqbn6Q0KQWtiK2` (or the intended owner UID).
3. Add the deployment host's IP to Atlas Network Access.
4. Run `npm run build`, then `npm start`.
5. Restart the backend process (or redeploy the service) after changing `BOOTSTRAP_ADMIN_UID`; environment variables are read at startup.
6. Use a process manager or container to keep the API running.
7. Put HTTPS in front of the app. Firebase sign-in and bearer tokens should not travel over plain HTTP in production.
8. If serving the frontend separately, set `SERVE_WEB=false`, configure `CORS_ORIGINS`, and build the web app with the correct `VITE_API_BASE_URL`.

## Project Layout

```text
.
├─ server/
│  ├─ src/
│  │  ├─ lib/          money, date ranges, validation, Mongo helpers
│  │  ├─ middleware/   authentication and approval guards
│  │  ├─ routes/       auth, admin, catalog, memos, settings, summary
│  │  ├─ services/     user initialization, serialization, summary logic
│  │  ├─ tests/        server unit tests
│  │  ├─ app.ts        Express app and static serving
│  │  └─ index.ts      startup and shutdown
│  └─ scripts/
│     └─ e2e-smoke.mjs live E2E workflow
└─ web/
   ├─ src/
   │  ├─ components/   shared UI, shell, guards
   │  ├─ context/      Firebase auth/profile context
   │  ├─ lib/          API client, Firebase setup, money/date helpers
   │  ├─ pages/        order, items, memos, print, summary, settings, admin
   │  └─ tests/        web unit tests
   └─ dist/            production build output
```
"# oder-app" 
# oder-app 
