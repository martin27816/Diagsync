export type SignaturePreset = {
  id: string;
  name: string;
  image: string;
  createdAt: string;
};

function storageKey(scope: string) {
  return `diagops_signature_presets:${scope}`;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizePresetList(items: SignaturePreset[]) {
  const cleaned = items
    .filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.image === "string"
    )
    .map((item) => ({
      ...item,
      name: item.name.trim().replace(/\s+/g, " "),
      image: item.image.trim(),
    }))
    .filter((item) => item.name.length > 0 && item.image.length > 0);

  // Drop exact duplicates first (same normalized name + image), keep first occurrence.
  const dedupExact: SignaturePreset[] = [];
  const exactSeen = new Set<string>();
  for (const item of cleaned) {
    const key = `${normalizeName(item.name)}|${item.image}`;
    if (exactSeen.has(key)) continue;
    exactSeen.add(key);
    dedupExact.push(item);
  }

  // For same signature image, remove short typing fragments that are prefixes of longer names.
  const shouldDropByPrefix = new Set<string>();
  const byImage = new Map<string, SignaturePreset[]>();
  for (const item of dedupExact) {
    const rows = byImage.get(item.image) ?? [];
    rows.push(item);
    byImage.set(item.image, rows);
  }
  byImage.forEach((rows) => {
    const normalized = rows.map((item) => ({ item, name: normalizeName(item.name) }));
    for (const candidate of normalized) {
      const isTypingFragment = normalized.some(
        (row) => row.name !== candidate.name && row.name.startsWith(candidate.name)
      );
      if (isTypingFragment) shouldDropByPrefix.add(candidate.item.id);
    }
  });

  return dedupExact.filter((item) => !shouldDropByPrefix.has(item.id)).slice(0, 20);
}

export function loadSignaturePresets(scope: string): SignaturePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SignaturePreset[];
    if (!Array.isArray(parsed)) return [];
    const normalized = normalizePresetList(parsed);
    if (normalized.length !== parsed.length) {
      window.localStorage.setItem(storageKey(scope), JSON.stringify(normalized));
    }
    return normalized;
  } catch {
    return [];
  }
}

export function saveSignaturePresets(scope: string, items: SignaturePreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(normalizePresetList(items)));
}

export function upsertSignaturePreset(
  items: SignaturePreset[],
  input: { name: string; image: string }
) {
  const name = input.name.trim();
  const image = input.image.trim();
  if (!name || !image) return { items, id: null as string | null, changed: false };
  const normalizedItems = normalizePresetList(items);

  const existing = normalizedItems.find(
    (item) => item.name.trim().toLowerCase() === name.toLowerCase() && item.image === image
  );
  if (existing) return { items: normalizedItems, id: existing.id, changed: false };

  const created: SignaturePreset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    image,
    createdAt: new Date().toISOString(),
  };
  return { items: normalizePresetList([created, ...normalizedItems]), id: created.id, changed: true };
}

export function removeSignaturePreset(items: SignaturePreset[], id: string) {
  return items.filter((item) => item.id !== id);
}
