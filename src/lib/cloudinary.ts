import { createHash } from "node:crypto";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function readConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("CLOUDINARY_SIGNED_ENV_MISSING");
  }

  return { cloudName, apiKey, apiSecret };
}

function buildSignature(params: Record<string, string>, apiSecret: string) {
  const toSign = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1")
    .update(`${toSign}${apiSecret}`)
    .digest("hex");
}

export async function uploadToCloudinarySigned(input: {
  fileType: string;
  buffer: Buffer;
  folder: string;
}) {
  const cfg = readConfig();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildSignature(
    {
      folder: input.folder,
      timestamp,
    },
    cfg.apiSecret
  );

  const uploadBody = new FormData();
  uploadBody.append("file", new Blob([input.buffer as unknown as ArrayBuffer], { type: input.fileType }), "upload");
  uploadBody.append("folder", input.folder);
  uploadBody.append("timestamp", timestamp);
  uploadBody.append("api_key", cfg.apiKey);
  uploadBody.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudName}/auto/upload`, {
    method: "POST",
    body: uploadBody,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.secure_url) {
    const detail = payload?.error?.message ?? "Upload failed";
    throw new Error(`CLOUDINARY_UPLOAD_FAILED:${detail}`);
  }

  return payload as {
    secure_url: string;
    public_id?: string;
    width?: number;
    height?: number;
    format?: string;
    resource_type?: string;
  };
}
