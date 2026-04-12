export type PatientHistoryRow = {
  testName: string;
  recordedAt: string;
  resultData?: Record<string, unknown> | null;
};

type AnalyzeInput = {
  visitCount: number;
  currentTestNames: string[];
  history: PatientHistoryRow[];
  now?: Date;
};

function getMonthStamp(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMetric(result: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!result) return null;
  for (const [rawKey, rawValue] of Object.entries(result)) {
    const key = rawKey.toLowerCase();
    if (keys.some((item) => key.includes(item))) {
      const numeric = toNumber(rawValue);
      if (numeric !== null) return numeric;
    }
  }
  return null;
}

function trendText(label: string, values: number[]) {
  if (values.length < 2) return null;
  const first = values[0];
  const last = values[values.length - 1];
  if (last < first) return `${label} trending downward.`;
  if (last > first) return `${label} trending upward.`;
  return null;
}

export function analyzePatientInsights(input: AnalyzeInput) {
  const now = input.now ?? new Date();
  const monthStamp = getMonthStamp(now);
  const notes = new Set<string>();

  if (input.visitCount <= 1) {
    notes.add("First visit.");
  }

  for (const testName of input.currentTestNames) {
    const matches = input.history.filter((row) => row.testName === testName);
    const monthly = matches.filter((row) => getMonthStamp(new Date(row.recordedAt)) === monthStamp);
    if (monthly.length >= 3) {
      notes.add(`Frequent ${testName} testing (${monthly.length} times this month).`);
    } else if (matches.length > 1) {
      notes.add(`Repeated ${testName} testing (${matches.length} total records).`);
    }
  }

  const hemoValues = input.history
    .map((row) => extractMetric(row.resultData, ["hemoglobin", "hb"]))
    .filter((value): value is number => value !== null);
  const glucoseValues = input.history
    .map((row) => extractMetric(row.resultData, ["glucose", "sugar"]))
    .filter((value): value is number => value !== null);
  const wbcValues = input.history
    .map((row) => extractMetric(row.resultData, ["wbc", "white"]))
    .filter((value): value is number => value !== null);

  const trends = [
    trendText("Hemoglobin", hemoValues),
    trendText("Glucose", glucoseValues),
    trendText("WBC", wbcValues),
  ].filter((row): row is string => Boolean(row));
  for (const trend of trends) notes.add(trend);

  if (notes.size === 0) {
    notes.add("No abnormal results recorded.");
  }

  return Array.from(notes);
}

