# Agent Behavior — musait-chat

## Memory Strategy (Hybrid)

The agent uses a layered memory approach to prevent token explosion:

```
LLM Context = System Prompt
            + Customer Profile (person_notes + preferences)
            + Rolling Summary (compressed conversation history)
            + Context Window (last 20 messages)
            + Current Incoming Message
```

### System Prompt
- Defines agent personality (Turkish, polite, professional)
- Appointment confirmation rules (MUST get explicit confirmation)
- Tool usage guidelines
- Handoff escalation rules

### Customer Profile (Convex: customerProfiles)
- Per tenant, per phone number
- Stores: person_notes, lastServices, lastStaff, preferences
- Updated after each session
- Provides personalization without full history

### Rolling Summary
- Compressed summary of conversation history
- Updated after each resolved block (appointment made, cancelled, etc.)
- Prevents sending 100+ messages to LLM
- Format: short paragraph describing what happened

### Context Window
- Last 20 messages (configurable)
- Full content, chronological order
- Provides immediate conversational context
- Customer messages as "user", Agent as "assistant", Human as "[Operatör]"

## Tool System

### Available Tools

| Tool | Purpose | Tenant Scoped? |
|------|---------|---------------|
| view_available_slots | Query available appointment times | Yes |
| create_appointment | Book a new appointment | Yes |
| cancel_appointment | Cancel existing appointment | Yes |
| ask_human | Escalate to human staff | Yes |
| end_session | Archive conversation | Yes |

### Execution Rules

1. ALL tool calls execute server-side (worker process)
2. NEVER execute from client/browser
3. ALL respect tenant isolation (tenant_id from conversation)
4. Tool results feed back into LLM for natural response
5. Max 5 tool call iterations per message (safety limit)

### Confirmation Flow (Critical)

For create_appointment:
1. Agent shows available slots → customer picks one
2. Agent repeats: "X tarihinde saat Y'de Z için randevu, onaylıyor musunuz?"
3. Customer says "evet" → ONLY THEN call create_appointment
4. Customer says "hayır" → offer alternatives

This is enforced in the system prompt, not in code.

## Conversation States

```
                 ┌──────────┐
    new message  │  active   │  ←── default state
    ──────────▶  │  (agent)  │
                 └─────┬─────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ archived │ │ handoff  │ │  active   │
    │(session  │ │(human    │ │(continues)│
    │ ended)   │ │ override)│ │           │
    └──────────┘ └────┬─────┘ └───────────┘
                      │
                      │ staff re-enables agent
                      ▼
                ┌──────────┐
                │  active   │
                │  (agent)  │
                └──────────┘
```

## Human Override Rules

1. Triggered by: ask_human tool OR manual staff action
2. Agent disabled for 24 hours on that conversation
3. Telegram notification sent with magic link
4. Magic link: one-time, 1 hour expiry, stored in Convex
5. Chat UI becomes writable for authorized staff
6. Staff can re-enable agent manually
7. When re-enabled: conversation returns to "active", agent resumes
