-- Add router_agent_master_prompt_text column to global_settings
-- This stores the system prompt for the RouterAgent (unbound conversations)
ALTER TABLE public.global_settings
    ADD COLUMN IF NOT EXISTS router_agent_master_prompt_text text;
