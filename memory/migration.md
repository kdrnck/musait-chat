# Migration Roadmap — musait-chat

## Phase 1: MVP (Current)

### Stack
- Frontend: Next.js on Vercel (chat.musait.app)
- Worker: Express on Railway
- Queue: InMemoryQueue
- Chat state: Convex
- Business data: Supabase
- LLM: OpenRouter (DeepSeek)
- Notifications: Telegram (when configured)

### Limitations
- Single worker instance (no horizontal scaling)
- Queue lost on restart (mitigated by Convex recovery)
- No per-tenant model configuration
- Basic rate limiting (in-memory counters)

---

## Phase 2: Redis Queue

### Trigger: When any of these occur
- Worker needs horizontal scaling
- Queue reliability becomes critical
- Job scheduling needed (delayed jobs)

### Steps
1. Provision Upstash Redis
2. Install `bullmq` package
3. Create `RedisQueue` implementing `AgentQueue` interface
4. Swap queue import in `worker/src/index.ts`
5. Add `REDIS_URL` environment variable
6. Keep Convex recovery as safety net
7. Test: webhook → enqueue → process → respond

### Changes
- New file: `apps/worker/src/queue/redis-queue.ts`
- Modified: `apps/worker/src/index.ts` (import swap)
- New env: `REDIS_URL`

### Unchanged
- AgentJob type
- Job handler
- All tool implementations
- LLM integration
- Frontend
- Convex schema

---

## Phase 3: Per-Tenant Configuration

### Features
- Per-tenant LLM model selection
- Per-tenant system prompt customization
- Per-tenant rate limits
- Tenant-specific WhatsApp number management UI

### Implementation
- New Convex table: `tenantConfig`
- Agent reads config at job start
- Config cached in worker memory (TTL: 5 min)

---

## Phase 4: Advanced Features

### Planned
- Multi-language support
- Image/audio message handling
- Appointment reminders (scheduled messages)
- Analytics dashboard
- Customer satisfaction surveys
- Webhook retry with dead letter queue

### Infrastructure
- Redis required for scheduled jobs
- Consider edge functions for webhook (latency optimization)
- CDN for static assets
- Monitoring: Sentry for errors, Axiom for logs

---

## Anti-Patterns to Avoid

1. **Never call LLM from webhook** — Always queue first
2. **Never expose service keys to client** — All tool calls server-side
3. **Never bypass tenant isolation** — Always filter by tenant_id
4. **Never store tokens in localStorage** — HTTPOnly cookies only
5. **Never couple queue interface to implementation** — AgentQueue contract is sacred
6. **Never skip confirmation for appointments** — System prompt enforces this
