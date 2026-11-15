// Client-side image optimisation: large photos are scaled down before upload
// so pages load fast on mobile. GIFs (animation) and small files are untouched.
const MAX_DIM = 2400;
const MIN_BYTES = 600 * 1024;

export async function optimizeImage(file, { maxDim = MAX_DIM, quality = 0.86 } = {}) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  let bmp;
  try { bmp = await createImageBitmap(file); } catch { return file; }
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < MIN_BYTES) { bmp.close?.(); return file; }
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  const type = file.type === 'image/png' && scale === 1 ? 'image/png' : 'image/webp';
  const blob = await new Promise(res => canvas.toBlob(res, type, quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, type === 'image/webp' ? '.webp' : '.png'), { type: blob.type });
}

/** Grab a still frame from a video as a JPEG (used as the video's fallback image). */
export function videoPoster(video, { maxDim = 1600 } = {}) {
  const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.82));
}
