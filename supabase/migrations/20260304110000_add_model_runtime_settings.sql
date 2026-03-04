-- Add per-model runtime settings to ai_models
-- max_iterations: max tool call iterations per agent turn (1-10), default 5
-- llm_timeout_ms: LLM request timeout in milliseconds (3000-30000), default 15000
-- All tenants using a given model will inherit these settings.

ALTER TABLE ai_models
  ADD COLUMN IF NOT EXISTS max_iterations integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS llm_timeout_ms integer NOT NULL DEFAULT 15000;

COMMENT ON COLUMN ai_models.max_iterations IS 'Max tool call iterations per agent turn (1-10)';
COMMENT ON COLUMN ai_models.llm_timeout_ms IS 'LLM request timeout in milliseconds (3000-30000)';
