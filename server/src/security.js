import fs from 'node:fs/promises';
import path from 'node:path';
import { ALLOWED_EXTENSIONS, TEXT_EXTENSIONS, API_KEY } from './config.js';

export function requireApiKey(req, res, next) {
  // EventSource can't set headers, so the stream endpoint may pass the key as ?key=
  const key = req.get('x-api-key') || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: 'ACCESS_DENIED' });
  next();
}

/** Student names: letters (any script), digits, spaces and . ' - only. Returns null if invalid. */
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60) return null;
  return /^[\p{L}\p{N} .'-]+$/u.test(name) ? name : null;
}

/** Keeps the original filename for display but strips paths, control and markup characters. */
export function sanitizeFilename(raw) {
  const base = path.basename(String(raw).replace(/\\/g, '/')).normalize('NFKC');
  const clean = base.replace(/[\p{Cc}<>:"|?*`$]/gu, '_').slice(-120);
  return clean || 'file';
}

export function extensionAllowed(filename) {
  return ALLOWED_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

const bytes = (...b) => Buffer.from(b);

const EXECUTABLE_SIGNATURES = [
  Buffer.from('MZ'), // Windows PE (.exe, .dll)
  bytes(0x7f, 0x45, 0x4c, 0x46), // ELF
  bytes(0xcf, 0xfa, 0xed, 0xfe), // Mach-O 64
  bytes(0xfe, 0xed, 0xfa, 0xcf),
  bytes(0xca, 0xfe, 0xba, 0xbe), // Mach-O fat / Java class
  Buffer.from('#!'), // shebang scripts
];

const EXPECTED_SIGNATURES = {
  '.pdf': [Buffer.from('%PDF')],
  '.png': [bytes(0x89, 0x50, 0x4e, 0x47)],
  '.jpg': [bytes(0xff, 0xd8, 0xff)],
  '.jpeg': [bytes(0xff, 0xd8, 0xff)],
  '.zip': [bytes(0x50, 0x4b, 0x03, 0x04), bytes(0x50, 0x4b, 0x05, 0x06)],
  '.docx': [bytes(0x50, 0x4b, 0x03, 0x04)],
  '.dwg': [Buffer.from('AC10')], // AutoCAD version tag, e.g. AC1032
};

/** Reads the first bytes: rejects executables and files whose content doesn't match the extension. */
export async function contentLooksSafe(filePath, filename) {
  const handle = await fs.open(filePath, 'r');
  const head = Buffer.alloc(16);
  let read;
  try {
    ({ bytesRead: read } = await handle.read(head, 0, 16, 0));
  } finally {
    await handle.close();
  }
  const start = head.subarray(0, read);
  const startsWith = (sig) => start.subarray(0, sig.length).equals(sig);
  if (EXECUTABLE_SIGNATURES.some(startsWith)) return false;

  const ext = path.extname(filename).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) return !start.includes(0x00);
  return EXPECTED_SIGNATURES[ext].some(startsWith);
}
