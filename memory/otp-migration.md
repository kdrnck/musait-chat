# OTP Migrasyon Planı — musait.app → Railway Worker

**Tarih:** 2026-02-15  
**Durum:** Implementasyon tamamlandı — entegrasyon testi bekleniyor

---

## 1. Yeni Railway Klasör Yapısı

```
apps/worker/src/
├── index.ts                          # ✅ Güncellendi: OTP routes + cleanup job
├── config.ts                         # ✅ Güncellendi: META_CONFIG eklendi
│
├── lib/
│   ├── convex.ts                     # ─ Mevcut (değişiklik yok)
│   ├── whatsapp.ts                   # ─ Mevcut (değişiklik yok)
│   ├── supabase.ts                   # ✅ YENİ: Supabase admin client factory
│   └── meta-signature.ts            # ✅ YENİ: X-Hub-Signature-256 doğrulama
│
├── services/
│   ├── router/
│   │   └── message-router.ts        # ✅ YENİ: OTP vs Agent yönlendirme
│   └── otp/
│       ├── index.ts                  # ✅ YENİ: Barrel export
│       ├── types.ts                  # ✅ YENİ: OTP tip tanımları
│       ├── config.ts                 # ✅ YENİ: OTP sabitler + env var erişimi
│       ├── crypto.ts                 # ✅ YENİ: Hash, generate, extract, normalize
│       ├── rate-limiter.ts           # ✅ YENİ: Rate limiting (Supabase RPC)
│       ├── otp-service.ts           # ✅ YENİ: Core OTP iş mantığı
│       └── cleanup.ts               # ✅ YENİ: Günlük temizlik job
│
├── routes/
│   ├── webhook.ts                    # ✅ Güncellendi: Signature + Router entegrasyonu
│   ├── otp.ts                        # ✅ YENİ: POST /otp/request endpoint
│   └── health.ts                     # ─ Mevcut (değişiklik yok)
│
├── agent/                            # ─ DOKUNULMADI
├── queue/                            # ─ DOKUNULMADI
```

---

## 2. Router Implementasyon Planı

### Karar Mantığı

```
Gelen WhatsApp mesajı
  │
  ▼
routeIncomingMessage(supabase, phone, message)
  │
  ├─ phone_login_codes tablosunda aktif OTP var mı?
  │   │
  │   ├─ EVET + mesajda 6 haneli kod → route: "otp" (kod ile)
  │   ├─ EVET + mesajda kod yok     → route: "otp" (hatırlatma gönder)
  │   └─ HAYIR                      → route: "agent"
  │
  ▼
webhook.ts handler
  │
  ├─ OTP path: handleOtpMessage() — SENKRON, kuyruk YOK
  └─ Agent path: handleAgentMessage() — Persist + Enqueue (mevcut akış)
```

### Aktif OTP Kontrolü

```sql
SELECT id FROM phone_login_codes
WHERE phone_e164 = $1
  AND used_at IS NULL
  AND expires_at > now()
LIMIT 1
```

---

## 3. OTP Modül Implementasyon Planı

### requestOtp() Akışı

```
musait.app → POST /otp/request (x-api-key header)
  │
  1. Rate limit kontrolü
  │   ├─ 60s cooldown
  │   ├─ Telefon: 5 istek / 60dk
  │   └─ IP: 10 istek / 60dk
  │
  2. OTP kodu oluştur (6 haneli, crypto.getRandomValues)
  │
  3. Hash: sha256(code + OTP_HASH_SECRET)
  │
  4. DB'ye kaydet (phone_login_codes)
  │
  5. WhatsApp ile kodu gönder
  │
  6. { requestId, phoneE164, cooldownSeconds } döndür
```

### verifyOtp() Akışı (Webhook içinde)

```
WhatsApp mesajı → Router → OTP handler
  │
  1. Kodu hash'le: sha256(code + OTP_HASH_SECRET)
  │
  2. ATOMİK doğrulama:
  │   UPDATE phone_login_codes
  │   SET used_at = now()
  │   WHERE phone_e164 = $phone
  │     AND code_hash = $hash
  │     AND used_at IS NULL
  │     AND expires_at > now()
  │     AND attempt_count < max_attempts
  │
  3. Başarısız → attempt_count++ (ayrı query)
  │
  4. Başarılı →
  │   ├─ resolveOrCreateUser()
  │   ├─ admin.generateLink({ type: 'magiclink', email })
  │   ├─ Token'ı action_link'ten çıkar
  │   └─ URL oluştur: https://musait.app/auth/callback?token=...&type=magiclink
  │
  5. Magic link URL'yi WhatsApp ile gönder
```

---

## 4. Güncellenmiş Akış Diyagramı

```
┌────────────────────────────────────────────────────────────────────────┐
│                         YENİ OTP AKIŞI                                │
│                     (Polling YOK — Magic Link)                         │
│                                                                        │
│  ┌─────────────┐    POST /otp/request    ┌──────────────────┐         │
│  │ musait.app   │ ──────────────────────→ │ Railway Worker    │         │
│  │ /login       │    (x-api-key auth)     │                  │         │
│  │              │                         │ 1. Rate limit    │         │
│  │ Kullanıcı    │                         │ 2. OTP oluştur   │         │
│  │ telefon girer│ ←────────────────────── │ 3. Hash + DB     │         │
│  │              │  { requestId }          │ 4. WhatsApp gönder│        │
│  └─────────────┘                         └──────────────────┘         │
│        │                                         │                     │
│        │                              WhatsApp: "Kodunuz: 123456"      │
│        │                                         │                     │
│        │                                         ▼                     │
│        │                                ┌────────────────┐             │
│        │                                │ Kullanıcı      │             │
│        │                                │ 123456 yazıp   │             │
│        │                                │ WhatsApp'a     │             │
│        │                                │ gönderir       │             │
│        │                                └────────┬───────┘             │
│        │                                         │                     │
│        │                              Meta Webhook POST               │
│        │                                         │                     │
│        │                                         ▼                     │
│        │                                ┌──────────────────┐           │
│        │                                │ Railway Webhook   │           │
│        │                                │                  │           │
│        │                                │ Router →          │           │
│        │                                │ Aktif OTP var?   │           │
│        │                                │ EVET → OTP path  │           │
│        │                                │                  │           │
│        │                                │ 1. Atomik doğrula│           │
│        │                                │ 2. User oluştur/ │           │
│        │                                │    bul           │           │
│        │                                │ 3. Magic link    │           │
│        │                                │    oluştur       │           │
│        │                                │ 4. WhatsApp:     │           │
│        │                                │    link gönder   │           │
│        │                                └──────────────────┘           │
│        │                                         │                     │
│        │                              WhatsApp: "✅ Link: ..."         │
│        │                                         │                     │
│        │                                         ▼                     │
│        │                                ┌────────────────┐             │
│        │                                │ Kullanıcı      │             │
│        │                                │ linke tıklar   │             │
│        │                                └────────┬───────┘             │
│        │                                         │                     │
│        │    GET /auth/callback?token=...&type=magiclink                │
│        │                                         │                     │
│        ▼                                         ▼                     │
│  ┌─────────────────────────────────────────────────────┐               │
│  │ musait.app /auth/callback                           │               │
│  │                                                     │               │
│  │ 1. Token'ı doğrula (supabase.auth.verifyOtp)       │               │
│  │ 2. Session cookie'lerini oluştur                    │               │
│  │ 3. /profil'e yönlendir                              │               │
│  │                                                     │               │
│  │ ✅ SESSION ESTABLISHED                              │               │
│  └─────────────────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. musait.app'ten Silinecek Endpoint'ler

| Endpoint | Dosya | Neden |
|---|---|---|
| `POST /api/webhooks/whatsapp` | `app/api/webhooks/whatsapp/route.ts` | Webhook artık Railway'de |
| `GET /api/webhooks/whatsapp` | `app/api/webhooks/whatsapp/route.ts` | Meta doğrulama Railway'de |
| `GET /api/auth/otp/poll-session` | `app/api/auth/otp/poll-session/route.ts` | Polling kaldırıldı |
| `POST /api/auth/otp/verify` | `app/api/auth/otp/verify/route.ts` | Doğrulama Railway webhook'ta |

### Güncellenmesi Gereken Endpoint'ler

| Endpoint | Dosya | Değişiklik |
|---|---|---|
| `POST /api/auth/otp/request` | `app/api/auth/otp/request/route.ts` | Railway'e proxy: `POST {RAILWAY_URL}/otp/request` |
| `GET /auth/callback` | `app/auth/callback/route.ts` | DEĞİŞİKLİK YOK — magic link token'ı zaten handle ediyor |

### musait.app'ten Silinecek Dosyalar

```
lib/otp/channels/whatsapp.ts      # WhatsApp channel artık Railway'de
lib/otp/channels/dev-screen.ts     # Dev screen kanal artık gereksiz
lib/otp/sender.ts                 # Sender mantığı Railway'e taşındı
lib/otp/config.ts                 # OTP config Railway'e taşındı
lib/auth/phone-otp.ts             # Core OTP mantığı Railway'e taşındı
components/WhatsAppOtpVerification.tsx  # Polling UI kaldırıldı
app/login/page.tsx.bak            # Ölü dosya
```

### KORUNACAK Dosyalar

```
lib/otp/utils.ts → normalizePhoneToE164(), validatePhone()
  → lib/utils/phone.ts olarak taşınmalı

app/auth/callback/route.ts
  → Magic link token'ları handle etmeye devam ediyor

profiles.phone_e164, profiles.first_name, profiles.last_name
  → Uygulama genelinde kullanılıyor
```

---

## 6. Railway Ortam Değişkenleri

### YENİ (eklenmesi gereken)

| Değişken | Açıklama | Örnek |
|---|---|---|
| `OTP_HASH_SECRET` | OTP hash'leme için secret (64 hex karakter) | `openssl rand -hex 32` |
| `INTERNAL_API_KEY` | musait.app → Railway arası API anahtarı | `openssl rand -hex 32` |
| `APP_BASE_URL` | musait.app base URL (magic link callback) | `https://musait.app` |
| `META_APP_SECRET` | Meta uygulama secret'ı (webhook imza doğrulama) | Meta Developer Console'dan |

### MEVCUT (değişiklik yok)

| Değişken | Kullanım |
|---|---|
| `SUPABASE_URL` | OTP + Randevu |
| `SUPABASE_SERVICE_KEY` | Admin işlemler |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp API |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp numara |
| `WHATSAPP_VERIFY_TOKEN` | Webhook doğrulama |

---

## 7. Vercel (musait.app) Ortam Değişkeni Değişiklikleri

### KALDIRILACAK

| Değişken | Neden |
|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Artık Railway'de |
| `WHATSAPP_PHONE_NUMBER_ID` | Artık Railway'de |
| `META_VERIFY_TOKEN` | Artık Railway'de |
| `META_APP_SECRET` | Artık Railway'de |
| `GRAPH_API_VERSION` | Artık Railway'de |
| `OTP_CHANNEL` | Artık her zaman "whatsapp" |

### EKLENECEK

| Değişken | Açıklama |
|---|---|
| `RAILWAY_WORKER_URL` | Railway worker URL (örn: `https://worker.musait.app`) |
| `INTERNAL_API_KEY` | Railway ile aynı API key |

---

## 8. Migrasyon Sırası (Adım Adım)

### Faz 1: Hazırlık (0 downtime)

```
1. Railway ortam değişkenlerini ayarla:
   - OTP_HASH_SECRET (yeni oluştur)
   - INTERNAL_API_KEY (yeni oluştur)
   - APP_BASE_URL=https://musait.app
   - META_APP_SECRET (mevcut değeri kopyala)

2. Railway worker'ı yeni kod ile deploy et
   (OTP endpoint'leri aktif, webhook router aktif)

3. Worker'ın sağlıklı başlatıldığını doğrula:
   GET {RAILWAY_URL}/health
```

### Faz 2: Meta Webhook Geçişi (kısa downtime ~30sn)

```
4. Meta Developer Console'da webhook URL'yi güncelle:
   ESKİ: https://musait.app/api/webhooks/whatsapp
   YENİ: https://{RAILWAY_URL}/webhook/whatsapp

5. Meta webhook verify endpoint'ini test et:
   GET {RAILWAY_URL}/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=...

6. Test mesajı gönder — webhook'un Railway'e geldiğini doğrula
```

### Faz 3: musait.app Güncelleme

```
7. Vercel'e yeni env var'ları ekle:
   - RAILWAY_WORKER_URL
   - INTERNAL_API_KEY

8. musait.app /api/auth/otp/request route'unu güncelle:
   - Lokal OTP mantığı yerine Railway'e proxy

9. Polling UI'ını kaldır — sadece "WhatsApp'ı kontrol edin" mesajı göster

10. musait.app deploy et
```

### Faz 4: Temizlik

```
11. musait.app'ten eski dosyaları sil:
    - /api/webhooks/whatsapp/route.ts
    - /api/auth/otp/poll-session/route.ts
    - /api/auth/otp/verify/route.ts
    - lib/otp/channels/
    - lib/otp/sender.ts
    - components/WhatsAppOtpVerification.tsx

12. Vercel'den eski env var'ları kaldır

13. Son musait.app deploy
```

---

## 9. Rollback Planı

### Senaryo A: Railway OTP çalışmıyor

```
1. Meta Developer Console'da webhook URL'yi eski haline döndür:
   → https://musait.app/api/webhooks/whatsapp

2. musait.app OTP request route'unu eski hale getir (git revert)

3. Vercel deploy

Süre: ~5 dakika
Etki: OTP sistemi eski polling-based akışa döner
```

### Senaryo B: Magic link oluşturulamıyor

```
1. Supabase admin.generateLink() çalışmıyorsa:
   - SUPABASE_SERVICE_KEY'in doğruluğunu kontrol et
   - Supabase project settings'te "Enable magic links" aktif mi?
   - Placeholder email domain'in izin verildiğinden emin ol

2. Geçici çözüm: dev_screen moduna dön
   (musait.app'te eski /api/auth/otp/verify route'unu aktifleştir)
```

### Senaryo C: WhatsApp mesajları iletilmiyor

```
1. Railway worker loglarını kontrol et
2. WHATSAPP_ACCESS_TOKEN süresinin dolup dolmadığını kontrol et
3. META_APP_SECRET doğruluğunu kontrol et
4. Webhook URL'nin doğru olduğunu doğrula
5. Gerekirse webhook URL'yi musait.app'e geri döndür
```

---

## 10. Test Kontrol Listesi

### Birim Testleri

- [ ] `generateOtpCode()` — 6 haneli, tamamen sayısal
- [ ] `hashOtpCode()` — deterministic, OTP_HASH_SECRET ile birlikte
- [ ] `verifyOtpCode()` — doğru kod = true, yanlış kod = false
- [ ] `extractOtpCode()` — "123456", "kod: 123456", "abc" → null
- [ ] `normalizePhoneToE164()` — çeşitli formatlar
- [ ] `validatePhone()` — geçerli/geçersiz E.164 numaraları
- [ ] `verifyMetaSignature()` — geçerli/geçersiz imzalar

### Entegrasyon Testleri

- [ ] `POST /otp/request` — geçerli telefon → 200, requestId döner
- [ ] `POST /otp/request` — x-api-key yok → 401
- [ ] `POST /otp/request` — geçersiz telefon → 400
- [ ] `POST /otp/request` — 60s içinde tekrar → 429 (cooldown)
- [ ] `POST /otp/request` — 5 istekten sonra → 429 (rate limit)
- [ ] WhatsApp webhook — doğru kod → magic link gönderilir
- [ ] WhatsApp webhook — yanlış kod → hata mesajı gönderilir
- [ ] WhatsApp webhook — 5 yanlış deneme → "çok fazla deneme" mesajı
- [ ] WhatsApp webhook — süresi dolmuş kod → "süresi dolmuş" mesajı
- [ ] WhatsApp webhook — aktif OTP yok + normal mesaj → agent'a yönlendirilir
- [ ] Magic link URL → musait.app /auth/callback → session oluşur
- [ ] Meta signature doğrulama — geçerli imza → kabul
- [ ] Meta signature doğrulama — geçersiz imza → 403

### Uçtan Uca Testler

- [ ] Tam akış: telefon girişi → OTP iste → WhatsApp'ta kod al → kodu gönder → magic link al → linke tıkla → session oluşur → /profil'e yönlendirme
- [ ] Signup akışı: yeni telefon → user oluşturulur → session oluşur
- [ ] Login akışı: mevcut telefon → user bulunur → session oluşur
- [ ] Eşzamanlı: OTP mesajı ve normal chat mesajı farklı telefonlardan → doğru yönlendirme
- [ ] Cleanup job: 24 saat sonra eski kayıtlar temizlenir

### Güvenlik Testleri

- [ ] OTP kodu DB'de hash olarak saklanıyor (plaintext YOK)
- [ ] OTP_HASH_SECRET olmadan hash oluşturulamıyor
- [ ] Aynı OTP iki kez kullanılamıyor (used_at kontrolü)
- [ ] Süresi dolmuş OTP doğrulanamıyor
- [ ] Rate limit bypass edilemiyor (whitelist kaldırıldı)
- [ ] INTERNAL_API_KEY olmadan /otp/request çağrılamıyor
- [ ] Frontend'den SUPABASE_SERVICE_KEY erişilemiyor
- [ ] Meta signature doğrulaması production'da zorunlu
