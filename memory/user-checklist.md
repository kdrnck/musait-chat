# � Go-Live Checklist: Worker & OTP Migration

The code is ready on both sides (Worker & Main App). Now we just need to connect them via Environment Variables and Webhook settings.

## 1. Railway (Worker Configuration) 🚂
*Perform these in your Railway Dashboard*

- [ ] **Get Public URL**: Find the public domain for your worker service (e.g., `https://musait-worker-production.up.railway.app`).
- [ ] **Set Environment Variables**:
    Ensure the following variables are added to Railway:
    - `INTERNAL_API_KEY`: `your_internal_api_key_for_musait_app` (or your custom secret)
    - `OTP_HASH_SECRET`: `CwDzkzcofm5ZlSM3Nf4V1bNtXyGyCN` (or your custom secret)
    - `META_APP_SECRET`: (From Meta Dashboard)
    - `WHATSAPP_VERIFY_TOKEN`: `your_webhook_verify_token` (or your custom token)
    - `SUPABASE_URL`: `https://zxbhmkduffinbhcrvbbc.supabase.co`
    - `SUPABASE_SERVICE_KEY`: (From Supabase Dashboard)
    - `CONVEX_URL`: (From Convex Dashboard)
    - `OPENROUTER_API_KEY`: (From OpenRouter)

## 2. Meta for Developers (WhatsApp Webhook) 💬
*Perform these in the Meta App Dashboard*

- [ ] **Configure Webhook**:
    - **Callback URL**: `https://<YOUR_RAILWAY_URL>/webhook/whatsapp`
    - **Verify Token**: Must match `WHATSAPP_VERIFY_TOKEN` in Railway.
- [ ] **Verify**: Click "Verify and Save". It should succeed if the Worker is running.
- [ ] **Subscribe**: Ensure `messages` field is subscribed for your phone number.

## 3. Vercel (Main App Configuration) ▲
*Perform these in Vercel for the `musait.app` project*

- [ ] **Set Environment Variables**:
    - `RAILWAY_WORKER_URL`: The full URL from step 1 (no trailing slash).
    - `INTERNAL_API_KEY`: Must match the value in Railway.
- [ ] **Redeploy**: Go to Deployments -> Redeploy (to apply new env vars).

## 4. Verification Test ✅
*Once redeployed:*

1.  Open `musait.app/login`.
2.  Enter your phone number.
3.  **Expectation**: You receive a WhatsApp message with a 6-digit code.
4.  **Action**: Reply with the code.
5.  **Expectation**: You receive a Magic Link.
6.  **Action**: Click the link.
7.  **Result**: You are logged in!

---

**Blocked?**
If the Main App login fails:
1.  Check Vercel Function logs (is it hitting the Worker?).
2.  Check Railway logs (is it receiving the request? is there an error?).
