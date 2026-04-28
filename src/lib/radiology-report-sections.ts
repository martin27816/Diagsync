export const RADIOLOGY_PER_TEST_KEY = "__perTestReports";

export type RadiologyPerTestSection = {
  testOrderId: string;
  findings: string;
  impression: string;
  notes?: string;
};

export function parseRadiologyPerTestSections(extraFields?: Record<string, string> | null) {
  const raw = extraFields?.[RADIOLOGY_PER_TEST_KEY];
  if (!raw) return [] as RadiologyPerTestSection[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [] as RadiologyPerTestSection[];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const item = row as Record<string, unknown>;
        return {
          testOrderId: String(item.testOrderId ?? "").trim(),
          findings: String(item.findings ?? ""),
          impression: String(item.impression ?? ""),
          notes: String(item.notes ?? ""),
        };
      })
      .filter((row) => row.testOrderId.length > 0);
  } catch {
    return [] as RadiologyPerTestSection[];
  }
}

export function stringifyRadiologyPerTestSections(sections: RadiologyPerTestSection[]) {
  return JSON.stringify(
    sections.map((row) => ({
      testOrderId: row.testOrderId,
      findings: row.findings ?? "",
      impression: row.impression ?? "",
      notes: row.notes ?? "",
    }))
  );
}

export function mergeRadiologyPerTestSections(
  extraFields: Record<string, string> | undefined,
  sections: RadiologyPerTestSection[]
) {
  return {
    ...(extraFields ?? {}),
    [RADIOLOGY_PER_TEST_KEY]: stringifyRadiologyPerTestSections(sections),
  };
}

