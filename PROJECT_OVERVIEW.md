# Order Billing App — Project Overview

## Summary

**Order Billing App** is a full-stack order management and billing system designed for small businesses that need a private, controlled workflow. It lets approved users maintain item catalogs, prepare orders, save printable billing memos, and review sales summaries while keeping each user's business data isolated.

The project combines a React web interface with a Node.js API and MongoDB data store. Firebase Authentication provides account registration, email/password and Google sign-in, email verification, password resets, and secure ID-token validation.

## Core Features

### Account and Access Management

- Email/password and optional Google authentication
- Firebase email-verification workflow
- Account approval states: Pending, Approved, Rejected, and Revoked
- Immediate access protection for unverified or unauthorized accounts
- Administrator approval and account-management tools
- Automatic promotion of a configured owner UID to the first administrator
- Data isolation between individual users

### Orders and Billing

- Create and manage item categories
- Add, edit, rename, archive, and organize items
- Create an order from the item catalog
- Apply percentage or fixed-amount discounts
- Calculate monetary values safely using integer poisha
- Prevent duplicate memo submissions with idempotent request IDs
- Generate sequential per-user memo numbers
- Display, print, and review saved billing memos
- Preserve historical item names, rates, and print headings in memo snapshots

### Reports and Summaries

- View sales summaries over inclusive date ranges
- Use Dhaka timezone boundaries (`UTC+6`) for date filtering
- Exclude soft-deleted memos from reports
- Keep item-renaming and archiving operations from breaking historical summaries

### User Experience

- Responsive interface for desktop and mobile use
- Dedicated printable memo layout
- English and Bengali text support
- Clear verification, approval, rejection, and administrator screens
- Loading, validation, access-denied, and configuration-error states

## Technology Stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 6, Tailwind CSS, React Router |
| Backend | Node.js, Express 4, TypeScript, Zod |
| Database | MongoDB |
| Authentication | Firebase Authentication and Firebase Admin SDK |
| Testing | Vitest and MongoDB Memory Server |
| Development | npm workspaces, tsx, and Concurrently |

## System Architecture

```text
Browser / React UI
        |
        | HTTPS + Firebase ID token
        v
Express API
  - Authentication middleware
  - Approval and administrator checks
  - Catalog and memo routes
  - Summary and settings services
        |
        v
MongoDB
  - Per-user categories and items
  - Memos and memo snapshots
  - User status and account settings
```

The frontend communicates with the API using Firebase ID tokens. The server validates these tokens, enforces email verification and account status, and scopes all business operations to the authenticated user's identity.

## Security and Data Isolation

- API routes require an authenticated Firebase ID token.
- Unverified accounts cannot access account or billing data.
- Pending, rejected, and revoked users are blocked at the server level.
- Administrative routes require both authentication and the admin role.
- MongoDB records are scoped by user UID.
- Browser configuration contains only public Firebase web settings; service-account and database credentials remain server-side.

## Money and Historical Accuracy

Monetary calculations use integer poisha values rather than floating-point arithmetic. This avoids rounding-related billing errors. Saved memos retain snapshots of item and print information, ensuring that later edits or renames do not change previously generated records.

## Main Application Areas

- **Order:** Create a new order and calculate its billing details.
- **Items:** Manage categories and catalog items.
- **Memos:** Review saved billing memos and open print views.
- **Summary:** Analyze sales over configurable date ranges.
- **Settings:** Manage printable memo and business details.
- **Admin:** Approve or manage application users.

## Development and Deployment

The project is organized as an npm workspace containing separate `server` and `web` packages. During development, Vite serves the frontend and Express serves the API. For production, the React app can be built and either hosted separately or served directly by the Express process.

Both Firebase web configuration and MongoDB/Firebase Admin environment settings are required before the application can run.

## Ideal Use Cases

This project is suitable for a shop or small operation that needs:

- A private order-taking and billing workflow
- Printable customer memos
- Controlled user registration and administrator approval
- Per-user catalogs and sales records
- Accurate discounts and monetary calculations
- English/Bengali order and billing content
