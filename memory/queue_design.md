# Queue Design — musait-chat

## Interface (Stable Contract)

```typescript
interface AgentQueue {
  enqueue(job: AgentJob): Promise<void>
  startWorker(handler: (job: AgentJob) => Promise<void>): void
  stop(): Promise<void>
  size(): number
}
```

This interface MUST NOT change during Redis migration. Only the implementation swaps.

## MVP: InMemoryQueue

- Backed by in-memory array
- Single worker process on Railway
- Concurrency: 1 (configurable up to 3)
- Deduplication by job ID
- Poll interval: 500ms as fallback
- Job timeout: 30s

### Processing Flow

```
Webhook POST → Validate → Save to Convex (pending) → Enqueue → Return 200
                                                         │
                                    ┌────────────────────┘
                                    ▼
                              Queue Consumer
                                    │
                              ┌─────┴─────┐
                              │ Has capacity? │
                              └─────┬─────┘
                                    │ Yes
                                    ▼
                            Process Job:
                            1. Mark message → processing
                            2. Check handoff mode
                            3. Route (master number flow)
                            4. Build LLM context
                            5. Call OpenRouter
                            6. Execute tool calls (if any)
                            7. Save agent response
                            8. Send WhatsApp reply
                            9. Mark message → done
                            10. Update rolling summary
```

### Retry Strategy

- Max retries: 3
- Backoff: exponential (1s, 2s, 4s)
- After max retries → message.status = "failed"
- Failed messages visible in dashboard

### Recovery on Restart

On worker startup:
1. Query Convex for messages where status = "pending" OR status = "processing"
2. For each, create AgentJob and enqueue
3. Processing continues normally

This ensures zero message loss even with InMemoryQueue.

## Future: RedisQueue (BullMQ + Upstash)

### Migration Steps

1. Install `bullmq` + Upstash Redis connection
2. Create `RedisQueue` implementing `AgentQueue` interface
3. Swap import in `worker/src/index.ts`
4. Remove InMemoryQueue poll interval (BullMQ handles it)
5. Keep recovery logic as safety net

### What Changes
- Queue implementation file
- Environment variables (REDIS_URL)
- Worker startup (BullMQ worker instead of poll)

### What Does NOT Change
- AgentJob type
- Job handler function
- Webhook logic
- Tool system
- LLM integration
- Frontend
- Convex schema

## Rate Limiting

Enforced at worker level (not queue level):
- Global: 60 messages/minute
- Per tenant: 20 messages/minute
- WhatsApp API: 10 messages/second

Rate limiter is separate from queue — sits between queue consumer and WhatsApp send.
