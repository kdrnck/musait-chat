# Main App: Magic Link Redirect Route

## Context
Worker artık WhatsApp'a kısa bir magic link gönderiyor:
```
https://musait.app/auth/magic/xK9f2mPq
```

Bu kısa kod (`xK9f2mPq`), Supabase `phone_login_codes` tablosundaki
`metadata->>'short_code'` alanında saklanıyor. Aynı kaydın
`metadata->>'supabase_verify_url'` alanında ise Supabase'in kendi
doğrulama URL'i (action_link) var.

## Yapılması Gereken

### 1. Yeni Route: `app/auth/magic/[code]/route.ts`

Bu route kullanıcıyı Supabase'in verify endpoint'ine yönlendirir.
Supabase token doğrulamasını KENDİSİ yapar.

```typescript
// app/auth/magic/[code]/route.ts
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params

  if (!code || code.length < 6) {
    return NextResponse.redirect(new URL('/login?error=invalid_code', request.url))
  }

  // Supabase client (service key NOT needed — just read public table)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Look up the short code
  const { data: record, error } = await supabase
    .from('phone_login_codes')
    .select('metadata, used_at, expires_at')
    .filter('metadata->>short_code', 'eq', code)
    .not('used_at', 'is', null)  // Must be verified (used_at set)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !record?.metadata?.supabase_verify_url) {
    console.error('[auth/magic] Code not found:', code)
    return NextResponse.redirect(new URL('/login?error=invalid_link', request.url))
  }

  // Check 1-hour expiry on the magic link
  const verifiedAt = record.metadata.verified_at
    ? new Date(record.metadata.verified_at as string)
    : null
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

  if (verifiedAt && verifiedAt < oneHourAgo) {
    return NextResponse.redirect(new URL('/login?error=link_expired', request.url))
  }

  // Redirect to Supabase's verify endpoint
  // Supabase handles token verification and redirects back to /auth/callback
  return NextResponse.redirect(record.metadata.supabase_verify_url as string)
}
```

### 2. Auth Callback: `app/auth/callback/route.ts`

Supabase verify endpoint'i token'ı doğruladıktan sonra kullanıcıyı
`/auth/callback`'e yönlendirir. PKCE aktifse `?code=CODE` parametresi
ile gelir.

Callback route'un bunu desteklemesi gerekiyor:

```typescript
// app/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')          // PKCE code exchange
  const token = searchParams.get('token')         // Legacy: direct token
  const type = searchParams.get('type')
  const next = validateRedirectUrl(searchParams.get('next') ?? '/profil')

  const supabase = createServerClient(...)

  try {
    if (code) {
      // PKCE flow: Supabase redirected with ?code=...
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } else if (token && type) {
      // Legacy: direct token verification (not used with new magic links)
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: token,
      })
      if (error) throw error
    }
  } catch (error) {
    console.error('[auth/callback] Error:', error)
    return NextResponse.redirect(new URL('/login?error=auth_callback_error', request.url))
  }

  return NextResponse.redirect(new URL(next, request.url))
}
```

**Önemli:** Mevcut `verifyOtp` mantığını KALDIRMA, sadece `code` (PKCE)
desteğini ÜSTÜNE EKLE. `code` parametresi varsa önce onu dene.

### 3. Supabase Dashboard

Supabase Dashboard > Authentication > URL Configuration:
- **Site URL**: `https://musait.app`
- **Redirect URLs** listesine ekle:
  - `https://musait.app/auth/callback`
  - `https://musait.app/auth/callback/**`

Bu ayar olmadan Supabase, verify sonrası yönlendirmeyi reddeder.

### 4. Login Sayfası (Opsiyonel)

Polling mantığını kaldır. Artık kullanıcı:
1. Telefon numarasını girer
2. OTP kodunu görür
3. WhatsApp'a gönderir
4. WhatsApp'a gelen linke tıklar → Giriş yapar

Masaüstü login için ayrı çözüm düşünülecek (QR code vb.).

### 5. RLS Politikası

`phone_login_codes` tablosunda `metadata->>short_code` ile SELECT
yapabilmek için read erişimi gerekiyor. Eğer RLS aktifse,
anonim kullanıcıların bu tabloyu okumasına izin veren bir policy ekle:

```sql
CREATE POLICY "Allow reading magic link by short_code"
ON phone_login_codes
FOR SELECT
USING (true);  -- Sadece metadata->>short_code ile sorgu yapılacak
```

Veya daha kısıtlı:
```sql
CREATE POLICY "Allow reading verified magic links"
ON phone_login_codes
FOR SELECT
USING (
  used_at IS NOT NULL
  AND metadata->>'short_code' IS NOT NULL
);
```

## Özet

| Bileşen | Değişiklik |
|---------|-----------|
| `app/auth/magic/[code]/route.ts` | **YENİ** — Kısa kodu DB'den bul, Supabase verify URL'ine yönlendir |
| `app/auth/callback/route.ts` | **GÜNCELLE** — PKCE `code` exchange desteği ekle |
| Supabase Dashboard | **GÜNCELLE** — Redirect URL'leri ekle |
| Login sayfası | **GÜNCELLE** — Polling kaldır |
