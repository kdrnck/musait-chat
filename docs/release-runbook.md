# Musait Chat Release Runbook

Bu dokuman `musait-chat` repo'su icin branch, env ve deploy kurallarini sabitler.

## Branch modeli

Standart branchler:
- `main`: production
- `dev`: integration / staging
- `feature/*`: kisa omurlu gelistirme branch'i

Kurallar:
- Railway production service sadece `main` branch'ini deploy etmeli.
- Railway dev service sadece `dev` branch'ini deploy etmeli.
- Vercel production project sadece `main` branch'inden deploy almali.
- Vercel preview/dev project `dev` ve `feature/*` branch'lerini kullanmali.
- Convex dev ve prod deployment ayri kalmali.

## Environment matrisi

### apps/chat - Vercel dev
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_COOKIE_DOMAIN`
- `NEXT_PUBLIC_MAIN_APP_URL`

### apps/chat - Vercel prod
- ayni key isimleri, production degerleri

### apps/worker - Railway dev
- `CONVEX_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `INTERNAL_API_KEY`
- `APP_BASE_URL`
- `OPENROUTER_API_KEY`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `META_APP_SECRET`
- `OTP_HASH_SECRET`

### apps/worker - Railway prod
- ayni key isimleri, production degerleri

## Promotion akisi

1. Gelistirme `dev` branch'te biter.
2. Dev Convex deployment'a push edilir.
3. Dev Railway worker deploy edilir.
4. Dev Vercel chat deploy edilir.
5. OTP, admin paneli ve sohbet akislari test edilir.
6. `dev -> main` merge edilir.
7. Convex prod deploy edilir.
8. Railway prod deploy edilir.
9. Vercel prod deploy edilir.

## Manuel Yapman Gerekenler

Bu kisimlari panel veya git remote seviyesinde sen yapacaksin:

1. GitHub'da `dev` branch olusturup push et.
2. Railway'de ayri `dev` service/environment olustur.
3. Railway branch mapping'ini ayarla.
4. Vercel'de preview/dev ile production env'leri ayir.
5. Convex'te dev ve prod deployment env degerlerini ayri tut.

## Hizli smoke test

Dev ve prod deploy sonrasi:
- login calisiyor mu
- admin route auth dogru mu
- Convex baglaniyor mu
- OTP request worker'a gidiyor mu
- chat mesaj akisi bozulmadi mi
