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
  timeQuestion: (
    serviceName: string,
    staffName: string,
    dateLabel: string,
    slots: string
  ) =>
    `Hizmet: ${serviceName}, Çalışan: ${staffName}, Tarih: ${dateLabel}.\n${dateLabel} için önerilen saatler:\n${slots}\n\nBu saatlerden biri sizin için uygun mu?`,
  timeParseFailed: "Saati anlayamadım. Örnek: 14:00 veya 15.30",
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
