import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { randomUUID } from "crypto";
import { isCloudinaryConfigured, uploadBuffer } from "@/lib/cloudinary";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // SVG removed: arbitrary SVGs can contain scripts. Re-add only with sanitization.
]);

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limited = rateLimit(req, { key: "upload", limit: 20, windowMs: 60_000 });
  if (limited) return limited;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 });
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 415 });
    }

    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return NextResponse.json({ error: "File extension not allowed" }, { status: 415 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Production: Cloudinary. Dev fallback: local public/uploads (ephemeral on Railway,
    // so this branch should never run in prod — guard checks env var).
    if (isCloudinaryConfigured()) {
      const userId = session.user.id;
      const result = await uploadBuffer(buffer, {
        folder: `trevixe/${userId}`,
        tags: [`user:${userId}`],
      });
      return NextResponse.json({
        url: result.url,
        publicId: result.publicId,
        provider: "cloudinary",
      });
    }

    if (process.env.NODE_ENV === "production") {
      console.error("Upload requested but CLOUDINARY_URL is not configured");
      return NextResponse.json(
        { error: "Upload service not configured" },
        { status: 503 }
      );
    }

    const filename = `${randomUUID()}.${ext}`;
    const uploadsDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, filename), buffer);

    return NextResponse.json({
      url: `/uploads/${filename}`,
      provider: "local",
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
