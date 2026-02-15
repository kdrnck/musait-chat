# agents.md — musait-chat Project Rules

## Project Identity
This is the chat system for musait.app — a multi-tenant AI messaging infrastructure integrating WhatsApp, OpenRouter LLM, Supabase (auth + business data), and Convex (chat + AI state).

## Architecture Boundaries

### Separation of Concerns
- **Convex** = chat state (conversations, messages, profiles, mappings)
- **Supabase** = business data (appointments, services, staff, tenants, auth)
- **Worker (Railway)** = all backend processing (webhook, queue, LLM, tools)
- **Frontend (Vercel)** = read-only chat UI with handoff input capability

### NEVER cross these boundaries:
- Frontend NEVER calls LLM directly
- Frontend NEVER executes tool calls
- Frontend NEVER uses Supabase service_role key
- Webhook NEVER calls LLM (queue first, always)
- Client NEVER stores tokens in localStorage

---

## Queue Abstraction (Sacred Contract)

```typescript
interface AgentQueue {
  enqueue(job: AgentJob): Promise<void>
  startWorker(handler: (job: AgentJob) => Promise<void>): void
  stop(): Promise<void>
  size(): number
}
```

### Rules:
1. This interface MUST NOT change during Redis migration
2. Only the queue implementation file changes, never the consumer
3. The job handler function is implementation-agnostic
4. InMemoryQueue is MVP; RedisQueue (BullMQ + Upstash) is the upgrade path
5. Recovery logic (re-enqueue from Convex) must always exist as safety net

---

## Webhook Rules

1. Validate incoming request
2. Persist message to Convex (status=pending)
3. Enqueue job to queue
4. Return 200 immediately
5. **NEVER call LLM from webhook**
6. **NEVER do heavy processing in webhook**

---

## Tool Execution Rules

1. ALL tool calls execute server-side (worker process)
2. NEVER execute tools from client/browser
3. ALL tools must respect tenant isolation (filter by tenant_id)
4. Tool results feed back into LLM for natural language response
5. Max 5 tool call iterations per message (safety limit)
6. create_appointment REQUIRES explicit customer confirmation (enforced in system prompt)

---

## Tenant Isolation Guarantees

Every data access must be scoped to the correct tenant:
- Convex queries: filter by tenant_id
- Supabase queries: include tenant_id in WHERE clause
- API routes: validate tenant_id from JWT app_metadata
- Master role: unrestricted access (no tenant filter)
- Non-master roles: MUST have valid tenant_id

---

## Worker Concurrency

- MVP: 1 concurrent job (single process)
- Max configurable: 3 concurrent jobs
- Job timeout: 30 seconds
- Retry: max 3 attempts with exponential backoff
- After max retries: message.status = "failed"

---

## Human Override Behavior

1. Triggered by: `ask_human` tool OR manual staff action
2. Sets conversation.status = "handoff"
3. Disables agent for 24 hours on that conversation
4. Creates one-time magic link (1 hour expiry)
5. Sends Telegram notification
6. Chat UI becomes writable for authorized staff
7. Staff can re-enable agent manually
8. On re-enable: status returns to "active"

---

## Memory Strategy

Agent context = System Prompt + Customer Profile + Rolling Summary + Last 20 Messages + Current Message

- Full transcript stored in Convex (never deleted)
- Only context window sent to LLM
- Rolling summary updated after each resolved block
- Customer profile persists across sessions

---

## Redis Migration Path

When migrating from InMemoryQueue to RedisQueue:

### Changes:
- New file: `apps/worker/src/queue/redis-queue.ts`
- Import swap in `apps/worker/src/index.ts`
- New env: `REDIS_URL`

### Unchanged:
- AgentJob type
- Job handler function
- All tool implementations
- LLM integration
- Frontend
- Convex schema
- Webhook logic

---

## File Structure Convention

```
musait-chat/
├── apps/
│   ├── chat/           # Next.js frontend (Vercel)
│   └── worker/         # Express + Worker (Railway)
├── convex/             # Convex schema and functions
├── packages/
│   └── shared/         # Shared types and interfaces
├── memory/             # Architecture documentation
├── supabase/           # Supabase CLI config
└── .cursor/rules/      # This file
```

---

## Code Style

- TypeScript everywhere (strict mode)
- ESM modules
- Async/await (no raw promises/callbacks)
- Error handling: try/catch with logging, never silent failures
- Frontend: Türkçe (Turkish) user-facing text
- Code/comments: language-agnostic (English preferred for code)
- Use CSS variables for theming (see globals.css)
- Fonts: Cormorant Garamond (display) + DM Sans (body)

---

## Security Rules

1. All tool calls server-side only
2. Strict tenant validation on every request
3. JWT-based route protection (HTTPOnly cookies on .musait.app)
4. No localStorage tokens
5. No service_role key in frontend
6. Signed Telegram magic links
7. Replay protection (one-time magic links)
8. Retry limits enforced
9. Rate limiting at worker level

---

## Risk Awareness

| Risk | Mitigation |
|------|-----------|
| Worker crash loses queue | Convex recovery on startup |
| LLM hallucination books wrong appointment | Explicit confirmation required |
| Tenant data leak | Isolation at every layer |
| WhatsApp API rate limit | Worker-level throttling |
| Token explosion in long conversations | Rolling summary + context window |
| Magic link replay | One-time use flag in Convex |
