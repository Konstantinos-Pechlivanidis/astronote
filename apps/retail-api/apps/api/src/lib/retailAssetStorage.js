const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const UPLOAD_ROOT = path.resolve(__dirname, '../../../../uploads/retail');

const MIME_EXTENSIONS = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function sanitizeSegment(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function resolveStoragePath(storagePath) {
  const abs = path.resolve(UPLOAD_ROOT, storagePath);
  if (!abs.startsWith(UPLOAD_ROOT)) {
    throw new Error('Invalid storage path');
  }
  return abs;
}

async function saveAssetFile({ ownerId, kind, file }) {
  const ownerSegment = sanitizeSegment(ownerId);
  const kindSegment = sanitizeSegment(kind);
  const ext = MIME_EXTENSIONS[file.mimetype] || path.extname(file.originalname) || '';
  const name = sanitizeSegment(path.basename(file.originalname, path.extname(file.originalname)));
  const suffix = crypto.randomBytes(6).toString('hex');
  const filename = `${name || kindSegment}-${Date.now()}-${suffix}${ext}`;
  const storagePath = path.posix.join(ownerSegment, kindSegment, filename);
  const absPath = resolveStoragePath(storagePath);

  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, file.buffer);

  return { storagePath, fileName: filename };
}

async function deleteAssetFile(storagePath) {
  if (!storagePath) {return;}
  try {
    const absPath = resolveStoragePath(storagePath);
    await fs.unlink(absPath);
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      throw err;
    }
  }
}

module.exports = { UPLOAD_ROOT, saveAssetFile, deleteAssetFile, resolveStoragePath };
