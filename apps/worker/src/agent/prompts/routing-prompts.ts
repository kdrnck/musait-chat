export const LLM_PROMPTS = {
  tenantSelectorSystem:
    "Kullanıcının mesajına göre en uygun işletmeyi seç. Sadece JSON döndür: {\"tenantId\":\"...\"} veya eşleşme yoksa {\"tenantId\":null}.",
  tenantSelectorUser: (tenantList: string, userMessage: string) =>
    `İşletme listesi:\n${tenantList}\n\nKullanıcı mesajı: ${userMessage}`,
} as const;
