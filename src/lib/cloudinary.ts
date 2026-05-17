import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

// Cloudinary auto-configures from CLOUDINARY_URL env var.
// Format: cloudinary://<api_key>:<api_secret>@<cloud_name>
// We delay the configure() call until the first upload so the module can be
// imported safely in environments where the env var isn't set (build time).

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!process.env.CLOUDINARY_URL) {
    throw new Error("CLOUDINARY_URL is not set");
  }
  // The SDK reads CLOUDINARY_URL automatically; explicit config not needed,
  // but we can still assert the credentials are parseable.
  cloudinary.config({ secure: true });
  configured = true;
}

export interface UploadOptions {
  folder?: string;
  /** Cloudinary public_id (filename without extension). Auto-generated if omitted. */
  publicId?: string;
  /** Tags attached to the asset for management. */
  tags?: string[];
}

export interface UploadResult {
  url: string;          // https://res.cloudinary.com/...
  publicId: string;     // for later deletion
  bytes: number;
  width?: number;
  height?: number;
  format?: string;
}

export async function uploadBuffer(
  buffer: Buffer,
  opts: UploadOptions = {}
): Promise<UploadResult> {
  ensureConfigured();
  const { folder = "trevixe", publicId, tags } = opts;

  const result: UploadApiResponse = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder,
          public_id: publicId,
          tags,
          resource_type: "image",
          // Limit max dimensions server-side as a defense-in-depth measure.
          transformation: [{ width: 2400, height: 2400, crop: "limit" }],
        },
        (err, res) => {
          if (err) return reject(err);
          if (!res) return reject(new Error("Empty Cloudinary response"));
          resolve(res);
        }
      )
      .end(buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    bytes: result.bytes,
    width: result.width,
    height: result.height,
    format: result.format,
  };
}

export async function deleteByPublicId(publicId: string): Promise<void> {
  ensureConfigured();
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(process.env.CLOUDINARY_URL);
}
