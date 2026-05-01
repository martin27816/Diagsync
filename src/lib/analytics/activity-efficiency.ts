import { ensureValidTimestamps } from "@/lib/utils/timestamp-safety";

export type ActivityEfficiencyOrder = {
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
};

export type ActivityEfficiencyResult = {
  utilization: number;
  growth: number;
  activeDays: number;
  activityScore: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function computeActivityEfficiencyFromData(
  testOrders: ActivityEfficiencyOrder[],
  previousData: ActivityEfficiencyOrder[] = []
): ActivityEfficiencyResult {
  const assigned = testOrders.length;
  if (assigned === 0) {
    return { utilization: 0, growth: 0, activeDays: 0, activityScore: 0 };
  }

  const completedOrders = testOrders.filter((order) => {
    const safe = ensureValidTimestamps(order);
    return order.status === "COMPLETED" && Boolean(safe.completedAt);
  });

  const completed = completedOrders.length;
  const utilization = completed / assigned;

  const previousAssigned = previousData.length;
  const previousCompleted = previousData.filter((order) => {
    const safe = ensureValidTimestamps(order);
    return order.status === "COMPLETED" && Boolean(safe.completedAt);
  }).length;

  const currentRate = utilization;
  const previousRate = previousAssigned > 0 ? previousCompleted / previousAssigned : 0;
  const growth = previousRate === 0 ? 0 : (currentRate - previousRate) / previousRate;

  const activeDaySet = new Set<string>();
  for (const order of completedOrders) {
    const safe = ensureValidTimestamps(order);
    if (!safe.completedAt) continue;
    activeDaySet.add(toDayKey(safe.completedAt));
  }
  const activeDays = activeDaySet.size;

  const spanMs =
    testOrders.length > 1
      ? Math.max(...testOrders.map((o) => o.createdAt.getTime())) -
        Math.min(...testOrders.map((o) => o.createdAt.getTime()))
      : 0;
  const spanDays = Math.max(1, Math.ceil(spanMs / (24 * 60 * 60 * 1000)) + 1);
  const activeDayRatio = clamp(activeDays / spanDays, 0, 1);

  const growthNormalized = clamp((growth + 1) * 50, 0, 100);
  const activityScore = clamp(utilization * 60 + growthNormalized * 0.25 + activeDayRatio * 15, 0, 100);

  return {
    utilization,
    growth,
    activeDays,
    activityScore: Math.round(activityScore * 100) / 100,
  };
}
