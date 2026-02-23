export interface SystemPromptContext {
  tenantId: string | null;
}

export const ROUTING_PROMPTS = {
  welcomeMessage:
    "Merhaba, lütfen randevu almak istediğiniz işletmeyi söyler misiniz? Mevcut işletme listesini görmek için bu bağlantıya tıkla: https://musait.app/isletme-listesi",
  noActiveTenantMessage: "Şu anda aktif işletme bulunmamaktadır.",
  tenantRetryMessage:
    "İşletmeyi anlayamadım. Lütfen işletme adını tekrar yazın veya listeyi inceleyin: https://musait.app/isletme-listesi",
  noServiceMessage: "Şu an listelenecek hizmet bulunmuyor.",
  tenantSelectedMessage: (tenantName: string, servicesList: string) =>
    `${tenantName} işletmesi için randevu oluşturuyorsunuz. Lütfen aşağıdan hizmet seçin:\n${servicesList}`,
} as const;

export const LLM_PROMPTS = {
  tenantSelectorSystem:
    "Kullanıcının mesajına göre en uygun işletmeyi seç. Sadece JSON döndür: {\"tenantId\":\"...\"} veya eşleşme yoksa {\"tenantId\":null}.",
  tenantSelectorUser: (tenantList: string, userMessage: string) =>
    `İşletme listesi:\n${tenantList}\n\nKullanıcı mesajı: ${userMessage}`,
} as const;

export const BOOKING_FLOW_PROMPTS = {
  serviceQuestion: (servicesList: string) =>
    `Hangi hizmet için randevu oluşturmak istiyorsunuz?\n${servicesList}`,
  staffQuestion: (serviceName: string, staffList: string) =>
    `${serviceName} için lütfen bir çalışan seçin:\n${staffList}`,
  dateQuestion: (serviceName: string, staffName: string) =>
    `Hizmet: ${serviceName}, Çalışan: ${staffName}. Hangi güne randevu almak istersiniz?`,
  dateParseFailed:
    "Tarihi anlayamadım. Örnek: yarın, bu cuma, 24 Şubat, 25.02.2026",
  noSlotsForDate: (dateLabel: string) =>
    `${dateLabel} için müsait saat bulunamadı. Lütfen başka bir gün yazın.`,
  timeQuestion: (serviceName: string, staffName: string, dateLabel: string, slots: string) =>
    `Hizmet: ${serviceName}, Çalışan: ${staffName}, Tarih: ${dateLabel}.\n${dateLabel} için önerilen saatler:\n${slots}\n\nBu saatlerden biri sizin için uygun mu?`,
  timeParseFailed:
    "Saati anlayamadım. Örnek: 14:00 veya 15.30",
  timeUnavailable:
    "Bu saat maalesef dolu görünüyor. Lütfen aşağıdaki müsait saatlerden birini seçin.",
  bookingSuccess: (serviceName: string, staffName: string, dateLabel: string, time: string) =>
    `Randevunuz oluşturuldu.\nHizmet: ${serviceName}\nÇalışan: ${staffName}\nTarih: ${dateLabel}\nSaat: ${time}`,
} as const;

export const SESSION_PROMPTS = {
  ended:
    "Oturum sonlandırıldı. Yeni bir mesaj gönderdiğinizde süreç baştan başlayacaktır.",
} as const;

export const OTP_PROMPTS = {
  codeReminder:
    "📝 Doğrulama kodunuzu bekliyoruz. Lütfen size gönderilen 6 haneli kodu bu sohbete yazın.",
} as const;

export function buildAgentSystemPrompt(
  context: SystemPromptContext
): string {
  return `Sen Musait asistanısın. Müşterilere randevu alma, iptal etme ve bilgi verme konularında yardımcı oluyorsun.

## Kurallar
- Her zaman Türkçe konuş.
- Kibar, profesyonel ve yardımsever ol.
- Kısa ve öz cevaplar ver.
- Müşterinin ihtiyacını anla ve doğru aracı (tool) kullan.
- Randevu oluştururken MUTLAKA müşteriden onay al.
- Onay almadan asla randevu oluşturma.
- Kalın metin oluşturmak için *metin* kullan. iki adet yıldız (*) kullanma. Bir adet yıldız (*) kullan.

## Randevu Onay Akışı
1. Müşteri randevu istediğinde, önce uygun slotları göster (view_available_slots).
2. Müşteri bir slot seçtiğinde, detayları tekrarla ve onay iste:
   "X tarihinde saat Y'de Z hizmeti için randevu oluşturuyorum, onaylıyor musunuz?"
3. Müşteri "evet", "onaylıyorum" gibi olumlu yanıt verirse → create_appointment kullan.
4. Müşteri "hayır" derse → alternatif öner veya iptal et.

## İptal Akışı
1. Müşteri randevu iptal etmek istediğinde, randevu detaylarını doğrula.
2. İptal sebebini sor.
3. Onay al → cancel_appointment kullan.

## İnsan Desteği
- Yanıt veremediğin veya karmaşık durumlar için ask_human aracını kullan.
- Müşteriye "Sizi bir yetkiliye bağlıyorum" de.

## Oturum Sonlandırma
- Müşteri "teşekkürler", "başka bir şey yok" gibi ifadeler kullanırsa → end_session kullan.
- Oturum sonlandırırken nazik bir kapanış mesajı ver.

${context.tenantId ? `Aktif İşletme ID: ${context.tenantId}` : "İşletme henüz belirlenmedi."}`;
}
