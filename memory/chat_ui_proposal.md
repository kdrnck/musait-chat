# Chat UI (apps/chat) Proposal

## 1. Overview
The Chat UI (`apps/chat`) is the command center for business staff to monitor and intervene in AI-customer conversations. It is built with **Next.js (App Router)**, **Tailwind CSS**, and **Convex** for real-time state management.

## 2. Core Objectives
1.  **Monitor AI:** Watch the agent handle customer requests in real-time.
2.  **Debug Agent:** Inspect agent "thoughts" (tool calls, reasoning) to verify workflow logic.
3.  **Handoff/Intervention:** Allow human staff to pause the AI and reply manually.

## 3. Architecture & Tech Stack
-   **Frontend:** Next.js 14 (App Router), Tailwind CSS, Lucide React (Icons).
-   **State Management:** Convex (Real-time database & backend functions).
-   **Auth:** Supabase Auth (Client-side login for MVP).
-   **Deployment:** Vercel.

## 4. Proposed Features (MVP)

### A. Conversation List (Sidebar)
-   **Real-time List:** Automatically updates as new messages arrive via WhatsApp.
-   **Conversation Summaries:** Brief AI-generated summaries displayed on the conversation cards so staff can quickly grasp the context without reading the whole log.
-   **Status Indicators:**
    -   🟢 **Active (AI)**: Agent is handling the chat.
    -   🔴 **Needs Attention**: Agent flagged for help (fallback).
    -   🔵 **Handoff (Human)**: AI is paused, human is in control.
-   **Filters & Advanced Search:** Filter by All, Unread, Handoff. Search by customer name, phone number, or keywords (e.g., "iptal") in archived/active chats.

### B. Chat Interface (Main View)
-   **Message History:** Standard chat bubbles (User vs Agent).
-   **Simplified Agent Actions (Default):** Business staff sees simplified, human-readable actions instead of raw logs (e.g., "📅 Checking availability...", "✅ Appointment created").
-   **Agent Internals (Debug Mode Toggle):** Hidden by default. When enabled (via a developer toggle), shows:
    -   Collapsible "Thought Process" blocks.
    -   Visual representation of Tool Calls (e.g., `create_appointment(...)`, `check_availability(...)`).
    -   Success/Error logs for tool execution.
-   **Input Area:**
    -   Text input for manual reply.
    -   "Send" button (triggers WhatsApp message via Worker).
    -   **"Take Over" Button:** Pauses the AI agent immediately.
    -   **"Resume AI" Button:** hands control back to the agent.

### C. Customer Insight Panel (Right Sidebar)
-   **Customer Context:** Displays details from Supabase (Name, total visits, past/upcoming appointments).
-   **Purpose:** Helps staff provide personalized responses when they take over a chat during Handoff mode.

### C. Data Models (Convex Schema)
To support this, we need the following Convex schema:

**`conversations` table:**
-   `_id`: ID
-   `userId`: string (Customer Phone ID)
-   `tenantId`: string (Business ID)
-   `status`: "active" | "archived"
-   `mode`: "ai" | "human"
-   `lastMessageAt`: number (timestamp)
-   `unreadCount`: number

**`messages` table:**
-   `conversationId`: ID
-   `sender`: "user" | "agent" | "system" | "human"
-   `content`: string
-   `metadata`: object (for tool calls, thoughts, debug info)
-   `timestamp`: number

## 5. Implementation To-Do Checklist (Execution Plan)

- [ ] **Phase 1: Project Setup & Auth**
  - [ ] Initialize `apps/chat` with Next.js (App Router), Tailwind, and shadcn/ui.
  - [ ] Set up Convex (`npx convex dev`) and configure the schema (`conversations`, `messages`).
  - [ ] Implement Supabase Auth middleware (sharing cookies with `musait.app`) so only authenticated staff/admins can access the UI.

- [ ] **Phase 2: Core Layout & Sidebar**
  - [ ] Build the main Dashboard layout.
  - [ ] Develop the **Conversation List (Left Sidebar)** with Convex real-time subscriptions.
  - [ ] Add basic status indicators (🟢 AI, 🔴 Attention, 🔵 Human) and search/filter inputs.

- [ ] **Phase 3: Chat Interface (Main View)**
  - [ ] Build the **Message History** view showing user and agent messages.
  - [ ] Implement the **Agent Action Interpreter**: Parse `metadata` to show simplified actions ("Randevu kontrol ediliyor...") to staff.
  - [ ] Implement the **Debug Mode Toggle**: When enabled, render the raw JSON tool calls and AI thought blocks.
  - [ ] Build the **Input Area** with "Take Over" and "Resume AI" handoff controls.

- [ ] **Phase 4: Customer Insights Panel (Right Sidebar)**
  - [ ] Build the UI for displaying customer profile details.
  - [ ] Fetch customer data (appointments, history) from Supabase based on the active conversation's phone number.

- [ ] **Phase 5: Worker Integration**
  - [ ] Update Worker webhook logic to write incoming/outgoing messages into Convex `messages` and `conversations`.
  - [ ] Establish communication so that manual messages sent from the Chat UI are correctly routed to the Worker to be dispatched via WhatsApp API.

## 6. Questions/Decisions
-   **Auth:** Shared Authentication with `musait.app`.
    -   The Chat UI will sit on a subdomain (e.g., `chat.musait.app`) or path (e.g., `/chat`).
    -   It will read the `sb-access-token` (or equivalent) cookie set by the main application's Supabase Auth.
    -   Middleware will validate this token against Supabase to ensure the user is an authenticated staff member/admin.
    -   **No separate login page**. If unauthenticated, redirect to main app login.
