# WhatsApp Mesaj Yanıt Süresi Optimizasyon Planı

> **SLA Hedefi**: p90 < 3 saniye  
> **Tarih**: 2025-01-XX  
> **Durum**: Faz 0 + Faz 1 ✅ TAMAMLANDI

---

## Analiz Özeti

### Mevcut Akış (Webhook → Yanıt)
```
Webhook → Convex persist → Queue.enqueue
       → Queue.dequeue → getById + getConvById (ardışık)
       → simulateTyping (1.5s yapay gecikme!)
       → routing (whatsappNumbers.getByPhoneNumberId → duplicate)
       → conversations.getById (duplicate)
       → identitySync (customerProfiles.getByPhone → ardışık)
       → buildContext (fetchGlobalSettings → fetchTenantContext → ardışık services/staff/business → customerProfiles.getByPhone DUPLICATE)
       → LLM call (15s timeout!)
       → response save → WhatsApp send (ardışık)
       → mark done → debugInfo save (ardışık)
```

### Tespit Edilen Darboğazlar

| # | Darboğaz | Tahmini Kayıp |
|---|----------|---------------|
| 1 | `simulateTyping` — 1.5s yapay gecikme + read receipt | **1.5s sabit** |
| 2 | Ardışık DB çağrıları (getById + getConvById) | ~200ms |
| 3 | `whatsappNumbers.getByPhoneNumberId` duplicate (webhook + routing) | ~100ms |
| 4 | `customerProfiles.getByPhone` duplicate (identitySync + buildContext) | ~100ms |
| 5 | `conversations.getById` — gereksiz fazladan çağrı | ~100ms |
| 6 | Ardışık fetchGlobalSettings → fetchTenantContext | ~150ms |
| 7 | Ardışık listServices → listStaff → getBusinessInfo | ~300ms |
| 8 | LLM timeout 15s (çok yüksek) | risk |
| 9 | MAX_ITERATIONS = 5 (gereksiz) | risk |
| 10 | Ardışık response save → WhatsApp send | ~100ms |
| 11 | Ardışık mark done → debugInfo save | ~100ms |
| 12 | Gözlemlenebilirlik yok — profiling imkansız | ∞ |

**Toplam potansiyel kazanç**: ~2.5-3s (yapay gecikme + paralelleştirme + cache)

---

## Uygulama Fazları

### Faz 0 — Full Observability ✅

| # | Adım | Dosya | Durum |
|---|------|-------|-------|
| 1 | `PerfTimer` sınıfı — adım bazlı timing | `lib/perf-timer.ts` | ✅ |
| 2 | `LatencyTrackerSingleton` — sliding window istatistik | `lib/latency-tracker.ts` | ✅ |
| 3 | `AgentJob` tipine `webhookReceivedAt` + `isMasterNumber` | `packages/shared` | ✅ |
| 4 | `AgentDebugInfo` tipine `timingBreakdown` + `correlationId` | `llm.ts` | ✅ |
| 5 | Job handler'da PerfTimer entegrasyonu | `job-handler.ts` | ✅ |
| 6 | LLM loop'da timer entegrasyonu | `llm.ts` | ✅ |
| 7 | Health endpoint'e latency stats | `health.ts` | ✅ |
| 8 | Webhook'ta `webhookReceivedAt` kaydı | `webhook.ts` | ✅ |

### Faz 1 — Quick Wins ✅

| # | Adım | Dosya | Durum |
|---|------|-------|-------|
| 9 | `simulateTyping` tamamen kaldır (read receipt dahil) | `job-handler.ts` | ✅ |
| 10 | Status guard paralelleştir (getById + getConvById) | `job-handler.ts` | ✅ |
| 11 | Business data cache (TTL 120s) | `list-business-data.ts` | ✅ |
| 12 | `isMasterNumber` webhook'ta hesapla, routing'de reuse | `webhook.ts` + `routing.ts` | ✅ |
| 13 | `customerProfiles.getByPhone` duplicate kaldır | `job-handler.ts` + `llm.ts` | ✅ |
| 14 | Gereksiz `conversations.getById` refresh kaldır | `job-handler.ts` | ✅ |
| 15 | fetchGlobalSettings + fetchTenantContext paralel | `llm.ts` | ✅ |
| 16 | listServices + listStaff + getBusinessInfo paralel | `llm.ts` | ✅ |
| 17 | Response save + WhatsApp send paralel | `job-handler.ts` | ✅ |
| 18 | Mark done + debugInfo save paralel | `job-handler.ts` | ✅ |
| 19 | LLM timeout 15s → 8s | `openrouter-client.ts` | ✅ |
| 20 | MAX_ITERATIONS 5 → 3 | `llm.ts` | ✅ |
| 21 | `upsertPreferredTenant` fire-and-forget | `job-handler.ts` | ✅ |
| 22 | CorrelationId ile tüm log'lar | `job-handler.ts` | ✅ |

### Faz 2 — LLM Optimizasyonu ✅

| # | Adım | Açıklama | Durum |
|---|------|----------|-------|
| 23 | System prompt kısaltma | Token sayısını azaltarak TTFT düşür — kullanıcı manuel yapacak | ⏸️ Ertelendi |
| 24 | ~~Streaming response~~ | WhatsApp API tam mesaj gerektiriyor — streaming faydasız, iptal edildi | ❌ İptal |
| 25 | Prompt cache (OpenRouter) | `cache_control: { type: "ephemeral" }` system message üzerine eklendi. DeepSeek/Anthropic/Google destekler. Cache hit'te ~30-50% TTFT kazancı, ~75% token maliyet düşüşü | ✅ |
| 26 | Admin panel: Max iterations + LLM timeout | Tenant bazlı `ai_max_iterations` (1-10) ve `ai_llm_timeout_ms` (3-30s) slider | ✅ |

### Faz 3 — Altyapı (Gelecek)

| # | Adım | Açıklama |
|---|------|----------|
| 26 | Redis-based queue | InMemoryQueue → BullMQ/Redis |
| 27 | Connection pooling | Convex/Supabase bağlantı havuzu |

### Faz 4 — İleri Seviye (Gelecek)

| # | Adım | Açıklama |
|---|------|----------|
| 28 | Speculative context pre-build | Webhook alındığında context build başlat |
| 29 | Multi-region deployment | Kullanıcıya en yakın bölgede çalıştır |

---

## Optimizasyon Sonrası Beklenen Akış
```
Webhook → persist + webhookReceivedAt kaydı → enqueue (isMasterNumber dahil)
       → dequeue → [getById ‖ getConvById] (paralel)
       → routing (isMasterNumber reuse, Convex query yok)
       → identitySync (profile reuse + fire-and-forget upsert)
       → buildContext:
           [fetchGlobalSettings ‖ fetchTenantContext] (paralel)
           [listServices ‖ listStaff ‖ getBusinessInfo] (paralel, 120s cache)
           customerProfile → preloaded (duplicate query yok)
       → LLM call (8s timeout, max 3 iteration)
       → [response save ‖ WhatsApp send] (paralel)
       → [mark done ‖ debugInfo save] (paralel)
       → latencyTracker record
```

## Değişen Dosyalar

### Yeni Dosyalar
- `apps/worker/src/lib/perf-timer.ts` — PerfTimer + TimingBreakdown + buildCorrelationId
- `apps/worker/src/lib/latency-tracker.ts` — LatencyTrackerSingleton (sliding window p50/p90/p99)

### Değiştirilen Dosyalar
- `packages/shared/src/types/queue.ts` — AgentJob'a `isMasterNumber`, `webhookReceivedAt` eklendi
- `apps/worker/src/config.ts` — jobTimeout 30s→45s
- `apps/worker/src/agent/openrouter-client.ts` — REQUEST_TIMEOUT_MS 15s→8s
- `apps/worker/src/agent/llm.ts` — MAX_ITERATIONS 3, timer entegrasyonu, buildContext paralel, preloaded profile
- `apps/worker/src/agent/tools/list-business-data.ts` — TTL cache (120s)
- `apps/worker/src/agent/job-handler.ts` — Tam yeniden yapılandırma (simulateTyping kaldırma, paralelleştirme, PerfTimer, correlationId)
- `apps/worker/src/agent/routing.ts` — isMasterNumber reuse (fallback korundu)
- `apps/worker/src/routes/webhook.ts` — webhookReceivedAt + isMasterNumber enqueue
- `apps/worker/src/routes/health.ts` — latency stats eklendi

## Kullanıcı Kararları
- SLA: p90 < 3s
- simulateTyping: tamamen kaldır + görüldü bilgisi gönderme
- LLM timeout: 8s
- Profiling: full observability
- MAX_ITERATIONS: 3
