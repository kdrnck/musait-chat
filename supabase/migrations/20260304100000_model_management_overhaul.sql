-- ============================================================
-- Model Management Overhaul Migration
-- Date: 2026-03-04
-- Description:
--   1. Create ai_model_tiers table (tier definitions)
--   2. Expand ai_models table (provider_config, tier, metadata)
--   3. Create tenant_model_tier table (tenant ↔ tier assignment)
--   4. Create test_sessions table (test lab persistence)
--   5. Seed default tiers + migrate hardcoded presets to ai_models
-- ============================================================

-- ── 1. ai_model_tiers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_model_tiers (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,            -- slug: 'default', 'premium', 'enterprise'
    display_name text NOT NULL,                  -- UI label: 'Standart Paket'
    description text,
    is_default  boolean NOT NULL DEFAULT false,  -- new businesses get this tier
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one default tier
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_tiers_single_default
    ON ai_model_tiers (is_default) WHERE is_default = true;

-- ── 2. Expand ai_models ────────────────────────────────────
-- tier column (references ai_model_tiers.name for simplicity)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'tier') THEN
        ALTER TABLE ai_models ADD COLUMN tier text NOT NULL DEFAULT 'default';
    END IF;
END $$;

-- provider_config: full OpenRouter provider routing object
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'provider_config') THEN
        ALTER TABLE ai_models ADD COLUMN provider_config jsonb;
    END IF;
END $$;

-- supports_tools flag
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'supports_tools') THEN
        ALTER TABLE ai_models ADD COLUMN supports_tools boolean NOT NULL DEFAULT true;
    END IF;
END $$;

-- supports_reasoning flag
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'supports_reasoning') THEN
        ALTER TABLE ai_models ADD COLUMN supports_reasoning boolean NOT NULL DEFAULT false;
    END IF;
END $$;

-- context_window (max input tokens)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'context_window') THEN
        ALTER TABLE ai_models ADD COLUMN context_window integer;
    END IF;
END $$;

-- max_output_tokens
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'max_output_tokens') THEN
        ALTER TABLE ai_models ADD COLUMN max_output_tokens integer;
    END IF;
END $$;

-- description (admin notes)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'description') THEN
        ALTER TABLE ai_models ADD COLUMN description text;
    END IF;
END $$;

-- sort_order for UI ordering
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_models' AND column_name = 'sort_order') THEN
        ALTER TABLE ai_models ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Index on tier for fast lookups
CREATE INDEX IF NOT EXISTS idx_ai_models_tier ON ai_models (tier);

-- ── 3. tenant_model_tier ───────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_model_tier (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   uuid NOT NULL UNIQUE,            -- one tier per tenant
    tier_id     uuid NOT NULL REFERENCES ai_model_tiers(id) ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by uuid                             -- admin user who assigned
);

CREATE INDEX IF NOT EXISTS idx_tenant_model_tier_tenant ON tenant_model_tier (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_model_tier_tier   ON tenant_model_tier (tier_id);

-- ── 4. test_sessions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS test_sessions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    model           text NOT NULL,                -- openrouter model id
    provider_config jsonb,                        -- provider routing used
    system_prompt   text,
    temperature     real,
    max_tokens      integer,
    messages        jsonb NOT NULL DEFAULT '[]'::jsonb,
    metrics_summary jsonb,                        -- aggregated metrics
    created_by      uuid NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_test_sessions_user ON test_sessions (created_by);

-- ── 5. Seed default tiers ──────────────────────────────────
INSERT INTO ai_model_tiers (name, display_name, description, is_default)
VALUES
    ('default',    'Standart Paket',  'Temel AI modelleri — tüm işletmeler için varsayılan', true),
    ('premium',    'Premium Paket',   'Gelişmiş ve yüksek performanslı modeller', false),
    ('enterprise', 'Enterprise Paket','Tam erişim — tüm modeller', false)
ON CONFLICT (name) DO NOTHING;

-- ── 6. RLS policies ────────────────────────────────────────
ALTER TABLE ai_model_tiers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_model_tier ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_sessions     ENABLE ROW LEVEL SECURITY;

-- ai_model_tiers: readable by all authenticated, writable by service role only
CREATE POLICY "ai_model_tiers_read"  ON ai_model_tiers FOR SELECT TO authenticated USING (true);
CREATE POLICY "ai_model_tiers_write" ON ai_model_tiers FOR ALL    TO service_role  USING (true);

-- tenant_model_tier: readable by all authenticated, writable by service role
CREATE POLICY "tenant_model_tier_read"  ON tenant_model_tier FOR SELECT TO authenticated USING (true);
CREATE POLICY "tenant_model_tier_write" ON tenant_model_tier FOR ALL    TO service_role  USING (true);

-- test_sessions: users can only see/edit their own sessions
CREATE POLICY "test_sessions_own" ON test_sessions FOR ALL TO authenticated
    USING (created_by = auth.uid());
CREATE POLICY "test_sessions_service" ON test_sessions FOR ALL TO service_role USING (true);
