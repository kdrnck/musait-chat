export const STANDARD_PROMPT_PLACEHOLDER_KEYS = [
  "current_date",
  "current_day_name",
  "current_time",
  "tenant_name",
  "tenant_id",
  "business_name",
  "business_info",
  "services_list",
  "staff_list",
  "customer_first_name",
  "customer_name",
  "customer_profile",
] as const;

export const TEST_LAB_EXTRA_PLACEHOLDER_KEYS = ["test_phone"] as const;

export type StandardPromptPlaceholderKey =
  (typeof STANDARD_PROMPT_PLACEHOLDER_KEYS)[number];
export type TestLabPlaceholderKey =
  (typeof TEST_LAB_EXTRA_PLACEHOLDER_KEYS)[number];

export type PromptPlaceholderKey =
  | StandardPromptPlaceholderKey
  | TestLabPlaceholderKey;

export interface CurrentDateInfo {
  date: string;
  dayName: string;
  time: string;
}

export function getCurrentDateInfo(): CurrentDateInfo {
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

  return {
    date: `${year}-${month}-${day}`,
    dayName: weekday || "Bilinmiyor",
    time: timeFormatter.format(now),
  };
}

export function resolvePlaceholders(
  prompt: string,
  placeholders: Record<string, string>
): string {
  let resolved = prompt;
  for (const [key, value] of Object.entries(placeholders)) {
    resolved = resolved.replaceAll(`{{${key}}}`, value);
  }
  return resolved;
}

export function findUnresolvedPlaceholders(prompt: string): string[] {
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    matches.add(match[1]);
  }
  return Array.from(matches).sort();
}
