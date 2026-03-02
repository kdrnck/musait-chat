/**
 * Interactive Message Parser
 *
 * Extracts <<BUTTONS>> and <<LIST>> blocks from LLM responses
 * and converts them into WhatsApp API-compatible payloads.
 *
 * The LLM is instructed to output structured blocks like:
 *
 *   <<BUTTONS>>
 *   {"body": "...", "buttons": [{"id": "...", "title": "..."}]}
 *   <</BUTTONS>>
 *
 *   <<LIST>>
 *   {"body": "...", "button": "...", "sections": [...]}
 *   <</LIST>>
 *
 * This parser extracts those blocks and returns structured data
 * for the job-handler to route to the correct WhatsApp API call.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ParsedButtonMessage {
  type: "buttons";
  body: string;
  buttons: Array<{ id: string; title: string }>;
}

export interface ParsedListMessage {
  type: "list";
  body: string;
  button: string;
  sections: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface ParsedPlainMessage {
  type: "text";
  body: string;
}

export type ParsedMessage = ParsedButtonMessage | ParsedListMessage | ParsedPlainMessage;

// ── Regex patterns ─────────────────────────────────────────────────────────────

const BUTTONS_REGEX = /<<BUTTONS>>\s*([\s\S]*?)\s*<<\/BUTTONS>>/i;
const LIST_REGEX = /<<LIST>>\s*([\s\S]*?)\s*<<\/LIST>>/i;

// ── Main parser ────────────────────────────────────────────────────────────────

/**
 * Parse an LLM response for interactive message blocks.
 *
 * Returns the first valid interactive block found, or falls back to plain text.
 * Only ONE interactive block per message is supported (WhatsApp limitation).
 */
export function parseInteractiveResponse(response: string): ParsedMessage {
  // Try buttons first (more common for confirmations)
  const buttonsMatch = response.match(BUTTONS_REGEX);
  if (buttonsMatch) {
    const parsed = tryParseButtonsJson(buttonsMatch[1]);
    if (parsed) return parsed;
  }

  // Try list
  const listMatch = response.match(LIST_REGEX);
  if (listMatch) {
    const parsed = tryParseListJson(listMatch[1]);
    if (parsed) return parsed;
  }

  // Plain text fallback
  return { type: "text", body: response };
}

/**
 * Check if a response contains any interactive blocks.
 * Useful for quick checks without full parsing.
 */
export function hasInteractiveBlock(response: string): boolean {
  return BUTTONS_REGEX.test(response) || LIST_REGEX.test(response);
}

/**
 * Extract the plain text portion of a response, stripping interactive blocks.
 * Used for storing a clean version in the message content.
 */
export function stripInteractiveBlocks(response: string): string {
  return response
    .replace(BUTTONS_REGEX, "")
    .replace(LIST_REGEX, "")
    .trim();
}

// ── JSON parsers with validation ───────────────────────────────────────────────

function tryParseButtonsJson(raw: string): ParsedButtonMessage | null {
  try {
    const data = JSON.parse(raw.trim());

    // Validate required fields
    if (!data.body || typeof data.body !== "string") return null;
    if (!Array.isArray(data.buttons) || data.buttons.length === 0) return null;
    if (data.buttons.length > 3) {
      console.warn(`⚠️ Interactive parser: ${data.buttons.length} buttons exceeds WhatsApp limit of 3, truncating`);
      data.buttons = data.buttons.slice(0, 3);
    }

    // Validate and sanitize each button
    const buttons = data.buttons
      .filter((b: any) => b && typeof b.id === "string" && typeof b.title === "string")
      .map((b: any) => ({
        id: b.id.slice(0, 256),
        title: b.title.slice(0, 20),
      }));

    if (buttons.length === 0) return null;

    return {
      type: "buttons",
      body: data.body.slice(0, 1024),
      buttons,
    };
  } catch (err) {
    console.warn("⚠️ Interactive parser: Failed to parse BUTTONS JSON:", err);
    return null;
  }
}

function tryParseListJson(raw: string): ParsedListMessage | null {
  try {
    const data = JSON.parse(raw.trim());

    // Validate required fields
    if (!data.body || typeof data.body !== "string") return null;
    if (!data.button || typeof data.button !== "string") return null;
    if (!Array.isArray(data.sections) || data.sections.length === 0) return null;

    // Validate and sanitize sections
    const sections = data.sections
      .filter((s: any) => s && typeof s.title === "string" && Array.isArray(s.rows))
      .slice(0, 10) // Max 10 sections
      .map((s: any) => ({
        title: s.title.slice(0, 24),
        rows: s.rows
          .filter((r: any) => r && typeof r.id === "string" && typeof r.title === "string")
          .slice(0, 10) // Max 10 rows per section
          .map((r: any) => ({
            id: r.id.slice(0, 200),
            title: r.title.slice(0, 24),
            ...(r.description ? { description: String(r.description).slice(0, 72) } : {}),
          })),
      }))
      .filter((s: any) => s.rows.length > 0); // Remove empty sections

    if (sections.length === 0) return null;

    return {
      type: "list",
      body: data.body.slice(0, 1024),
      button: data.button.slice(0, 20),
      sections,
    };
  } catch (err) {
    console.warn("⚠️ Interactive parser: Failed to parse LIST JSON:", err);
    return null;
  }
}

// ── Content for storage ────────────────────────────────────────────────────────

/**
 * Generate a storage-friendly version of the message content.
 * For interactive messages, we store a JSON-enriched version so the chat UI
 * can render them properly.
 */
export function buildStorageContent(parsed: ParsedMessage): string {
  if (parsed.type === "text") {
    return parsed.body;
  }

  // Store as JSON with a type marker so chat UI can detect and render
  return JSON.stringify({
    _interactive: true,
    ...parsed,
  });
}
