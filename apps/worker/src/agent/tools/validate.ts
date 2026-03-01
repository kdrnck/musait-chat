/**
 * Lightweight tool argument validation utilities.
 * These provide clear error messages back to the LLM when arguments are malformed.
 */

interface ValidationResult {
  valid: true;
  data: Record<string, unknown>;
} | {
  valid: false;
  error: string;
}

interface FieldSpec {
  name: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  /** Regex pattern the string value must match */
  pattern?: RegExp;
  patternHint?: string;
}

/**
 * Validate tool arguments against a field specification.
 * Returns the validated data with proper types, or an error message for the LLM.
 */
export function validateToolArgs(
  args: Record<string, unknown>,
  fields: FieldSpec[]
): ValidationResult {
  const errors: string[] = [];
  const data: Record<string, unknown> = { ...args };

  for (const field of fields) {
    const value = args[field.name];

    if (field.required && (value === undefined || value === null || value === "")) {
      errors.push(`'${field.name}' zorunludur`);
      continue;
    }

    if (value === undefined || value === null) continue;

    if (field.type === "string") {
      if (typeof value !== "string") {
        data[field.name] = String(value);
      }
      if (field.pattern && !field.pattern.test(String(value))) {
        errors.push(`'${field.name}' geçersiz format${field.patternHint ? ` (${field.patternHint})` : ""}`);
      }
    } else if (field.type === "number") {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push(`'${field.name}' geçerli bir sayı olmalıdır`);
      } else {
        data[field.name] = num;
      }
    } else if (field.type === "boolean") {
      if (typeof value === "string") {
        data[field.name] = value.toLowerCase() === "true";
      } else if (typeof value !== "boolean") {
        errors.push(`'${field.name}' boolean olmalıdır`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: `Argüman hatası: ${errors.join(", ")}` };
  }

  return { valid: true, data };
}

// Pre-defined schemas for critical tools

export const CREATE_APPOINTMENT_FIELDS: FieldSpec[] = [
  { name: "service_id", type: "string", required: true },
  { name: "staff_id", type: "string", required: true },
  {
    name: "start_time", type: "string", required: true,
    pattern: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    patternHint: "ISO 8601: YYYY-MM-DDTHH:MM",
  },
  { name: "customer_name", type: "string" },
];

export const VIEW_SLOTS_FIELDS: FieldSpec[] = [
  {
    name: "date", type: "string", required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
    patternHint: "YYYY-MM-DD",
  },
  { name: "service_id", type: "string" },
  { name: "staff_id", type: "string" },
];

export const BIND_TENANT_FIELDS: FieldSpec[] = [
  { name: "tenant_id", type: "string", required: true },
];
