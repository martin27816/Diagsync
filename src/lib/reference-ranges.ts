export type ReferenceFieldType = "NUMBER" | "TEXT" | "TEXTAREA" | "DROPDOWN" | "CHECKBOX";
export type ReferenceFlag = "LOW" | "HIGH" | "NORMAL" | "ABNORMAL";

export type ReferenceField = {
  fieldKey: string;
  fieldType: ReferenceFieldType;
  unit?: string | null;
  normalMin?: unknown;
  normalMax?: unknown;
  normalText?: string | null;
  referenceNote?: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDecimalCompatibleNumber(value: unknown): number | null {
  const direct = toNumber(value);
  if (direct !== null) return direct;
  if (value && typeof value === "object" && typeof (value as { toString?: () => string }).toString === "function") {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeText(value: unknown) {
  return `${value ?? ""}`.trim().toLowerCase();
}

export function evaluateReferenceFlag(field: ReferenceField, value: unknown): ReferenceFlag | null {
  if (value === null || value === undefined || `${value}`.trim() === "") return null;

  if (field.fieldType === "NUMBER") {
    const numericValue = toNumber(value);
    const min = toDecimalCompatibleNumber(field.normalMin);
    const max = toDecimalCompatibleNumber(field.normalMax);
    if (numericValue === null || min === null || max === null) return null;
    if (numericValue < min) return "LOW";
    if (numericValue > max) return "HIGH";
    return "NORMAL";
  }

  if (field.fieldType === "DROPDOWN" || field.fieldType === "TEXT" || field.fieldType === "TEXTAREA") {
    if (!field.normalText?.trim()) return null;
    return normalizeText(value) === normalizeText(field.normalText) ? "NORMAL" : "ABNORMAL";
  }

  return null;
}

export function computeAbnormalFlags(fields: ReferenceField[], resultData: Record<string, unknown>) {
  const flags: Record<string, ReferenceFlag> = {};
  for (const field of fields) {
    const flag = evaluateReferenceFlag(field, resultData[field.fieldKey]);
    if (flag) flags[field.fieldKey] = flag;
  }
  return flags;
}

export function formatReferenceDisplay(field: ReferenceField) {
  const min = toDecimalCompatibleNumber(field.normalMin);
  const max = toDecimalCompatibleNumber(field.normalMax);
  if (min !== null && max !== null) {
    const unit = field.unit?.trim() ? ` ${field.unit.trim()}` : "";
    return `Normal: ${min} - ${max}${unit}`;
  }
  if (field.normalText?.trim()) {
    return `Normal: ${field.normalText.trim()}`;
  }
  if (field.referenceNote?.trim()) {
    return `Reference: ${field.referenceNote.trim()}`;
  }
  return "";
}
