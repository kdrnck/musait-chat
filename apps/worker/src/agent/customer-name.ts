const BLOCKED_NAME_WORDS = new Set([
  "bilinmeyen",
  "unknown",
  "musteri",
  "müşteri",
  "randevu",
  "iptal",
  "saat",
  "yarin",
  "yarın",
  "bugun",
  "bugün",
  "evet",
  "hayir",
  "hayır",
  "tamam",
  "selam",
  "merhaba",
]);

export function normalizeName(name: string): string {
  return name
    .replace(/[^\p{L}\s'’-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function capitalizeName(name: string): string {
  return normalizeName(name)
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("tr-TR") + part.slice(1))
    .join(" ");
}

export function isLikelyRealName(rawName?: string | null): boolean {
  if (!rawName) return false;
  const normalized = normalizeName(rawName);
  if (!normalized) return false;

  if (normalized.length < 2 || normalized.length > 50) return false;
  if (/\d/.test(normalized)) return false;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0 || tokens.length > 4) return false;

  const hasVowel = /[aeıioöuü]/i.test(normalized);
  if (!hasVowel) return false;

  for (const token of tokens) {
    if (token.length < 2) return false;
    const lower = token.toLocaleLowerCase("tr-TR");
    if (BLOCKED_NAME_WORDS.has(lower)) return false;
  }

  return true;
}

export function extractNameUpdateIntent(message: string): string | null {
  const text = message.trim();
  const lower = text.toLocaleLowerCase("tr-TR");

  // "adım x değil y"
  const correctionMatch = lower.match(
    /(?:ad[ıi]m|ismim|benim ad[ıi]m)\s+.+?\s+de(?:ğ|g)il[, ]+\s*([^\n.,!?]+)$/i
  );
  if (correctionMatch?.[1]) {
    const candidate = capitalizeName(correctionMatch[1]);
    return isLikelyRealName(candidate) ? candidate : null;
  }

  // "adım y", "ismim y", "benim adım y"
  const simpleMatch = lower.match(
    /(?:benim ad[ıi]m|ad[ıi]m|ismim)\s*[:\-]?\s*([^\n.,!?]{2,40})$/i
  );
  if (simpleMatch?.[1]) {
    const candidate = capitalizeName(simpleMatch[1]);
    return isLikelyRealName(candidate) ? candidate : null;
  }

  return null;
}

export function extractPossibleName(message: string): string | null {
  const trimmed = message.trim();

  // Try explicit patterns first.
  const explicit = extractNameUpdateIntent(trimmed);
  if (explicit) return explicit;

  // If user sends only a short phrase, treat it as a possible name candidate.
  const fallback = capitalizeName(trimmed);
  if (isLikelyRealName(fallback)) return fallback;

  return null;
}
