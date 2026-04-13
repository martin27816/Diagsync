export type SignaturePreset = {
  id: string;
  name: string;
  image: string;
  createdAt: string;
};

function storageKey(scope: string) {
  return `diagops_signature_presets:${scope}`;
}

export function loadSignaturePresets(scope: string): SignaturePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(scope));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SignaturePreset[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.image === "string"
    );
  } catch {
    return [];
  }
}

export function saveSignaturePresets(scope: string, items: SignaturePreset[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(scope), JSON.stringify(items.slice(0, 20)));
}

export function upsertSignaturePreset(
  items: SignaturePreset[],
  input: { name: string; image: string }
) {
  const name = input.name.trim();
  const image = input.image.trim();
  if (!name || !image) return { items, id: null as string | null, changed: false };

  const existing = items.find(
    (item) => item.name.trim().toLowerCase() === name.toLowerCase() && item.image === image
  );
  if (existing) return { items, id: existing.id, changed: false };

  const created: SignaturePreset = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    image,
    createdAt: new Date().toISOString(),
  };
  return { items: [created, ...items].slice(0, 20), id: created.id, changed: true };
}

export function removeSignaturePreset(items: SignaturePreset[], id: string) {
  return items.filter((item) => item.id !== id);
}
