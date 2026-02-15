OTP System — Exhaustive Codebase Audit
Date: 2026-02-15
Scope: Full analysis of the phone-based OTP authentication system
Status: Read-only audit — no code changes made

A. OTP Architecture Diagram
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                       │
│                                                                                     │
│  ┌────────────────────┐                                                             │
│  │  /login (page.tsx)  │──── Step 1: User enters phone ──────────────────────┐      │
│  │                     │                                                     │      │
│  │  Step 2a: Name form │  (signup only - phone_not_found)                    │      │
│  │                     │                                                     ▼      │
│  │  Step 3: OTP screen │◄──────────────────────────────────────── POST /api/auth/   │
│  │   ├─ dev_screen:    │     Response: { devCode, channel,        otp/request       │
│  │   │  code input box │               requestId, phoneE164 }                       │
│  │   └─ whatsapp:      │                                                            │
│  │      WhatsAppOtp    │                                                            │
│  │      Verification   │                                                            │
│  │      component      │                                                            │
│  └─────────┬───────────┘                                                            │
│            │                                                                        │
│    ┌───────┴────────────────────────────────────────────────────┐                    │
│    │          TWO PARALLEL VERIFICATION PATHS                   │                    │
│    │                                                            │                    │
│    │  PATH A: dev_screen            PATH B: whatsapp            │                    │
│    │  User types code               User taps WhatsApp button   │                    │
│    │         │                       Opens wa.me/902128011028    │                    │
│    │         ▼                       ?text={OTP_CODE}            │                    │
│    │  POST /api/auth/                       │                   │                    │
│    │  otp/verify                            │                   │                    │
│    │         │                              ▼                   │                    │
│    │         │                    User sends code to             │                    │
│    │         │                    WhatsApp Business              │                    │
│    │         │                              │                   │                    │
│    │         │                              ▼                   │                    │
│    │         │                    POST /api/webhooks/            │                    │
│    │         │                    whatsapp (from Meta)           │                    │
│    │         │                              │                   │                    │
│    │         │                    Verifies OTP atomically        │                    │
│    │         │                    Creates magic link             │                    │
│    │         │                    Saves token to metadata        │                    │
│    │         │                    Sends confirmation via WA      │                    │
│    │         │                              │                   │                    │
│    │         │                              │                   │                    │
│    │         │               GET /api/auth/otp/poll-session      │                    │
│    │         │               (frontend polls every 2 sec)       │                    │
│    │         │                       Finds token                │                    │
│    │         │                              │                   │                    │
│    │         ▼                              ▼                   │                    │
│    │  supabase.auth.verifyOtp({ token_hash, type:'magiclink' }) │                    │
│    │                              │                             │                    │
│    │                              ▼                             │                    │
│    │                   SESSION ESTABLISHED                      │                    │
│    │                   Redirect to /profil                      │                    │
│    └────────────────────────────────────────────────────────────┘                    │
│                                                                                     │
│  ALTERNATIVE MOBILE PATH (WhatsApp):                                                │
│  Webhook sends magic link URL back to user in WhatsApp message.                     │
│  User taps link → GET /auth/callback?token=...&type=magiclink                       │
│  Auth callback verifies OTP, sets cookies, redirects to /profil.                    │
└─────────────────────────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVER-SIDE FLOW                             │
│                                                                     │
│  requestOtp() ─── lib/auth/phone-otp.ts                            │
│  │  1. normalizePhoneToE164(phone)                                  │
│  │  2. Check profiles table for existing user                       │
│  │  3. checkRateLimit() → rpc('check_otp_rate_limit')              │
│  │  4. Check cooldown (60s between requests)                        │
│  │  5. generateOtpCode() → 6-digit random (crypto.getRandomValues)  │
│  │  6. hashOtpCode(code) → SHA-256 hex                             │
│  │  7. calculateExpiration(10 min)                                  │
│  │  8. INSERT into phone_login_codes (hashed code + metadata)       │
│  │  9. sendOtp() → routes to channel sender                        │
│  │  10. Return { requestId, phoneE164, devCode }                   │
│  │                                                                  │
│  verifyOtp() ─── lib/auth/phone-otp.ts                             │
│  │  1. Query latest unused OTP for phone+context                   │
│  │  2. Check expiration (isOtpExpired)                              │
│  │  3. Check attempt count (max 5)                                  │
│  │  4. verifyOtpCode(code, hash) → SHA-256 comparison              │
│  │  5. Mark OTP as used (set used_at)                              │
│  │  6. Return { otpId }                                            │
│  │                                                                  │
│  Session Creation (verify route or webhook):                        │
│  │  1. For signup: createUserWithPhone() → admin.createUser()      │
│  │  2. For login: findUserByPhone() → profiles.phone_e164          │
│  │  3. admin.generateLink({ type:'magiclink', email:placeholder })  │
│  │  4. Extract token from action_link URL                           │
│  │  5. Return token to client (or save to metadata for polling)    │
└─────────────────────────────────────────────────────────────────────┘
B. Complete List of OTP-Related Files
Core Library (lib/otp/)
File	Purpose

index.ts
Barrel export — re-exports all types, config, utils, and sender

types.ts
Type definitions: OtpChannel, OtpContext, SendOtpResult, PhoneLoginCode, OtpChannelSender, SignupData, CreateUserResult

config.ts
getOtpChannel(), isDevMode(), OTP_CONFIG (code length, expiration, rate limits, cooldown), WHATSAPP_CONFIG

utils.ts
generateOtpCode(), hashOtpCode(), verifyOtpCode(), calculateExpiration(), isOtpExpired(), normalizePhoneToE164(), validatePhone(), formatPhoneForDisplay(), getTimeRemaining()

sender.ts
sendOtp() — routes to appropriate channel sender; shouldShowOtpOnScreen()

channels/dev-screen.ts
DevScreenChannel — logs code, returns it for on-screen display

channels/whatsapp.ts
WhatsAppChannel — returns code for display (does NOT call WhatsApp API to send)
Auth Business Logic
File	Purpose

phone-otp.ts
requestOtp(), verifyOtp(), createUserWithPhone(), findUserByPhone(), createSessionForUser(), checkRateLimit()
API Routes
File	Endpoint	Method

request/route.ts
POST /api/auth/otp/request	Request new OTP

verify/route.ts
POST /api/auth/otp/verify	Verify OTP (dev_screen path)

poll-session/route.ts
GET /api/auth/otp/poll-session	Poll for session token (WhatsApp path)

whatsapp/route.ts
GET/POST /api/webhooks/whatsapp	Meta webhook verification + incoming message handler
Pages & Components
File	Purpose

login/page.tsx
Login/signup UI — phone input → name form (signup) → OTP verification step

login/page.tsx.bak
Backup copy of a previous login page version

auth/callback/route.ts
Auth callback — verifies magic link token, sets session cookies, handles referral tracking

WhatsAppOtpVerification.tsx
WhatsApp OTP UI component — shows code, wa.me button, QR code

CountryPhoneInput
Phone input component used by login page
Database & Migrations
File	Purpose

20241127_phone_otp_auth.sql
Creates phone_login_codes, otp_rate_limits tables, otp_channel enum, RLS policies, cleanup_expired_otp_codes(), check_otp_rate_limit() functions

20251203_rls_rebuild.sql
Re-enables RLS on phone_login_codes and otp_rate_limits; re-creates service_role-only policies
Documentation & Types
File	Purpose

dbscheme.md
Section §5 documents OTP/Security tables and RLS

AGENTS.md
Section §4.3/§4.4 documents OTP channels and WhatsApp flow

types.ts
Generated Supabase types — includes phone_login_codes, otp_rate_limits, otp_channel enum, check_otp_rate_limit and cleanup_expired_otp_codes function signatures

ai-notes/README.md
Migration notes referencing OTP auth migration
C. Dependency Graph
Database (Supabase)
Lib: OTP
Lib: Auth
API Routes
Frontend (Client)
app/login/page.tsx
components/WhatsAppOtpVerification.tsx
components/ui/CountryPhoneInput.tsx
POST /api/auth/otp/request
POST /api/auth/otp/verify
GET /api/auth/otp/poll-session
POST /api/webhooks/whatsapp
GET /auth/callback
lib/auth/phone-otp.ts
lib/otp/index.ts
lib/otp/config.ts
lib/otp/utils.ts
lib/otp/sender.ts
lib/otp/types.ts
lib/otp/channels/dev-screen.ts
lib/otp/channels/whatsapp.ts
phone_login_codes
otp_rate_limits
profiles
auth.users
Import Chain Summary
Consumer	Imports from
app/api/auth/otp/request/route.ts	lib/auth/phone-otp (requestOtp), lib/otp (normalizePhoneToE164, validatePhone), lib/otp/types
app/api/auth/otp/verify/route.ts	lib/auth/phone-otp (verifyOtp, createUserWithPhone, findUserByPhone), lib/supabase/server, lib/otp (normalizePhoneToE164), lib/otp/types
app/api/auth/otp/poll-session/route.ts	lib/supabase/server, lib/otp (normalizePhoneToE164)
app/api/webhooks/whatsapp/route.ts	lib/supabase/server, lib/otp/utils (hashOtpCode, normalizePhoneToE164), lib/auth/phone-otp (createUserWithPhone, findUserByPhone)
app/login/page.tsx	components/WhatsAppOtpVerification, components/ui/CountryPhoneInput
lib/auth/phone-otp.ts	lib/supabase/server, lib/otp (everything via barrel), lib/otp/types
lib/otp/sender.ts	lib/otp/types, lib/otp/config, lib/otp/channels/dev-screen, lib/otp/channels/whatsapp
D. Detailed Flow Answers
1. Entry Point
Where does OTP flow begin?

app/login/page.tsx
, function handlePhoneSubmit (line 149)
Which endpoint receives the first OTP request?
POST /api/auth/otp/request → 

request/route.ts
Is it triggered by WhatsApp inbound message or by web form?
Web form. User enters phone on /login. The WhatsApp inbound message is the verification step, not the initiation.
2. Code Generation
Where is OTP generated?

lib/otp/utils.ts
, function generateOtpCode() (line 14)
Is it random?
Yes. Uses crypto.getRandomValues(new Uint32Array(length)) — cryptographically secure random.
Is it hashed before storage?
Yes. hashOtpCode(code) at 

utils.ts:35
 computes SHA-256 hex digest. Only the hash is stored in phone_login_codes.code_hash.
Where is it stored?
public.phone_login_codes table, column code_hash.
INSERT at 

phone-otp.ts:140-154
What is expiration time?
10 minutes (OTP_CONFIG.EXPIRATION_MINUTES = 10 in 

config.ts:55
)
3. Delivery
How is OTP sent?
Via configured channel (OTP_CHANNEL env var):
dev_screen: Code returned in API response → shown on screen.
whatsapp: Code returned in API response → shown in green WhatsApp UI component → user manually sends it to the WhatsApp business number.
Neither channel makes an outbound API call to send the code. Both return the code to the frontend.
WhatsApp API call location?
Outbound WhatsApp messages are only sent after verification — the webhook sends a confirmation message with a magic link.

whatsapp/route.ts
, function sendWhatsAppText() (line 515)
Which file / function triggers delivery?
sendOtp() in 

sender.ts:55
 → delegates to channel .send() method
Called by requestOtp() at 

phone-otp.ts:162
4. Verification
How does verification occur?

Two parallel paths:
Path A — dev_screen (HTTP request from frontend):

User types 6-digit code in input field on /login
Frontend calls POST /api/auth/otp/verify with { phone, code, context }
Server hashes submitted code, queries phone_login_codes for matching unused record
Compares hash, checks expiration and attempt count
On success: marks OTP as used, generates magic link, returns token
Path B — whatsapp (WhatsApp inbound message):

User sends code via WhatsApp to 902128011028
Meta webhook delivers message to POST /api/webhooks/whatsapp
Webhook extracts 6-digit code from message text (extractOtpCode())
Atomic verification: UPDATE phone_login_codes SET used_at=now() WHERE phone=X AND code_hash=Y AND used_at IS NULL AND expires_at > now() AND attempt_count < 5
On success: creates user (if signup), generates magic link, saves token to OTP metadata
Sends confirmation WhatsApp message with magic link URL
Frontend polls GET /api/auth/otp/poll-session?phone=X&requestId=Y every 2 seconds
When poll finds token → client calls supabase.auth.verifyOtp({ token_hash, type:'magiclink' }) → session established
How is code matched?

Both paths hash the submitted code with SHA-256 and compare against code_hash in DB.
Path A: 

phone-otp.ts:241
 — verifyOtpCode(code, otp.code_hash)
Path B: 

whatsapp/route.ts:305
 — hashOtpCode(code) then eq('code_hash', codeHash) in atomic UPDATE
How is rate limiting enforced?

Phone-level: 5 requests per 60 minutes via check_otp_rate_limit DB function
IP-level: 10 requests per 60 minutes via same function
Cooldown: 60 seconds between requests for same phone number
Attempt limit: Max 5 verification attempts per OTP code
Whitelist: Phone +905513901028 bypasses rate limits
What happens after successful verification?

OTP is marked as used (used_at set)
For signup: createUserWithPhone() creates auth.users + profiles record
For login: findUserByPhone() locates existing user
Magic link generated via admin.generateLink({ type:'magiclink' })
Token sent to client → verifyOtp({ token_hash, type:'magiclink' }) → Supabase session established
5. Session Creation
Does it generate a magic link? — Yes. Both verify route and webhook generate magic links via adminClient.auth.admin.generateLink({ type: 'magiclink', email: placeholder }).
Does it call Supabase signInWithOtp? — No. The system creates its own OTP codes, NOT using Supabase's built-in phone OTP.
Does it manually create a session? — Indirectly. It generates a magic link token server-side, then the client calls supabase.auth.verifyOtp({ token_hash, type:'magiclink' }) which creates the Supabase session.
How does user become authenticated?
The magic link token (extracted from generateLink API response) acts as a one-time token.
Client uses verifyOtp() from @supabase/ssr with type:'magiclink' to exchange the token for a session.
Supabase sets auth cookies automatically.
Placeholder email format: {phone_digits}@phone.randewoo.local
6. Database Impact
Tables
Table	Schema
phone_login_codes	id (uuid PK), phone_e164 (text), code_hash (text), channel (otp_channel enum), context (text: signup/login), created_at (timestamptz), expires_at (timestamptz), used_at (timestamptz nullable), attempt_count (int), max_attempts (int), ip_address (inet), user_agent (text), metadata (jsonb)
otp_rate_limits	id (uuid PK), identifier (text: phone or IP), identifier_type (text: 'phone' or 'ip'), request_count (int), window_start (timestamptz), window_minutes (int)
Custom Types
Type	Values
otp_channel	'dev_screen', 'whatsapp', 'sms'
Database Functions
Function	Purpose
cleanup_expired_otp_codes()	Deletes OTPs older than 24 hours and expired rate limit windows
check_otp_rate_limit(p_identifier, p_identifier_type, p_max_requests, p_window_minutes)	Sliding window rate limiter — returns boolean
generate_whatsapp_verification_code()	Referenced in Supabase types only — appears to be an older/unused DB function
Indexes
Index	On
phone_login_codes_phone_e164_idx	phone_login_codes(phone_e164)
phone_login_codes_expires_at_idx	phone_login_codes(expires_at)
phone_login_codes_phone_e164_active_idx	phone_login_codes(phone_e164, created_at DESC) WHERE used_at IS NULL
otp_rate_limits_identifier_idx	otp_rate_limits(identifier, identifier_type)
Cleanup Logic
used_at: Set to now() when OTP is consumed (verified or max attempts reached)
expires_at: Set to created_at + 10 minutes
cleanup_expired_otp_codes(): Purges records > 24 hours old (no cron job currently configured to call this)
Profile columns added by OTP migration
profiles.first_name (text)
profiles.last_name (text)
profiles.phone_e164 (text, unique partial index where NOT NULL)
7. Webhook Integration
Does the OTP system rely on a WhatsApp webhook? — Yes, when OTP_CHANNEL=whatsapp.
Where is it implemented? — 

app/api/webhooks/whatsapp/route.ts
Does it conflict with the new Railway webhook architecture?
The webhook is at /api/webhooks/whatsapp within the Next.js app.
If the new Railway architecture uses a separate service for WhatsApp webhooks, this route would need to be disabled or redirected.
The webhook URL is registered in Meta's Developer Console; changing it requires updating the Meta configuration.
Currently uses export const runtime = 'nodejs' for Node.js crypto operations.
8. Security Analysis
Measure	Implementation
Code randomness	crypto.getRandomValues() — CSPRNG
Storage	SHA-256 hashed, never stored in plain text
Expiration	10 minutes
Attempt limit	5 attempts per code, then auto-invalidated
Cooldown	60 seconds between OTP requests for same phone
Phone rate limit	5 requests per 60 minutes
IP rate limit	10 requests per 60 minutes
Replay prevention	used_at IS NULL check — once consumed, cannot be reused
Atomic consumption (webhook)	Single UPDATE with WHERE conditions — only one request can consume
Signature verification	X-Hub-Signature-256 HMAC via META_APP_SECRET (required in production)
Poll security	Requires both phone AND requestId (OTP record UUID) to prevent hijacking
Session token single-use	Token cleared from metadata after poll reads it
RLS	Service-role only — no client-side access to OTP tables
Test whitelist	+905513901028 bypasses rate limits (hardcoded)
WARNING

The generate_whatsapp_verification_code function exists in the Supabase types but its implementation was not found in the codebase. It may be an orphaned DB function.

9. Environment Variables
Variable	Used By	Purpose
OTP_CHANNEL	lib/otp/config.ts, app/api/auth/otp/request/route.ts	Selects delivery channel (dev_screen, whatsapp, sms)
META_VERIFY_TOKEN	app/api/webhooks/whatsapp/route.ts	WhatsApp webhook subscription verification
META_APP_SECRET	app/api/webhooks/whatsapp/route.ts	HMAC signature verification for webhook payloads
WHATSAPP_ACCESS_TOKEN	app/api/webhooks/whatsapp/route.ts, lib/otp/config.ts	WhatsApp Cloud API auth for sending messages
WHATSAPP_PHONE_NUMBER_ID	app/api/webhooks/whatsapp/route.ts, lib/otp/config.ts	WhatsApp Business Phone Number ID
WHATSAPP_OTP_TEMPLATE_NAME	lib/otp/config.ts	Template name (referenced but not actively used)
WHATSAPP_API_VERSION	lib/otp/config.ts	Meta Graph API version (default: v18.0)
GRAPH_API_VERSION	app/api/webhooks/whatsapp/route.ts	Graph API version for sending (default: v20.0)
NEXT_PUBLIC_APP_URL	app/api/webhooks/whatsapp/route.ts	Base URL for magic link callback URLs
10. Coupling Analysis
Component	OTP Dependency	Isolation Level
/login page	Deep — entire page is built around OTP flow	Tightly coupled
/auth/callback	Shared — handles magic link tokens from OTP and potentially other sources	Loosely coupled (generic)
middleware.ts	None — no OTP references	Decoupled
Business login (/app/login)	None — separate login flow (no OTP file found)	Decoupled
Admin login (/admin/login)	None — separate login flow	Decoupled
Profiles table	Medium — first_name, last_name, phone_e164 columns added by OTP migration	Columns are useful beyond OTP
lib/supabase/types.ts	Generated — will auto-regenerate when DB changes	Auto-coupled
E. Decommission Strategy
Phase 1: Preserve (DO NOT REMOVE)
These elements are used beyond OTP and must be kept:

Item	Reason
profiles.first_name, profiles.last_name, profiles.phone_e164 columns	Used across the entire app for user identity, appointment matching, profile display. These were added by the OTP migration but are now integral to the data model.
profiles_phone_e164_unique index	Used by RLS for appointment matching (dbscheme.md §2.4)
/auth/callback/route.ts	Generic auth callback — handles magic links from any source, referral tracking. Needed regardless of auth method.
lib/otp/utils.ts → normalizePhoneToE164(), formatPhoneForDisplay(), validatePhone()	General phone utilities that may be used elsewhere or in future auth. Consider moving to lib/utils/phone.ts.
Phase 2: Safe to Remove (OTP-Specific)
These files are exclusively OTP-related and can be removed:

File/Dir	Notes
lib/otp/ (entire directory)	All 7 files. Move phone utilities out first.
lib/auth/phone-otp.ts	All functions are OTP-specific
app/api/auth/otp/ (entire directory)	All 3 routes: request, verify, poll-session
app/api/webhooks/whatsapp/route.ts	Only used for OTP verification. If WhatsApp webhook is needed for other purposes (e.g., chatbot), refactor instead of removing.
components/WhatsAppOtpVerification.tsx	WhatsApp OTP UI only
app/login/page.tsx	Entirely OTP-based — must be replaced with new auth UI
app/login/page.tsx.bak	Dead file
Phase 3: Database Cleanup (Careful)
Object	Action
phone_login_codes table	Preserve initially, then drop after confirming no lingering references. Contains historical data that might be useful for analytics.
otp_rate_limits table	Drop when ready — only used by OTP rate limiter
otp_channel enum type	Drop when phone_login_codes is dropped
check_otp_rate_limit() function	Drop when otp_rate_limits table is dropped
cleanup_expired_otp_codes() function	Drop when phone_login_codes is dropped
generate_whatsapp_verification_code() function	Verify existence in Supabase → drop if orphaned
RLS policies on OTP tables	Will be dropped with the tables
Phase 4: Replace / Refactor
Component	Action Required
/login page	Replace with new auth system UI (e.g., Supabase Auth UI, email+password, or new magic link)
Session creation logic	New auth flow must establish Supabase sessions. Currently uses admin.generateLink({ type:'magiclink' }) — new auth may use different method.
User creation (createUserWithPhone)	Move user creation logic to new auth flow or keep the concept with different trigger
lib/supabase/types.ts	Regenerate after DB cleanup (npx supabase gen types typescript)
AGENTS.md §4.3-4.4	Update documentation to reflect new auth system
dbscheme.md §5	Update or remove OTP/Security section
Environment variables	Remove OTP_CHANNEL, META_VERIFY_TOKEN, META_APP_SECRET, WHATSAPP_*, GRAPH_API_VERSION from Vercel/hosting
Phase 5: Verification After Decommission
Run npm run build — ensure no broken imports
Grep for phone-otp, lib/otp, WhatsAppOtp, phone_login_codes, otp_rate_limits — should return zero results
Regenerate Supabase types
Test new auth flow end-to-end
Run Supabase security advisor — verify no orphaned policies
Risk Analysis
Risk	Severity	Mitigation
Breaking /login with no replacement	Critical	Build new auth UI before removing OTP login
Losing profiles.phone_e164 column	Critical	Do NOT remove — it's used for appointment RLS matching
Orphaned phone utility functions	Low	Extract normalizePhoneToE164, formatPhoneForDisplay, validatePhone to shared utils
WhatsApp webhook needed for future chatbot	Medium	Refactor webhook rather than deleting; keep Meta webhook subscription
auth/callback still needs magic link handling	Medium	Keep the route; new auth may still generate magic links
Supabase types out of sync	Low	Regenerate after all DB changes
Rate limit whitelist phone number in source code	Low	Remove when OTP code is removed — it's only in phone-otp.ts