# Today's Tasks - 2026-02-17

## 1. Worker Environment Setup & Verification
- [x] **Local Verification**: Ensure `apps/worker` runs correctly locally (`pnpm dev:worker`).
- [x] **Dependency Check**: Verify `@musait/shared` and other dependencies are correctly linked.
- [x] **Env Var Check**: valid `.env` file in `apps/worker`.

## 2. Railway Deployment (First Run)
- [ ] **Deploy**: Push changes to trigger Railway deployment.
- [ ] **Verify**: Ensure the build succeeds (fixing the previous "Resources" error).
- [ ] **Health Check**: Verify the deployed service is healthy.

## 3. OTP Implementation (Worker-Side)
*Reference: `memory/otp-migration.md`*
- [ ] **Router Logic**: Implement `message-router.ts` to distinguish between OTP codes and Agent messages.
- [ ] **OTP Endpoints**: Implement `POST /otp/request` in the Worker (secured by `INTERNAL_API_KEY`).
- [ ] **OTP Verification**: Handle OTP verification logic within the webhook handler (intercept 6-digit codes).
- [ ] **Magic Link**: Generate and send Magic Links for authentication.
- [ ] **Cleanup**: Implement daily cleanup job for expired OTPs.

## 4. Chat App (Frontend) & Integration
- [ ] **Run Dev Server**: Start `apps/chat` (`pnpm dev:chat`) alongside the worker.
- [ ] **UI Check**: Verify the Chat App UI loads and displays conversations (mock or real).
- [ ] **Authentication**: Ensure login works using the main app's credentials (Supabase Auth).

## 5. Agent Workflow: WhatsApp -> LLM -> Appointment
- [ ] **Flow**: Test the end-to-end flow:
    1.  User sends WhatsApp message.
    2.  Worker receives webhook.
    3.  Router sends to Agent.
    4.  Agent (LLM) processes message.
    5.  Agent calls `create_appointment` tool.
    6.  Appointment is saved to Supabase.
    7.  Confirmation sent back to WhatsApp.
- [ ] **Tooling**: Verify `create_appointment` and `cancel_appointment` tools work as expected.

## 6. Main App Integration (Context)
- [ ] **Login System**: Verify the Chat App (`chat.musait.app`) shares authentication state/cookies with the main app (`musait.app`) logic where applicable, or handles independent login correctly if separated.
