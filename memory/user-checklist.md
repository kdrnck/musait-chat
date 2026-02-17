# 🚀 Go-Live Checklist: Worker & OTP Migration

## ✅ Completed
- [x] Worker deployed to Railway
- [x] Meta Webhook connected
- [x] Hybrid OTP flow implemented (client-side code display + WhatsApp verification + polling)
- [x] Local testing passed (all 4 steps verified)

## 📋 Remaining

### 1. Railway Redeploy ⏳
- [ ] Wait for Railway to build latest commit (`107218a`).
- [ ] Verify: `curl https://musait-chat-production.up.railway.app/health`

### 2. Main App Agent Update 🔄
Share this API contract with the Main App agent:

**POST /otp/request**
```json
Response: {
  "success": true,
  "requestId": "uuid",
  "phoneE164": "+90...",
  "otpCode": "296514",    // ← NEW: client displays this
  "channel": "whatsapp",
  "cooldownSeconds": 60
}
```

**GET /otp/poll-session?phone=+90...&requestId=uuid**
```json
// Pending:
{ "success": false, "error": "pending" }

// Verified (token ready):
{ "success": true, "token": "token_hash_here" }

// Expired:
{ "success": false, "error": "expired" }
```

Both endpoints require `x-api-key` header.

### 3. Vercel Env Vars ▲
- [ ] `RAILWAY_WORKER_URL`: `https://musait-chat-production.up.railway.app`
- [ ] `INTERNAL_API_KEY`: Must match Railway value.

### 4. End-to-End Test 🧪
- [ ] Open musait.app/login → Enter phone → See OTP code + wa.me link
- [ ] Tap wa.me link → Send code via WhatsApp
- [ ] Frontend auto-polls → Gets token → Logs in
