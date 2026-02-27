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
  bookingSuccess: (
    serviceName: string,
    staffName: string,
    dateLabel: string,
    time: string,
    customerName?: string
  ) =>
    `${customerName ? `*${customerName}*, ` : ""}randevunuz oluşturuldu.\n` +
    `Hizmet: ${serviceName}\nÇalışan: ${staffName}\nTarih: ${dateLabel}\nSaat: ${time}`,
} as const;

export const SESSION_PROMPTS = {
  ended:
    "Oturum sonlandırıldı. Yeni bir mesaj gönderdiğinizde süreç baştan başlayacaktır.",
} as const;

export const OTP_PROMPTS = {
  codeReminder:
    "📝 Doğrulama kodunuzu bekliyoruz. Lütfen size gönderilen 6 haneli kodu bu sohbete yazın.",
} as const;

// NOTE: Agent system prompt now comes ONLY from dashboard (tenant.integration_keys.ai_system_prompt_text)
// or global_settings.ai_system_prompt_text. No hardcoded prompts here.
