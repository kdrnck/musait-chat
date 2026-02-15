# Product Overview — musait-chat

## What is it?
musait-chat is the AI-powered WhatsApp messaging layer for musait.app — a multi-tenant appointment booking platform for service businesses (salons, barbers, clinics).

## Core User Story
A customer sends a WhatsApp message to a business. An AI agent handles the conversation: checking availability, booking appointments, answering questions. Human staff can monitor and intervene when needed via chat.musait.app.

## Users

### Customers (WhatsApp)
- Send messages via WhatsApp
- Book, cancel, or inquire about appointments
- Interact with AI agent naturally in Turkish
- Can be routed to human when needed

### Business Staff (chat.musait.app)
- Monitor AI conversations in real-time
- Intervene during handoff mode
- Re-enable agent after manual intervention
- Access via magic links (Telegram notification)

### Admin / Master (chat.musait.app)
- View all tenant conversations
- Manage WhatsApp number mappings
- Manage tenant codes
- System configuration

## Key Flows

### 1. Direct Tenant Message
Customer → Tenant's WhatsApp number → AI agent → Appointment handling

### 2. Master Number Message
Customer → Musait master number → Tenant selection → AI agent → Appointment handling

### 3. Human Override
AI can't handle → ask_human tool → Telegram notification → Staff opens magic link → Responds in chat → Re-enables agent

### 4. End Session
Customer finishes → end_session tool → Conversation archived → Summary saved → Ready for next session

## Business Rules
- Appointments MUST be confirmed before creation
- Agent speaks Turkish only
- Human override lasts 24 hours max
- Magic links expire in 1 hour (one-time use)
- Conversations are strictly tenant-isolated
- Master users can access all tenants
