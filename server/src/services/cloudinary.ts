/**
 * Cloudinary image upload (REQ-02 / BLOG-11 / A6-VENDER-03).
 *
 * When CLOUDINARY_* env vars are set, images are uploaded and only the secure
 * URL is persisted (instead of fat base64 blobs in the DB / responses). When
 * Cloudinary is NOT configured, uploadImage() returns null and callers fall
 * back to storing the raw bytes, so functionality is never silently lost.
 */
import { v2 as cloudinary } from 'cloudinary';
import { isCloudinaryConfigured } from '../config/env';

let configured = false;

function ensureConfigured(): boolean {
  if (configured) return true;
  if (!isCloudinaryConfigured()) return false;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
  return true;
}

export function cloudinaryEnabled(): boolean {
  return ensureConfigured();
}

/** Normalize a raw base64 string or a full data URI into an uploadable data URI. */
function toDataUri(input: string): string {
  return input.startsWith('data:') ? input : `data:image/jpeg;base64,${input}`;
}

/** Strip an optional `data:...;base64,` prefix and return the decoded bytes. */
export function toBuffer(input: string): Buffer {
  const comma = input.indexOf(',');
  const base64 = input.startsWith('data:') && comma !== -1 ? input.slice(comma + 1) : input;
  return Buffer.from(base64, 'base64');
}

/**
 * Upload an image (base64 or data URI). Returns the secure URL, or null when
 * Cloudinary is not configured so the caller can persist bytes instead.
 */
export async function uploadImage(image: string, folder: string): Promise<string | null> {
  if (!ensureConfigured()) return null;
  const result = await cloudinary.uploader.upload(toDataUri(image), {
    folder: `subastas/${folder}`,
    resource_type: 'image',
  });
  return result.secure_url;
}
