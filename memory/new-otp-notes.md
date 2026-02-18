# New OTP Notes (Fresh Start)

Tarih: 2026-02-18  
Sorumlu: Codex (agent)

## 1. Hedef (Net)

- Kullanıcı login ekranında OTP kodunu görür.
- Kullanıcı bu kodu WhatsApp sohbetine gönderir.
- Worker kodu doğrular.
- Worker WhatsApp üzerinden **bizim domainimizde kısa magic link** yollar.
- Kullanıcı linke tıklar, Supabase session oluşur, app’e login olur.

## 2. Şu Anki Yapıda Tespit Edilen Problemler

### Mimari karmaşa
- `musait-dev` login ekranı OTP + desktop login + polling akışlarını aynı sayfada karıştırıyor.
- `musait-dev` tarafında `/api/auth/otp/poll-session` var; worker tarafında karşılığı yok (`/otp/poll-session` route yok). Bu akış artık ölü/legacy.
- `verify` endpoint deprecate edilmiş ama UI tarafı hâlâ eski polling mantığının izlerini taşıyor.

### Magic link saklama/okuma kırılganlığı
- Kısa link eşlemesi `phone_login_codes.metadata` içine gömülü (`short_code`, `supabase_verify_url`).
- `app/auth/magic/[code]` bu gömülü metadata üzerinden lookup yapıyor. JSON metadata lookup’u kırılmaya daha açık.
- Loglarda görülen hata: `code lookup failed ... hasRecord: false`.

### Redirect domain sorunu
- `localhost` redirect sorunu tekrar etmiş.
- Sebep adayları:
  1) `redirect_to` değerinin upstream’de localhost ile üretilmesi,
  2) reverse proxy header/origin çözümünde yanlış host fallback,
  3) env’de `APP_BASE_URL`/site URL sapması.
- Patch’lerle düzeltildi ama kalıcı çözüm için mimaride canonical origin tek kaynaktan yönetilmeli.

### Ortam ayrışması
- Daha önce dev/prod DB mismatch yaşandı (worker dev DB’ye yazıp test prod’da yapıldı).
- Bu mismatch tekrar yaşanmaması için OTP ve short-link tablosu her ortamda migration + env parity ile yönetilmeli.

## 3. Root-Cause Özeti (Kısa)

- “OTP’den magic link” akışı tek bir sade pipeline yerine patch’lerle evrilmiş.
- Session polling, metadata tabanlı short link, mixed fallback redirect ve env drift birlikte hatayı büyütmüş.

## 4. Yeni Mimari Taslağı (Temiz ve Best-Practice)

## 4.1 Veri modeli (öneri)

1) `phone_login_codes` (mevcut)  
- OTP doğrulama için kalacak (hash, expires_at, used_at, attempts).

2) **Yeni tablo: `otp_magic_links`**  
- `id uuid pk`
- `short_code text unique not null`
- `phone_e164 text not null`
- `user_id uuid not null`
- `supabase_verify_url text not null`
- `redirect_path text not null`
- `expires_at timestamptz not null`
- `consumed_at timestamptz null`
- `created_at timestamptz not null default now()`
- İndeksler: `short_code unique`, `expires_at`, `consumed_at`

Amaç: short-link mapping’i OTP metadata’dan çıkarıp tek sorumluluğu olan net bir tabloya almak.

## 4.2 Akış

1) App `/api/auth/otp/request` → Worker `/otp/request`
2) Worker OTP üretir (hashleyip kaydeder), düz OTP kodunu app’e döner.
3) Kullanıcı kodu WhatsApp’a yollar.
4) Worker webhook mesajını OTP olarak route eder, verify eder.
5) Worker Supabase `generateLink(magiclink)` ile action link üretir.
6) Worker canonical app domain ile kısa link oluşturur (`https://<APP_BASE_URL>/auth/magic/<short_code>`).
7) Worker `otp_magic_links` tablosuna kaydeder.
8) Worker WhatsApp’a kısa link gönderir.
9) App `GET /auth/magic/[code]`:
   - `otp_magic_links`’ten tek kayıt bulur
   - expired/consumed kontrolü yapar
   - `supabase_verify_url` içindeki `redirect_to`’yu canonical origin’e normalize eder
   - redirect eder
   - callback sonrası session oluşur.

## 4.3 Güvenlik/Doğruluk

- `redirect_to` yalnızca relative path + allowlist host.
- `APP_BASE_URL` zorunlu (production’da fallback yok).
- short link tek kullanımlık (`consumed_at`).
- expiration strict (örn 1 saat).
- webhook imza doğrulama production’da zorunlu.

## 5. Uygulama Planı (Bu Çalışmada Yapılacak)

1) Worker: OTP service’i temizle (table-backed short link, canonical base URL, strict redirect normalization).
2) App: `/auth/magic/[code]` route’unu `otp_magic_links` tablosuna taşı.
3) App: login ekranını OTP + WhatsApp akışına sadeleştir; polling/legacy parçaları kaldır.
4) Supabase migration: `otp_magic_links` tablosu + index + RLS/policies.
5) Build/test: `musait-dev` build + `musait-chat` typecheck/build.
6) Commit/push: worker + app repo.

## 6. İlerleme Logu

### [DONE] 2026-02-18 03:xx
- Kod haritası çıkarıldı (`musait-dev` + `musait-chat`).
- Mevcut kırık noktalar tespit edildi.
- Rewrite planı netleştirildi.

### [IN PROGRESS]
- Yeni OTP mimarisinin implementasyonu.

### [NEXT]
- `otp_magic_links` migration + service refactor + app route refactor.

### [DONE] 2026-02-18 04:xx
- `musait-dev/supabase/migrations/20260218043000_create_otp_magic_links.sql` eklendi.
- MCP uzerinden migration uygulandi (`create_otp_magic_links_20260218`).
- Worker OTP katmani refactor edildi:
  - `otp-service.ts` yeniden yazildi (short-link now `otp_magic_links` table)
  - `rate-limiter.ts` test-bypass kaldirildi, cooldown + phone/ip window aktif
  - `config.ts` `APP_BASE_URL` production guard eklendi
  - `routes/otp.ts` first/last name validation + status code mapping duzeltildi
- App tarafi refactor edildi:
  - `app/auth/magic/[code]/route.ts` yeni tabloya tasindi, link consume mantigi eklendi
  - `app/login/page.tsx` OTP polling state/effectleri kaldirildi
  - `app/api/auth/otp/poll-session/route.ts` deprecated (410) yapildi
- Build dogrulama:
  - `musait-chat`: `pnpm --filter worker build` OK
  - `musait-dev`: `npm run build` OK

### [NEXT - DEPLOY CHECKLIST]
1) Worker env'de `APP_BASE_URL` kesinlikle hedef domain olsun (`https://musait.app` veya `https://dev.musait.app`).
2) Worker ve app ayni Supabase projesine baksin.
3) Yeni OTP akisini uc uca test et:
   - `/login` OTP al
   - WhatsApp'a kodu gonder
   - Gelen `https://<domain>/auth/magic/<code>` linkine tikla
   - Session acilip hedef sayfaya yonlenmeli.

## 7. Dikkat Listesi (Geri Dönünce Hızlı Kontrol)

- Worker env:
  - `APP_BASE_URL` doğru mu? (`https://musait.app` veya `https://dev.musait.app`)
  - `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` doğru projeyi gösteriyor mu?
- App env:
  - `RAILWAY_WORKER_URL`, `INTERNAL_API_KEY` doğru mu?
  - Supabase URL/key hedef ortamla uyumlu mu?
- DB:
  - `otp_magic_links` migration uygulandı mı?
- Test:
  - OTP üret → WhatsApp’a kod gönder → kısa link gelir → link tıkla → login başarılı.
