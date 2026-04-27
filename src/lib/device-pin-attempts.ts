type AttemptRecord = {
  count: number;
  blockedUntil: number;
  lastAttemptAt: number;
};

const MAX_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 5 * 60 * 1000;
const STALE_AFTER_MS = 30 * 60 * 1000;
const attempts = new Map<string, AttemptRecord>();

function now() {
  return Date.now();
}

function cleanup(recordKey: string, record: AttemptRecord) {
  if (now() - record.lastAttemptAt > STALE_AFTER_MS) {
    attempts.delete(recordKey);
  }
}

export function pinAttemptKey(deviceKey: string, staffId: string) {
  return `${deviceKey}:${staffId}`;
}

export function getPinAttemptState(key: string) {
  const record = attempts.get(key);
  if (!record) return { blocked: false, secondsLeft: 0 };
  cleanup(key, record);
  const fresh = attempts.get(key);
  if (!fresh) return { blocked: false, secondsLeft: 0 };
  if (fresh.blockedUntil <= now()) return { blocked: false, secondsLeft: 0 };
  return {
    blocked: true,
    secondsLeft: Math.max(1, Math.ceil((fresh.blockedUntil - now()) / 1000)),
  };
}

export function recordPinFailure(key: string) {
  const existing = attempts.get(key);
  const nextCount = (existing?.count ?? 0) + 1;
  const next: AttemptRecord = {
    count: nextCount,
    blockedUntil: nextCount >= MAX_ATTEMPTS ? now() + BLOCK_DURATION_MS : 0,
    lastAttemptAt: now(),
  };
  attempts.set(key, next);
  return next;
}

export function resetPinFailures(key: string) {
  attempts.delete(key);
}
