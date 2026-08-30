# Trade Matrix API

NestJS API for authentication, user management, file-backed avatar uploads, and PostgreSQL persistence via Prisma.

## Local development

1. Install dependencies:

```bash
pnpm install
```

2. Start PostgreSQL in Docker:

```bash
docker compose up -d db
```

3. Set `DATABASE_URL` in `.env` for the host machine:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/trade_matrix?schema=public"
```

4. Apply Prisma migrations:

```bash
pnpm prisma migrate deploy
```

5. Start the API:

```bash
pnpm start:dev
```

Swagger is available at `http://localhost:8000/docs`.

## Run in Docker

To run both the API and the database in Docker:

```bash
docker compose up --build
```

Inside the `api` container, `DATABASE_URL` must point to the `db` service:

```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/trade_matrix?schema=public"
```

## Deployment environment variables

Set these variables in the deployment environment before starting the API.

### Required

```env
NODE_ENV=production
PORT=8000
DATABASE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
PASSWORD_RESET_TOKEN_SECRET=
TWO_FACTOR_TOKEN_SECRET=
TOTP_ISSUER=TradeMatrix

AUTH_REFRESH_COOKIE_NAME=refresh_token
AUTH_TWO_FACTOR_COOKIE_NAME=two_factor_token
AUTH_COOKIE_DOMAIN=
AUTH_COOKIE_SECURE=true

MAIL_FROM=
MAIL_REPLY_TO=
BREVO_API_KEY=

GOOGLE_AUTH_CLIENT_ID=
GOOGLE_AUTH_CLIENT_SECRET=
GOOGLE_AUTH_CALLBACK_URL=
GOOGLE_AUTH_SUCCESS_REDIRECT_URL=
GOOGLE_AUTH_TWO_FACTOR_REDIRECT_URL=

CLOUD_NAME=
CLOUD_KEY=
CLOUD_SECRET=
```

### Optional

```env
CORS_ORIGIN=*
IPINFO_TOKEN=
INITIAL_ADMIN_EMAIL=
```

## Notes

- Run `pnpm prisma migrate deploy` during deployment before serving traffic.
- `AUTH_COOKIE_SECURE` should be `true` in production behind HTTPS.
- `MAIL_FROM` is the sender identity shown to Brevo. `MAIL_REPLY_TO` controls where replies go.
- `BREVO_API_KEY` is required for transactional email delivery over HTTPS via the Brevo API.
- Google auth requires the callback URL to match the value configured in Google Cloud.
