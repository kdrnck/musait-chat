-- Create prompt_templates table for storing reusable AI prompts
-- Templates can be scoped to: global (NULL tenant_id), per-tenant, or per-model

CREATE TABLE IF NOT EXISTS public.prompt_templates (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text,
    model_id text, -- e.g., "deepseek/deepseek-chat", NULL = all models
    category text NOT NULL DEFAULT 'general', -- 'system', 'routing', 'greeting', 'general'
    prompt_text text NOT NULL,
    parameters jsonb DEFAULT '{}', -- temperature, max_tokens, etc.
    is_active boolean DEFAULT true,
    is_default boolean DEFAULT false, -- only one default per tenant+category
    created_by uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_prompt_templates_tenant_id ON public.prompt_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON public.prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_model_id ON public.prompt_templates(model_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_is_active ON public.prompt_templates(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read global templates (tenant_id IS NULL)
CREATE POLICY "Allow read global prompt_templates"
    ON public.prompt_templates FOR SELECT
    TO authenticated
    USING (tenant_id IS NULL);

-- Policy: Tenant members can read their own tenant's templates
CREATE POLICY "Allow read tenant prompt_templates"
    ON public.prompt_templates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = prompt_templates.tenant_id
            AND tu.user_id = auth.uid()
        )
    );

-- Policy: Master users can read all templates
CREATE POLICY "Allow read all for master users"
    ON public.prompt_templates FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_master = true
        )
    );

-- Policy: Master users can create/update/delete global templates
CREATE POLICY "Allow write global for master users"
    ON public.prompt_templates FOR ALL
    TO authenticated
    USING (
        tenant_id IS NULL AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_master = true
        )
    )
    WITH CHECK (
        tenant_id IS NULL AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.is_master = true
        )
    );

-- Policy: Tenant owners/admins can manage their tenant's templates
CREATE POLICY "Allow write tenant templates for owners"
    ON public.prompt_templates FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = prompt_templates.tenant_id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('owner', 'admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_users tu
            WHERE tu.tenant_id = prompt_templates.tenant_id
            AND tu.user_id = auth.uid()
            AND tu.role IN ('owner', 'admin')
        )
    );

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_prompt_templates_updated_at
    BEFORE UPDATE ON public.prompt_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_prompt_templates_updated_at();

-- Insert default global prompts
INSERT INTO public.prompt_templates (tenant_id, name, description, category, prompt_text, is_default)
VALUES
(
    NULL,
    'Varsayılan Sistem Promptu',
    'Tüm işletmelerde kullanılan temel asistan promptu',
    'system',
    'Sen Musait asistanısın. Müşterilere randevu alma, iptal etme ve bilgi verme konularında yardımcı oluyorsun.

## Kurallar
- Her zaman Türkçe konuş.
- Kibar, profesyonel ve yardımsever ol.
- Kısa ve öz cevaplar ver.
- Müşterinin ihtiyacını anla ve doğru aracı (tool) kullan.
- Randevu oluştururken MUTLAKA müşteriden onay al.
- Onay almadan asla randevu oluşturma.
- Kalın metin oluşturmak için *metin* kullan.',
    true
),
(
    NULL,
    'Router Agent Promptu',
    'Bilinmeyen numaralardan gelen mesajları yönlendiren agent promptu',
    'routing',
    'Sen bir yönlendirme asistanısın. Müşteri hangi işletmeyle görüşmek istediğini anlamaya çalış.

## Kurallar
- İşletme adını veya kategorisini sor.
- İşletme belirlendiğinde görüşmeyi yönlendir.
- Emin değilsen açıklama iste.',
    true
),
(
    NULL,
    'Karşılama Mesajı',
    'Yeni görüşme başladığında kullanılan karşılama mesajı',
    'greeting',
    'Merhaba! 👋 Ben Musait asistanıyım. Size nasıl yardımcı olabilirim?

Randevu almak, iptal etmek veya bilgi almak için buradayım.',
    true
);
