# Today's Tasks - 2026-02-17

## 1. 🚨 Worker Verification (Production)
- [ ] **Get Public URL**: Obtain the deployed worker URL from Railway.
- [ ] **Health Check**: `curl <URL>/health` to verify service is up.
- [ ] **OTP Test**: `curl -X POST <URL>/otp/request` to verify database connection and logic in prod.
- [ ] **Webhook Test**: Simulate webhook to prod (requires valid signature or bypassed).

## 2. Worker Environment Setup & Verification
- [x] **Local Verification**: Ensure `apps/worker` runs correctly locally (`pnpm dev:worker`).
- [x] **Dependency Check**: Verified `@musait/shared` created.
- [x] **Env Var Check**: `.env` validated.

## 3. Railway Deployment
- [x] **Deploy**: Push changes to trigger Railway deployment.
- [x] **Verify Build**: Build succeeded.
- [ ] **Verify Service**: Pending public URL check.

## 4. OTP Implementation (Worker-Side)
- [x] **Router Logic**: `message-router.ts` implemented.
- [x] **OTP Endpoints**: `POST /otp/request` implemented.
- [x] **OTP Verification**: Webhook handles verification.
- [x] **Magic Link**: Integrated with Supabase.
- [x] **Cleanup**: Cleanup job configured.

## 5. Agent Workflow: WhatsApp -> LLM -> Appointment
- [ ] **Flow**: Test the end-to-end flow:
    1.  User sends WhatsApp message.
    2.  Worker receives webhook.
    3.  Router sends to Agent.
    4.  Agent (LLM) processes message.
    5.  Agent calls `create_appointment` tool.
    6.  Appointment is saved to Supabase.
    7.  Confirmation sent back to WhatsApp.

## 6. Chat App (Delayed)
- [ ] **Initialize**: Create `apps/chat` project (when requested).
- [ ] **UI Integration**: Connect to Convex and Auth.
