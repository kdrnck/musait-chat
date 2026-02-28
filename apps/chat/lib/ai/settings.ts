export type AiModelProfile = "cheap" | "fast" | "premium" | "oss-deepinfra" | "oss-groq";
export type OutboundNumberMode = "inbound" | "musait" | "tenant";

export interface AiModelPreset {
  label: string;
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
}

export const AI_MODEL_PRESETS: Record<AiModelProfile, AiModelPreset> = {
  cheap: {
    label: "Ucuz Default (DeepSeek + DeepInfra)",
    model: "deepseek/deepseek-chat-v3-0324",
    providerPriority: ["deepinfra", "groq"],
    allowFallbacks: true,
  },
  fast: {
    label: "Hızlı Default (DeepSeek + Groq)",
    model: "deepseek/deepseek-chat-v3-0324",
    providerPriority: ["groq", "deepinfra"],
    allowFallbacks: true,
  },
  premium: {
    label: "Hızlı Premium (Gemini Fast 3 Preview)",
    model: "google/gemini-2.5-flash-preview",
    providerPriority: [],
    allowFallbacks: true,
  },
  "oss-deepinfra": {
    label: "gpt-oss-120b fast (DeepInfra)",
    model: "openai/gpt-oss-120b",
    providerPriority: ["deepinfra"],
    allowFallbacks: true,
  },
  "oss-groq": {
    label: "gpt-oss-120b fast (Groq)",
    model: "openai/gpt-oss-120b",
    providerPriority: ["groq"],
    allowFallbacks: true,
  },
};

export const DEFAULT_AI_MODEL_PROFILE: AiModelProfile = "fast";
export const DEFAULT_OUTBOUND_NUMBER_MODE: OutboundNumberMode = "inbound";

export const DEFAULT_AI_SYSTEM_PROMPT = `Sen Musait asistanısın. Müşterilere randevu alma, iptal etme ve bilgi verme konularında yardımcı oluyorsun.

## Kurallar
- Her zaman Türkçe konuş.
- Kibar, profesyonel ve yardımsever ol.
- Kısa ve öz cevaplar ver.
- Müşterinin ihtiyacını anla ve doğru aracı (tool) kullan.
- Randevu oluştururken MUTLAKA müşteriden onay al.
- Onay almadan asla randevu oluşturma.
- Kalın metin oluşturmak için *metin* kullan. iki adet yıldız (*) kullanma. Bir adet yıldız (*) kullan.
- Müşteri adı biliniyorsa adı sadece selamlaşma ve randevu onay/özet mesajlarında doğal şekilde kullan.
- Müşteri adı kesin değilse konuşmanın başında zorla sorma; randevu tamamlanmaya yakın adını nazikçe iste.
- İlk greeting cevabında mümkünse hizmetler linkini paylaş: "[Hizmetlerimize buradan göz atabilirsiniz](...)".

## Randevu Onay Akışı
1. Müşteri randevu istediğinde, önce uygun slotları göster (view_available_slots).
2. Müşteri bir slot seçtiğinde, detayları tekrarla ve onay iste:
   "X tarihinde saat Y'de Z hizmeti için randevu oluşturuyorum, onaylıyor musunuz?"
3. Müşteri "evet", "onaylıyorum" gibi olumlu yanıt verirse -> create_appointment kullan.
4. Müşteri "hayır" derse -> alternatif öner veya iptal et.

## İptal Akışı
1. Müşteri randevu iptal etmek istediğinde, randevu detaylarını doğrula.
2. İptal sebebini sor.
3. Onay al -> cancel_appointment kullan.

## İnsan Desteği
- Yanıt veremediğin veya karmaşık durumlar için ask_human aracını kullan.
- Müşteriye "Sizi bir yetkiliye bağlıyorum" de.

## Oturum Sonlandırma
- Müşteri "teşekkürler", "başka bir şey yok" gibi ifadeler kullanırsa -> end_session kullan.
- Oturum sonlandırırken nazik bir kapanış mesajı ver.

Aktif İşletme ID: {{tenant_id}}`;

export interface ResolvedAiSettings {
  modelProfile: AiModelProfile;
  model: string;
  providerPriority: string[];
  allowFallbacks: boolean;
  promptText: string;
  outboundNumberMode: OutboundNumberMode;
  bookingFlowEnabled: boolean;
}

export function resolveAiSettingsFromIntegrationKeys(
  integrationKeys: unknown,
  globalSystemPrompt?: string | null
): ResolvedAiSettings {
  const keys = asObject(integrationKeys);

  const profileRaw = asString(keys.ai_model_profile)?.toLowerCase();
  const modelProfile: AiModelProfile =
    profileRaw === "cheap" || profileRaw === "fast" || profileRaw === "premium" || profileRaw === "oss-deepinfra" || profileRaw === "oss-groq"
      ? (profileRaw as AiModelProfile)
      : DEFAULT_AI_MODEL_PROFILE;

  const preset = AI_MODEL_PRESETS[modelProfile];

  const model = asString(keys.ai_model) || preset.model;
  const providerPriority =
    parseProviderPriority(keys.ai_provider_priority) || preset.providerPriority;

  const allowFallbacks =
    asBoolean(keys.ai_allow_fallbacks) ?? preset.allowFallbacks;

  const promptOverride = asString(keys.ai_system_prompt_text);
  const legacyExtraPrompt = asString(keys.ai_extra_system_prompt);

  const promptText =
    promptOverride ||
    (legacyExtraPrompt
      ? `${globalSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT}\n\n## Tenant Ek Talimatlar\n${legacyExtraPrompt}`
      : (globalSystemPrompt || DEFAULT_AI_SYSTEM_PROMPT));

  const outboundModeRaw = asString(keys.ai_outbound_number_mode)?.toLowerCase();
  const outboundNumberMode: OutboundNumberMode =
    outboundModeRaw === "inbound" ||
      outboundModeRaw === "musait" ||
      outboundModeRaw === "tenant"
      ? (outboundModeRaw as OutboundNumberMode)
      : DEFAULT_OUTBOUND_NUMBER_MODE;

  // Booking flow disabled by default - LLM handles conversation flow
  const bookingFlowEnabled = asBoolean(keys.ai_booking_flow_enabled) ?? false;

  return {
    modelProfile,
    model,
    providerPriority,
    allowFallbacks,
    promptText,
    outboundNumberMode,
    bookingFlowEnabled,
  };
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return null;
}

function parseProviderPriority(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    const parsed = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : null;
  }

  if (typeof value === "string") {
    const parsed = value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : null;
  }

  return null;
}
