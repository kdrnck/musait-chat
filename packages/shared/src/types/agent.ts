// Agent / LLM types

/** Tools available to the AI agent */
export type AgentToolName =
  | "list_services"
  | "list_staff"
  | "get_business_info"
  | "list_customer_appointments"
  | "view_available_slots"
  | "create_appointment"
  | "cancel_appointment"
  | "suggest_least_busy_staff"
  | "ask_human"
  | "handOff"
  | "end_session"
  | "bind_tenant";

/** Base tool call request from LLM */
export interface ToolCallRequest {
  id: string;
  name: AgentToolName;
  arguments: Record<string, unknown>;
}

/** Tool call result */
export interface ToolCallResult {
  toolCallId: string;
  name: AgentToolName;
  result: unknown;
  error?: string;
}

// --- Tool parameter types ---

export interface ViewAvailableSlotsParams {
  date: string; // ISO date string (YYYY-MM-DD)
  serviceId?: string;
  staffId?: string;
}

export interface CreateAppointmentParams {
  tenantId: string;
  customerPhone: string;
  serviceId: string;
  staffId: string;
  startTime: string; // ISO datetime
  customerName?: string;
}

export interface CancelAppointmentParams {
  appointmentId: string;
  reason?: string;
}

export interface AskHumanParams {
  reason: string;
  conversationId: string;
}

export interface EndSessionParams {
  conversationId: string;
  summary?: string;
}

// --- LLM types ---

export type LLMMessageRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMMessageRole;
  content: string | null;
  tool_calls?: ToolCallRequest[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  /** OpenRouter API key */
  apiKey: string;
}

export const DEFAULT_LLM_CONFIG: Omit<LLMConfig, "apiKey"> = {
  model: "deepseek/deepseek-chat",
  temperature: 0.7,
  maxTokens: 1024,
};
