export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // matches client_max_body_size in the nginx site
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const IMAGE_CONTENT_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Validates an uploaded image and returns { buffer, filename } or { error }.
 * Callers decide the status code; `error` is already user-facing text.
 */
export async function readImageUpload(file, { normalizeFilename }) {
  if (!file || typeof file === 'string' || !file.name || !file.arrayBuffer) {
    return { error: 'Invalid file upload.' };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: 'Only JPEG, PNG, GIF, or WebP images are accepted.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Images must be 25 MB or smaller.' };
  }

  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    filename: normalizeFilename(file.name),
  };
}

export function contentTypeForFilename(filename) {
  const extension = (filename || '').toLowerCase().split('.').pop();
  return IMAGE_CONTENT_TYPES[extension] || 'application/octet-stream';
}
