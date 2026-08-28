# TaxBridge.ng — Backend (Phase B1: scaffold, data model, auth)

This is the first backend phase: project setup, the full Prisma data model
(mirroring everything built in the frontend prototype), and authentication
for all four account types — clients, individual professionals, firms, and
admin.

Resource routes (engagements, the firms marketplace, messaging, leads,
admin operations) are **not** in this phase yet — that's Phase B2, built on
top of this foundation.

## Stack

- Node.js + Express
- PostgreSQL (built and tested against [Neon](https://neon.tech))
- Prisma ORM
- JWT auth (`jsonwebtoken`) + `bcryptjs` for password hashing

## 1. Install dependencies

```bash
npm install
```

## 2. Set up your database

1. Create a Postgres database (e.g. a free Neon project).
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` with your
   connection string.
3. Generate a `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Paste the output into `.env` as `JWT_SECRET`.

## 3. Run the first migration

```bash
npx prisma migrate dev --name init
```

This creates all the tables (`users`, `firms`, `engagements`, `messages`,
`leads`, `admins`) from `prisma/schema.prisma`.

## 4. Create the admin account

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`, then:

```bash
npm run seed
```

This is what replaces the old hardcoded `taxbridge2026` passcode from the
frontend prototype. Run it again any time you want to change the admin
password — it upserts, so it's safe to re-run.

## 5. Run the server

```bash
npm run dev
```

The API starts on `http://localhost:4000` (or whatever `PORT` you set).
Check it's alive:

```bash
curl http://localhost:4000/health
```

## What's implemented in this phase

- `POST /api/auth/client/signup`, `/login`, `GET /me`
- `POST /api/auth/professional/signup`, `/login`, `GET /me`
- `POST /api/auth/firm/signup`, `/login`, `GET /me`
- `POST /api/auth/admin/login`, `GET /me` (no public signup — see seed script)

Every login/signup returns `{ token, user|firm|admin }`. Send the token
back on subsequent requests as `Authorization: Bearer <token>`.

## Deploying

- **Database**: Neon (already assumed above).
- **API**: Render — set `Build Command` to `npm install && npx prisma generate`,
  `Start Command` to `npm start`, and add all the `.env` variables (plus
  `DATABASE_URL` pointing at your production Neon database) as environment
  variables in the Render dashboard. Run `npx prisma migrate deploy` once
  from a Render shell (or a one-off job) before first boot, and `npm run seed`
  once to create the production admin account.
- **Frontend**: once the frontend is switched from `window.storage` to this
  API (Phase B3+), it stays on Vercel as before — just point it at your
  Render API URL and set `CORS_ORIGINS` here to your Vercel domain.

## Next backend phases

- **B2**: engagement request + admin manual-matching endpoints, firms
  marketplace endpoints (search/filter), firm dashboard endpoints
- **B3**: messaging endpoints (with the same visibility rules already built
  into the frontend prototype), verification-level admin endpoints, leads
  (legacy individual-professional track) endpoints
- **B4**: switch the frontend from `window.storage` to this API
