export const SIGNOFF_IMAGE_KEY = "__signature_image";
export const SIGNOFF_NAME_KEY = "__signature_name";

export type ReportSignOff = {
  signatureImage: string;
  signatureName: string;
};

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

export function isDataImageUrl(value: string) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value);
}

export function extractSignOffFromMap(input: unknown): ReportSignOff | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const map = input as Record<string, unknown>;
  const signatureImage = asText(map[SIGNOFF_IMAGE_KEY]);
  const signatureName = asText(map[SIGNOFF_NAME_KEY]);
  if (!signatureImage || !signatureName) return null;
  if (!isDataImageUrl(signatureImage)) return null;
  return { signatureImage, signatureName };
}

export function stripSignOffKeys(input: Record<string, unknown>) {
  const next = { ...input };
  delete next[SIGNOFF_IMAGE_KEY];
  delete next[SIGNOFF_NAME_KEY];
  return next;
}
