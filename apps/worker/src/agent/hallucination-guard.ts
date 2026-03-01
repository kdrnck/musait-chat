/**
 * Hallucination detection for booking success claims.
 *
 * Detects if the LLM response claims a booking was successfully created.
 * If this returns true but create_appointment was never called, the LLM is hallucinating.
 */
export function detectBookingSuccessHallucination(content: string): boolean {
  const normalized = content.toLocaleLowerCase("tr-TR");

  // Turkish patterns
  const turkishPatterns = [
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?oluşturuldu/,
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?alındı/,
    /randevu(?:nuz)?\s+(?:başarıyla\s+)?kaydedildi/,
    /randevu(?:nuz)?\s+onaylanmıştır/,
    /randevu(?:nuz)?\s+tamamlandı/,
    /başarıyla\s+oluşturuldu/,
    /randevu\s+bilgileriniz/,
  ];

  // English patterns (in case model responds in English)
  const englishPatterns = [
    /appointment\s+(?:has\s+been\s+)?(?:successfully\s+)?(?:created|booked|confirmed|scheduled)/i,
    /(?:successfully\s+)?(?:created|booked|confirmed|scheduled)\s+(?:your\s+)?appointment/i,
    /booking\s+(?:is\s+)?confirmed/i,
  ];

  const allPatterns = [...turkishPatterns, ...englishPatterns];
  return allPatterns.some((pattern) => pattern.test(normalized));
}
