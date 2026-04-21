export type ReferenceFieldType = "NUMBER" | "TEXT" | "TEXTAREA" | "DROPDOWN" | "CHECKBOX";
export type ReferenceFlag = "LOW" | "HIGH" | "NORMAL" | "ABNORMAL";
export type ReferenceContext = {
  sex?: string | null;
  age?: number | null;
};
export type DemographicRangeKey = "male" | "female" | "child";

export type ReferenceField = {
  fieldKey: string;
  fieldType: ReferenceFieldType;
  unit?: string | null;
  normalMin?: unknown;
  normalMax?: unknown;
  normalText?: string | null;
  referenceNote?: string | null;
};

type ParsedRange = { min: number; max: number; unit?: string | null };
type DemographicRangeMap = Partial<Record<DemographicRangeKey, ParsedRange>>;

const DEMOGRAPHIC_META_PREFIX = "[[DIAGSYNC_DEMO:";
const DEMOGRAPHIC_META_SUFFIX = "]]";

function parseRangeFromText(text: string): ParsedRange | null {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*[-–—]\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

function toParsedRange(value: unknown): ParsedRange | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { min?: unknown; max?: unknown };
  const min = typeof candidate.min === "number" ? candidate.min : Number(candidate.min);
  const max = typeof candidate.max === "number" ? candidate.max : Number(candidate.max);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}

export function splitReferenceNote(referenceNote?: string | null) {
  const note = referenceNote?.trim() ?? "";
  const start = note.indexOf(DEMOGRAPHIC_META_PREFIX);
  if (start < 0) return { plainText: note, demographicRanges: {} as DemographicRangeMap };

  const end = note.indexOf(DEMOGRAPHIC_META_SUFFIX, start + DEMOGRAPHIC_META_PREFIX.length);
  if (end < 0) return { plainText: note, demographicRanges: {} as DemographicRangeMap };

  const payload = note.slice(start + DEMOGRAPHIC_META_PREFIX.length, end);
  let demographicRanges: DemographicRangeMap = {};
  try {
    const parsed = JSON.parse(payload) as unknown;
    if (parsed && typeof parsed === "object") {
      const parsedObj = parsed as Record<string, unknown>;
      const male = toParsedRange(parsedObj.male);
      const female = toParsedRange(parsedObj.female);
      const child = toParsedRange(parsedObj.child);
      demographicRanges = {
        ...(male ? { male } : {}),
        ...(female ? { female } : {}),
        ...(child ? { child } : {}),
      };
    }
  } catch {
    demographicRanges = {};
  }

  const plainText = `${note.slice(0, start)}${note.slice(end + DEMOGRAPHIC_META_SUFFIX.length)}`.trim();
  return { plainText, demographicRanges };
}

export function buildReferenceNote(plainText: string, demographicRanges: DemographicRangeMap) {
  const cleanedText = plainText.trim();
  const hasRanges = Boolean(demographicRanges.male || demographicRanges.female || demographicRanges.child);
  if (!hasRanges) return cleanedText;

  const payload = JSON.stringify({
    ...(demographicRanges.male ? { male: demographicRanges.male } : {}),
    ...(demographicRanges.female ? { female: demographicRanges.female } : {}),
    ...(demographicRanges.child ? { child: demographicRanges.child } : {}),
  });
  return `${cleanedText}${cleanedText ? " " : ""}${DEMOGRAPHIC_META_PREFIX}${payload}${DEMOGRAPHIC_META_SUFFIX}`;
}

function parseDemographicRanges(field: ReferenceField) {
  const { plainText, demographicRanges } = splitReferenceNote(field.referenceNote);
  if (demographicRanges.male || demographicRanges.female || demographicRanges.child) {
    return {
      male: demographicRanges.male ?? null,
      female: demographicRanges.female ?? null,
      children: demographicRanges.child ?? null,
    };
  }

  if (!plainText) return null;
  const lower = plainText.toLowerCase();
  if (!lower.includes("male") && !lower.includes("female") && !lower.includes("child")) return null;

  const segments = plainText
    .split(/[;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const male = segments.find((s) => /\bmale\b/i.test(s));
  const female = segments.find((s) => /\bfemale\b/i.test(s));
  const children = segments.find((s) => /\b(children|child|paediatric|pediatric)\b/i.test(s));
  const parsed = {
    male: male ? parseRangeFromText(male) : null,
    female: female ? parseRangeFromText(female) : null,
    children: children ? parseRangeFromText(children) : null,
  };
  if (!parsed.male && !parsed.female && !parsed.children) return null;
  return parsed;
}

function chooseRangeForContext(field: ReferenceField, context?: ReferenceContext) {
  const parsed = parseDemographicRanges(field);
  if (!parsed) return null;

  const age = context?.age ?? null;
  if (age !== null && age < 18 && parsed.children) return { ...parsed.children, label: "Children" as const };

  const sex = `${context?.sex ?? ""}`.trim().toLowerCase();
  if (sex.startsWith("m") && parsed.male) return { ...parsed.male, label: "Male" as const };
  if (sex.startsWith("f") && parsed.female) return { ...parsed.female, label: "Female" as const };

  if (parsed.male) return { ...parsed.male, label: "Male" as const };
  if (parsed.female) return { ...parsed.female, label: "Female" as const };
  if (parsed.children) return { ...parsed.children, label: "Children" as const };
  return null;
}

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

export function evaluateReferenceFlag(field: ReferenceField, value: unknown, context?: ReferenceContext): ReferenceFlag | null {
  if (value === null || value === undefined || `${value}`.trim() === "") return null;

  if (field.fieldType === "NUMBER") {
    const numericValue = toNumber(value);
    const contextual = chooseRangeForContext(field, context);
    const min = contextual?.min ?? toDecimalCompatibleNumber(field.normalMin);
    const max = contextual?.max ?? toDecimalCompatibleNumber(field.normalMax);
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

export function formatReferenceDisplay(field: ReferenceField, context?: ReferenceContext) {
  const contextual = chooseRangeForContext(field, context);
  const min = contextual?.min ?? toDecimalCompatibleNumber(field.normalMin);
  const max = contextual?.max ?? toDecimalCompatibleNumber(field.normalMax);
  if (min !== null && max !== null) {
    const unit = field.unit?.trim() ? ` ${field.unit.trim()}` : "";
    const prefix = contextual?.label ? `Normal (${contextual.label})` : "Normal";
    return `${prefix}: ${min} - ${max}${unit}`;
  }
  if (field.normalText?.trim()) return `Normal: ${field.normalText.trim()}`;
  const { plainText } = splitReferenceNote(field.referenceNote);
  if (plainText) return `Reference: ${plainText}`;
  return "";
}
