// Conversation types - mirrors Convex schema

export type ConversationStatus = "active" | "archived" | "handoff";
export type MessageRole = "customer" | "agent" | "human";
export type MessageStatus = "pending" | "processing" | "done" | "failed";

export interface Conversation {
  _id: string;
  tenantId: string | null; // null until bound (master number flow)
  customerPhone: string;
  status: ConversationStatus;
  lastMessageAt: number;
  rollingSummary: string;
  personNotes: string;
  retryState: {
    count: number;
    lastAttempt: number | null;
  };
  createdAt: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  retryCount: number;
  createdAt: number;
}

export interface CustomerProfile {
  _id: string;
  tenantId: string;
  customerPhone: string;
  personNotes: string;
  lastServices: string[];
  lastStaff: string[];
  preferences: Record<string, unknown>;
  updatedAt: number;
}
