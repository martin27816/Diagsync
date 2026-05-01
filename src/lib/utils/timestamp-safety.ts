export type TimestampSafetyInput = {
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  status: string;
};

export type TimestampSafetyResult = {
  startedAt: Date;
  completedAt: Date | null;
};

const ONE_MINUTE_MS = 60 * 1000;

export function ensureValidTimestamps(testOrder: TimestampSafetyInput): TimestampSafetyResult {
  const startedAt = testOrder.startedAt ?? testOrder.createdAt;

  let completedAt = testOrder.completedAt;
  if (!completedAt && testOrder.status === "COMPLETED") {
    completedAt = new Date();
  }

  if (completedAt && completedAt.getTime() < startedAt.getTime()) {
    completedAt = new Date(startedAt.getTime() + ONE_MINUTE_MS);
  }

  return { startedAt, completedAt };
}
