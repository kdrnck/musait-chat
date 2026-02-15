# WhatsApp Routing — musait-chat

## Routing Model (Hybrid)

Every incoming webhook includes `phone_number_id` from Meta.

### Route 1: Tenant-Specific Number

```
phone_number_id → whatsappNumbers table → tenantId = "tenant_abc"
→ Conversation directly linked to tenant_abc
→ Agent starts immediately
```

### Route 2: Master Number (Musait Global)

```
phone_number_id → whatsappNumbers table → isMasterNumber = true
→ Conversation starts in UNBOUND state (tenantId = null)
```

#### Unbound Flow:

1. **First message or invalid code**: Send tenant selection prompt
   ```
   Hoş geldiniz! Hangi işletmeye bağlanmak istiyorsunuz?

   Kadıköy Kuaför için '001' yazın.
   Beşiktaş Kuaför için '002' yazın.
   ```

2. **Valid code received**: Bind conversation to tenant
   ```
   ✅ Kadıköy Kuaför işletmesine bağlandınız. Size nasıl yardımcı olabilirim?
   ```

3. **After end_session**: Conversation archived, next message creates new unbound conversation

### Tenant Codes

Stored in Convex `tenantCodes` table:
- Dynamically generated from active tenant list
- Format: short numeric codes ("001", "002", etc.)
- Managed by admin

## Data Flow

```
WhatsApp Webhook
      │
      ▼
┌──────────────────┐
│ Look up           │
│ phone_number_id   │───▶ whatsappNumbers table
│ in Convex         │
└──────┬───────────┘
       │
       ├── Tenant number ──▶ Direct bind ──▶ Agent
       │
       └── Master number ──▶ Check conversation.tenantId
                               │
                               ├── null ──▶ Routing flow
                               │            (code prompt)
                               │
                               └── "tenant_abc" ──▶ Agent
                                    (already bound)
```

## Important Rules

1. Conversation binding is EXPLICIT (customer sends code)
2. Binding is persisted in Convex (survives restarts)
3. After end_session, binding is NOT preserved (archived)
4. Master number conversations must never leak between tenants
5. Invalid codes receive a polite retry message
