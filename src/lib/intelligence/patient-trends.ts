import { prisma } from "@/lib/prisma";

type TrendDirection = "RISING" | "FALLING" | "STABLE";

type TrendItem = {
  testName: string;
  values: number[];
  trend: TrendDirection;
  message: string;
};

function collectNumbers(value: unknown): number[] {
  if (typeof value === "number" && Number.isFinite(value)) return [value];
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return [parsed];
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectNumbers(item));
  }
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((item) => collectNumbers(item));
  }
  return [];
}

function detectTrend(values: number[]): TrendDirection {
  if (values.length < 2) return "STABLE";
  const diffs = values.slice(1).map((curr, idx) => curr - values[idx]);
  const rising = diffs.every((d) => d > 0);
  const falling = diffs.every((d) => d < 0);
  if (rising) return "RISING";
  if (falling) return "FALLING";
  return "STABLE";
}

function buildTrendMessage(testName: string, trend: TrendDirection, pointCount: number) {
  if (trend === "RISING") return `${testName} rising over last ${pointCount} result entries`;
  if (trend === "FALLING") return `${testName} falling over last ${pointCount} result entries`;
  return `${testName} stable across last ${pointCount} result entries`;
}

export async function getPatientTrends(patientId: string): Promise<TrendItem[]> {
  const results = await prisma.labResult.findMany({
    where: {
      testOrder: {
        visit: {
          patientId,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      resultData: true,
      testOrder: {
        select: {
          test: { select: { name: true } },
        },
      },
    },
  });

  const grouped = new Map<string, Array<{ createdAt: Date; value: number }>>();
  for (const row of results) {
    const testName = row.testOrder.test.name;
    const numericValues = collectNumbers(row.resultData);
    if (numericValues.length === 0) continue;
    const firstNumeric = numericValues[0];
    const bucket = grouped.get(testName) ?? [];
    bucket.push({ createdAt: row.createdAt, value: firstNumeric });
    grouped.set(testName, bucket);
  }

  const trends: TrendItem[] = [];
  for (const [testName, rows] of Array.from(grouped.entries())) {
    const latestFive = rows
      .sort((a: { createdAt: Date }, b: { createdAt: Date }) => a.createdAt.getTime() - b.createdAt.getTime())
      .slice(-5);
    const values = latestFive.map((r: { value: number }) => r.value);
    if (values.length === 0) continue;
    const trend = detectTrend(values);
    trends.push({
      testName,
      values,
      trend,
      message: buildTrendMessage(testName, trend, values.length),
    });
  }

  return trends.sort((a, b) => a.testName.localeCompare(b.testName));
}
