# Architecture Overview — musait-chat

## System Diagram

```
                          ┌─────────────────────────┐
                          │     chat.musait.app      │
                          │   (Next.js on Vercel)    │
                          │                          │
                          │  - Convex real-time UI   │
                          │  - Read-only by default  │
                          │  - Human input on handoff│
                          │  - Auth via .musait.app  │
                          │    HTTPOnly JWT cookies  │
                          └────────────┬────────────┘
                                       │ Convex subscription
                                       ▼
                          ┌─────────────────────────┐
                          │        Convex            │
                          │  (Chat State + AI State) │
                          │                          │
                          │  - conversations         │
                          │  - messages              │
                          │  - customerProfiles      │
                          │  - whatsappNumbers       │
                          │  - tenantCodes           │
                          │  - magicLinks            │
                          └────────────┬────────────┘
                                       │ HTTP Client
                                       ▼
┌──────────────┐         ┌─────────────────────────┐
│   WhatsApp   │ ──POST──▶     Worker (Railway)     │
│  Cloud API   │         │                          │
│   (Meta)     │◀─reply──│  - Express server        │
│              │         │  - Webhook endpoint      │
└──────────────┘         │  - InMemoryQueue (MVP)   │
                          │  - Job handler           │
                          │  - LLM via OpenRouter    │
                          │  - Tool execution        │
                          │  - WhatsApp send         │
                          └────────────┬────────────┘
                                       │ REST (service_role)
                                       ▼
                          ┌─────────────────────────┐
                          │       Supabase           │
                          │  (Business Data + Auth)  │
                          │                          │
                          │  - appointments          │
                          │  - customers             │
                          │  - services              │
                          │  - staff                 │
                          │  - working_hours         │
                          │  - tenants               │
                          │  - Auth (shared JWT)     │
                          └─────────────────────────┘
```

## Component Responsibilities

### chat.musait.app (Next.js / Vercel)
- Staff-facing dashboard
- Real-time conversation view via Convex subscriptions
- Read-only by default (conversations managed by agent)
- Writable only during handoff mode
- Auth via Supabase JWT cookies on .musait.app domain

### Worker (Express / Railway)
- WhatsApp webhook receiver (POST /webhook/whatsapp)
- Queue consumer (InMemoryQueue → future: RedisQueue)
- LLM orchestration (OpenRouter)
- Tool execution (server-side only)
- WhatsApp message sending
- Recovery on restart (re-enqueue pending messages from Convex)

### Convex
- Real-time chat state (conversations, messages)
- Customer profiles for personalization
- WhatsApp number → tenant mappings
- Tenant selection codes (master number flow)
- Magic links for human override access

### Supabase
- Business data (appointments, services, staff, working hours)
- Auth (shared across musait.app subdomains)
- Customer records

## Key Architectural Decisions

1. **Webhook + Worker in same process (Railway)**: InMemoryQueue requires co-located webhook and consumer. Future Redis migration decouples them.

2. **Convex for chat, Supabase for business**: Chat needs real-time subscriptions (Convex excels). Business data already exists in Supabase with RLS.

3. **No LLM in webhook**: Webhook must return 200 immediately. All LLM processing happens in the queue consumer.

4. **Read-only chat UI**: Staff sees conversations but cannot interfere with agent unless explicitly in handoff mode.

5. **Tenant isolation at every layer**: Convex queries filter by tenant_id, Supabase uses RLS, API validates tenant context from JWT.
