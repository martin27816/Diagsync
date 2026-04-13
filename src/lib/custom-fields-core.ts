export const CUSTOM_FIELD_KEY_MAX_LENGTH = 80;
export const CUSTOM_FIELD_VALUE_MAX_LENGTH = 10000;
export const CUSTOM_FIELD_MAX_COUNT = 40;
const SIGNATURE_IMAGE_MAX_LENGTH = 400000;

export function toCustomFieldKey(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

export function validateCustomFieldsMap(input: unknown): ValidationResult<Record<string, string>> {
  if (input === undefined || input === null) return { ok: true, value: {} };
  if (!isPlainObject(input)) return { ok: false, error: "Custom fields must be an object" };

  const entries = Object.entries(input);
  if (entries.length > CUSTOM_FIELD_MAX_COUNT) {
    return { ok: false, error: `Custom fields cannot exceed ${CUSTOM_FIELD_MAX_COUNT} entries` };
  }

  const used = new Set<string>();
  const normalized: Record<string, string> = {};
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim().toLowerCase();
    if (!key) return { ok: false, error: "Custom field name cannot be empty" };
    if (key.length > CUSTOM_FIELD_KEY_MAX_LENGTH) {
      return { ok: false, error: `Custom field name '${rawKey}' is too long` };
    }
    if (!/^[a-z0-9_]+$/.test(key)) {
      return { ok: false, error: `Custom field name '${rawKey}' has invalid characters` };
    }
    if (used.has(key)) return { ok: false, error: `Duplicate custom field '${rawKey}'` };
    used.add(key);

    const value = rawValue === null || rawValue === undefined ? "" : String(rawValue);
    if (value.length > CUSTOM_FIELD_VALUE_MAX_LENGTH) {
      return { ok: false, error: `Custom field '${rawKey}' value is too long` };
    }
    normalized[key] = value;
  }

  return { ok: true, value: normalized };
}

export function validateResultDataPayload(input: unknown): ValidationResult<Record<string, unknown>> {
  if (!isPlainObject(input)) return { ok: false, error: "resultData must be an object" };

  const entries = Object.entries(input);
  if (entries.length > 200) return { ok: false, error: "Too many result fields" };

  const used = new Set<string>();
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (!key) return { ok: false, error: "Result field name cannot be empty" };
    if (key.length > CUSTOM_FIELD_KEY_MAX_LENGTH) return { ok: false, error: `Result field '${rawKey}' is too long` };
    if (used.has(key.toLowerCase())) return { ok: false, error: `Duplicate result field '${rawKey}'` };
    used.add(key.toLowerCase());

    const scalar =
      rawValue === null ||
      typeof rawValue === "string" ||
      typeof rawValue === "number" ||
      typeof rawValue === "boolean";
    if (!scalar) return { ok: false, error: `Result field '${rawKey}' must be a scalar value` };
    if (typeof rawValue === "string" && key === "__signature_image" && rawValue.length > SIGNATURE_IMAGE_MAX_LENGTH) {
      return { ok: false, error: "Signature image is too large" };
    }
    if (typeof rawValue === "string" && key !== "__signature_image" && rawValue.length > CUSTOM_FIELD_VALUE_MAX_LENGTH) {
      return { ok: false, error: `Result field '${rawKey}' value is too long` };
    }
  }

  return { ok: true, value: input };
}
