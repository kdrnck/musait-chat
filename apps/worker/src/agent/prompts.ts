import { buildAgentSystemPrompt } from "./master-prompts.js";

interface Conversation {
  tenantId: string | null;
  [key: string]: any;
}

/**
 * Build the system prompt for the agent.
 * This defines the agent's personality, capabilities, and rules.
 */
export function buildSystemPrompt(conversation: Conversation): string {
  return buildAgentSystemPrompt({ tenantId: conversation.tenantId });
}
