## Docker

This project can run with its own dedicated PostgreSQL container and does not
need to share the `leo-ai-api` database container.

1. Start the dedicated database:

```bash
docker compose up -d db
```

2. Use the Docker-mapped database URL in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/trade_matrix?schema=public"
```

3. Run Prisma migrations from the host:

```bash
pnpm prisma migrate dev
```

4. Start the API locally:

```bash
pnpm start:dev
```

To run both the API and the database in Docker:

```bash
docker compose up --build
```
