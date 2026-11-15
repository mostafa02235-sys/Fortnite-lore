// Image files live in the private "lore-media" Storage bucket. The database
// stores only their paths. Viewers get short-lived signed URLs, and Storage
// RLS decides whether a given user may read a given file.
import { sb } from './supabase.js';
import { MEDIA_BUCKET, MAX_IMAGE_BYTES } from './config.js';
import { t } from './i18n.js';
import { $$ } from './util.js';
import { optimizeImage } from './optimize.js';

export const USER_BUCKET = 'lore-user-media';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const cache = new Map(); // path -> { url, exp }
const TTL = 60 * 60; // seconds

export function validateImage(file) {
  if (!file) return t('media.noFile');
  if (!TYPES[file.type]) return t('media.badType');
  if (file.size > MAX_IMAGE_BYTES) return t('media.tooBig');
  return null;
}

/** Upload a file under folder/ and return its storage path. */
export async function uploadImage(file, folder) {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  file = await optimizeImage(file);   // downscale very large photos for faster mobile loading
  const path = `${folder}/${crypto.randomUUID()}.${TYPES[file.type]}`;
  const { error } = await sb.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: file.type, cacheControl: '31536000', upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function removeFiles(paths, bucket = MEDIA_BUCKET) {
  const list = (paths || []).filter(Boolean);
  if (!list.length) return;
  list.forEach(p => cache.delete(bucket + ':' + p));
  const { error } = await sb.storage.from(bucket).remove(list);
  if (error) console.warn('storage remove failed', error);
}

/** Signed URLs for many paths at once; unreadable paths map to null. */
export async function signedUrls(paths, bucket = MEDIA_BUCKET) {
  const now = Date.now() / 1000;
  const key = p => bucket + ':' + p;
  const need = [...new Set(paths.filter(Boolean))].filter(p => !(cache.get(key(p))?.exp > now + 60));
  if (need.length) {
    const { data, error } = await sb.storage.from(bucket).createSignedUrls(need, TTL);
    if (!error && data) {
      for (const row of data) {
        if (row.signedUrl && !row.error) cache.set(key(row.path), { url: row.signedUrl, exp: now + TTL });
      }
    }
  }
  const out = {};
  for (const p of paths) out[p] = cache.get(key(p))?.url || null;
  return out;
}

/** Upload a file (Blob/File) into the signed-in user's private folder. */
export async function uploadUserFile(userId, blob, ext, contentType) {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(USER_BUCKET).upload(path, blob, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw error;
  return path;
}
export const userUrls = paths => signedUrls(paths, USER_BUCKET);

export async function urlFor(path) {
  if (!path) return null;
  return (await signedUrls([path]))[path];
}

/** Fill every <img data-path> (and [data-bg]) inside root with a signed URL. */
export async function hydrateMedia(root) {
  const imgs = $$('img[data-path]', root).filter(i => !i.getAttribute('src'));
  const bgs = $$('[data-bg]', root);
  const paths = [...imgs.map(i => i.dataset.path), ...bgs.map(b => b.dataset.bg)];
  if (!paths.length) return;
  const urls = await signedUrls(paths);
  for (const img of imgs) {
    const u = urls[img.dataset.path];
    if (u) { img.src = u; img.addEventListener('load', () => img.classList.add('loaded'), { once: true }); }
    else img.classList.add('missing');
  }
  for (const b of bgs) {
    const u = urls[b.dataset.bg];
    if (u) b.style.backgroundImage = `url("${u}")`;
  }
}
