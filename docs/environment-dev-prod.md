# Dev/Prod Environment Setup (Vercel + Supabase + Convex + Railway)

This repo should run with separate dev and prod backends.

## 1) Convex setup

Use one Convex deployment for dev and one for prod.

1. Copy templates:
   - `.env.convex.dev.example` -> `.env.convex.dev`
   - `.env.convex.prod.example` -> `.env.convex.prod`
2. Put deployment selectors into each file:
   - `.env.convex.dev`: `CONVEX_DEPLOYMENT=...` (dev deployment)
   - `.env.convex.prod`: `CONVEX_DEPLOYMENT=...` (prod deployment)
3. Dev workflow:
   - `pnpm dev:convex` (watch mode)
   - or `pnpm dev:convex:once` (single push/codegen)
4. Prod deploy:
   - `pnpm deploy:convex:prod`

Check env values in Convex deployment:

- Dev: `pnpm convex:env:list:dev`
- Prod: `pnpm convex:env:list:prod`

## 2) Chat app (Vercel project env vars)

Set these per Vercel project (dev/prod):

- `NEXT_PUBLIC_SUPABASE_URL` -> dev/prod Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` -> matching anon key
- `NEXT_PUBLIC_CONVEX_URL` -> matching Convex deployment URL
- `NEXT_PUBLIC_COOKIE_DOMAIN` -> environment domain
- `NEXT_PUBLIC_MAIN_APP_URL` -> environment app URL

Use `apps/chat/.env.local.example` as local template.

## 3) Worker app (Railway service env vars)

Use separate Railway services (or separate environments) for dev and prod.
Set these values per environment:

- `CONVEX_URL` -> matching Convex URL
- `SUPABASE_URL` -> matching Supabase URL
- `SUPABASE_SERVICE_KEY` -> matching service role key
- `INTERNAL_API_KEY` -> must match caller side
- `APP_BASE_URL` -> matching frontend base URL

Use `apps/worker/.env.example` as template.

## 4) Recommended promotion flow (dev -> prod)

1. Push/test schema changes in `musait-dev` (Supabase dev).
2. Apply same migration set to `musait-app` (Supabase prod).
3. Deploy Convex code to dev first (`pnpm dev:convex:once`), test.
4. Promote Convex to prod (`pnpm deploy:convex:prod`).
5. Deploy Railway dev service, verify, then Railway prod.
6. Deploy Vercel dev project, verify, then Vercel prod project.

Do not move schema by manual dump/import unless emergency; keep migration history as source of truth.
