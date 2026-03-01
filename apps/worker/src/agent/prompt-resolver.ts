/**
 * Prompt resolution: placeholder replacement and date/time helpers.
 *
 * Supports both {{placeholder}} and {placeholder} formats.
 */

/**
 * Get current date, day name and time in Istanbul timezone.
 */
export function getCurrentDateInfo(): { date: string; dayName: string; time: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const weekday = parts.find((p) => p.type === "weekday")?.value;

  const timeFormatter = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const time = timeFormatter.format(now);

  return {
    date: `${year}-${month}-${day}`,
    dayName: weekday || "Bilinmiyor",
    time,
  };
}

/**
 * Resolve placeholders in system prompt.
 * Supports both {{placeholder}} and {placeholder} formats.
 */
export function resolvePlaceholders(
  prompt: string,
  placeholders: Record<string, string>
): string {
  let resolved = prompt;
  for (const [key, value] of Object.entries(placeholders)) {
    const doubleBrace = `{{${key}}}`;
    const singleBrace = `{${key}}`;
    resolved = resolved.replaceAll(doubleBrace, value);
    resolved = resolved.replaceAll(singleBrace, value);
  }
  return resolved;
}
