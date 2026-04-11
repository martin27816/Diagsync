export type LabVersionLike = {
  id: string;
  version: number;
  isActive: boolean;
  parentId: string | null;
};

export type RadiologyVersionLike = {
  id: string;
  version: number;
  isActive: boolean;
  parentId: string | null;
};

export function pickActiveVersion<T extends { isActive: boolean }>(versions: T[]) {
  return versions.find((version) => version.isActive) ?? null;
}

export function isEditedVersion(currentVersion: number) {
  return currentVersion > 1;
}

export function resolveEditNotificationTargets(input: {
  editorId: string;
  mdIds: string[];
  performerIds: string[];
}) {
  const set = new Set<string>();
  for (const id of input.mdIds) {
    if (id && id !== input.editorId) set.add(id);
  }
  for (const id of input.performerIds) {
    if (id && id !== input.editorId) set.add(id);
  }
  return Array.from(set);
}

export function hasSingleActiveVersion<T extends { isActive: boolean }>(versions: T[]) {
  return versions.filter((version) => version.isActive).length <= 1;
}

export function isVersionChainValid(
  versions: Array<{ id: string; version: number; parentId: string | null }>
) {
  if (versions.length === 0) return true;
  const byId = new Map(versions.map((version) => [version.id, version]));
  const sorted = [...versions].sort((a, b) => a.version - b.version);

  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (i === 0) {
      if (current.parentId !== null) return false;
      continue;
    }
    const previous = sorted[i - 1];
    if (current.parentId !== previous.id) return false;
    if (!byId.has(current.parentId)) return false;
  }
  return true;
}
