type InsightRule = {
  keywords: string[];
  check: (value: number) => boolean;
  message: string;
};

const RULES: InsightRule[] = [
  {
    keywords: ["hemoglobin", "hb"],
    check: (value) => value < 10,
    message: "Low hemoglobin detected (possible anemia).",
  },
  {
    keywords: ["glucose", "sugar"],
    check: (value) => value > 110,
    message: "Elevated glucose level detected.",
  },
  {
    keywords: ["wbc", "white blood", "white_cell"],
    check: (value) => value > 11,
    message: "Possible infection indication (WBC appears elevated).",
  },
];

function toNumeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeKey(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "_");
}

export function buildResultInsights(resultData: Record<string, unknown>) {
  const messages = new Set<string>();
  const entries = Object.entries(resultData);

  for (const [rawKey, rawValue] of entries) {
    const key = normalizeKey(rawKey);
    const numeric = toNumeric(rawValue);
    if (numeric === null) continue;

    for (const rule of RULES) {
      if (!rule.keywords.some((keyword) => key.includes(normalizeKey(keyword)))) continue;
      if (rule.check(numeric)) {
        messages.add(rule.message);
      }
    }
  }

  if (messages.size === 0) {
    messages.add("No abnormal result triggers were detected by system rules.");
  }

  return Array.from(messages);
}

