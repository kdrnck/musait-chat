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

## 5. Chat UI (MVP) - **PRIORITY**
- [ ] **Initialize**: `apps/chat` (Next.js + Tailwind + Convex).
- [ ] **Convex Setup**: Define schema for `conversations`, `messages`.
- [ ] **UI - Conversation List**: Real-time list of active chats.
- [ ] **UI - Chat Window**: 
    - [ ] Message history (User vs Agent).
    - [ ] Input area for human reply.
    - [ ] Visual distinction for Agent thoughts/Tool outputs (for debugging).
- [ ] **Integration**: 
    - [ ] Connect to Convex backend.
    - [ ] Ensure sending a message triggers Worker to send WhatsApp.

## 6. Agent Workflow: WhatsApp -> LLM -> Appointment
- [ ] **Flow**: Test the end-to-end flow using Chat UI for visibility:
    1.  User sends WhatsApp message.
    2.  Worker receives webhook -> Pushes to Convex.
    3.  **Chat UI sees new message.**
    4.  Router sends to Agent.
    5.  Agent (LLM) processes message.
    6.  **Chat UI sees Agent thoughts/Tool calls.**
    7.  Agent calls `create_appointment` tool.
    8.  Appointment is saved to Supabase.
    9.  Confirmation sent back to WhatsApp.
    10. **Chat UI shows final response.**
