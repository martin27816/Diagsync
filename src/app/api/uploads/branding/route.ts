import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toDataUri(fileType: string, base64: string) {
  return `data:${fileType};base64,${base64}`;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const folder = (form.get("folder") as string) || "diagsync/branding";

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { success: false, error: "Branding storage is not configured (Cloudinary env missing)" },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadBody = new URLSearchParams();
    uploadBody.set("file", toDataUri(file.type, buffer.toString("base64")));
    uploadBody.set("upload_preset", uploadPreset);
    uploadBody.set("folder", folder);

    const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: "POST",
      body: uploadBody,
    });
    const uploadJson = await uploadRes.json();
    if (!uploadRes.ok || !uploadJson?.secure_url) {
      return NextResponse.json(
        { success: false, error: "External upload failed. Please retry." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        fileUrl: uploadJson.secure_url,
        publicId: uploadJson.public_id ?? null,
      },
    });
  } catch (error) {
    console.error("[BRANDING_UPLOAD]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
