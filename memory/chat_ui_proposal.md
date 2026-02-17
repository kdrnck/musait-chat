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
-   **Status Indicators:**
    -   🟢 **Active (AI)**: Agent is handling the chat.
    -   🔴 **Needs Attention**: Agent flagged for help (fallback).
    -   🔵 **Handoff (Human)**: AI is paused, human is in control.
-   **Filters:** All, Unread, Handoff.

### B. Chat Interface (Main View)
-   **Message History:** Standard chat bubbles (User vs Agent).
-   **Agent Internals (Debug View):**
    -   Collapsible "Thought Process" blocks.
    -   Visual representation of Tool Calls (e.g., `create_appointment(...)`, `check_availability(...)`).
    -   Success/Error logs for tool execution.
-   **Input Area:**
    -   Text input for manual reply.
    -   "Send" button (triggers WhatsApp message via Worker).
    -   **"Take Over" Button:** Pauses the AI agent immediately.
    -   **"Resume AI" Button:** hands control back to the agent.

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

## 5. Implementation Plan
1.  **Init:** `npx create-next-app@latest apps/chat`.
2.  **Convex:** `npx convex dev` to init project and schema.
3.  **UI:** Build `Layout`, `Sidebar`, `ChatWindow` components.
4.  **Integration:**
    -   Worker pushes WhatsApp webhook data -> Convex `messages`.
    -   Chat UI sends message -> Convex `messages`.
    -   Worker listens to Convex (or HTTP trigger) -> Sends to WhatsApp API.

## 6. Questions/Decisions
-   **Auth:** Shared Authentication with `musait.app`.
    -   The Chat UI will sit on a subdomain (e.g., `chat.musait.app`) or path (e.g., `/chat`).
    -   It will read the `sb-access-token` (or equivalent) cookie set by the main application's Supabase Auth.
    -   Middleware will validate this token against Supabase to ensure the user is an authenticated staff member/admin.
    -   **No separate login page**. If unauthenticated, redirect to main app login.
