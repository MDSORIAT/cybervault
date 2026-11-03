import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import {
  PORT, CORS_ORIGINS, MAX_FILE_BYTES, MAX_TOTAL_BYTES, FILE_TTL_MS,
  CLEANUP_INTERVAL_MS, UPLOAD_DIR, CLIENT_DIST,
} from './config.js';
import {
  connectDb, withLock, listFiles, findFile, insertFile, totalStoredBytes, listLog,
  totalBytes, isExpired, removeStoredFile, purgeExpired,
} from './store.js';
import { requireApiKey, sanitizeName, sanitizeFilename, extensionAllowed, contentLooksSafe } from './security.js';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

class ApiError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());

// Unauthenticated liveness probe for the hosting platform.
app.get('/health', (_req, res) => res.json({ ok: true }));

const api = express.Router();
api.use(cors({ origin: CORS_ORIGINS, allowedHeaders: ['Content-Type', 'x-api-key'] }));
api.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
api.use(requireApiKey);

const uploadLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'RATE_LIMIT_EXCEEDED' },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2, fieldSize: 1024 },
  fileFilter: (_req, file, cb) => {
    if (!extensionAllowed(file.originalname)) return cb(new ApiError(415, 'FILE_TYPE_REJECTED'));
    cb(null, true);
  },
});

const toPublic = ({ storedName, ...pub }) => ({
  ...pub,
  expiresAt: new Date(Date.parse(pub.uploadedAt) + FILE_TTL_MS).toISOString(),
});

async function snapshot() {
  const files = (await listFiles()).filter((f) => !isExpired(f));
  return {
    files: files.map(toPublic).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    usedBytes: totalBytes(files),
    quotaBytes: MAX_TOTAL_BYTES,
  };
}

// --- Live feed over Server-Sent Events ---
const clients = new Set();
async function broadcast() {
  const payload = `data: ${JSON.stringify(await snapshot())}\n\n`;
  for (const res of clients) res.write(payload);
}

api.get('/stream', async (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write(`data: ${JSON.stringify(await snapshot())}\n\n`);
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(ping);
    clients.delete(res);
  });
});

api.get('/files', async (_req, res) => res.json(await snapshot()));

api.post('/upload', uploadLimiter, async (req, res, next) => {
  // Fail fast from Content-Length so we don't accept bytes that can never fit.
  const declared = Number(req.get('content-length')) || 0;
  const used = await totalStoredBytes();
  if (used + declared > MAX_TOTAL_BYTES + 16 * 1024) {
    return next(new ApiError(507, 'STORAGE_QUOTA_EXCEEDED'));
  }
  upload.single('file')(req, res, async (err) => {
    const discard = () => req.file && removeStoredFile(req.file.filename);
    try {
      if (err) throw err;
      res.status(201).json({ file: toPublic(await storeUpload(req)) });
      broadcast();
    } catch (e) {
      await discard();
      next(e);
    }
  });
});

async function storeUpload(req) {
  const file = req.file;
  if (!file) throw new ApiError(400, 'NO_FILE_RECEIVED');

  const studentName = sanitizeName(req.body.studentName);
  if (!studentName) throw new ApiError(400, 'INVALID_STUDENT_NAME');

  const originalName = sanitizeFilename(file.originalname);
  if (!(await contentLooksSafe(file.path, originalName))) throw new ApiError(415, 'MALICIOUS_CONTENT_DETECTED');

  // Authoritative quota check, under the lock so parallel uploads can't overshoot.
  return withLock(async () => {
    if ((await totalStoredBytes()) + file.size > MAX_TOTAL_BYTES) throw new ApiError(507, 'STORAGE_QUOTA_EXCEEDED');
    const entry = {
      id: crypto.randomUUID(),
      studentName,
      originalName,
      storedName: file.filename,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    await insertFile(entry);
    return entry;
  });
}

api.get('/files/:id/download', async (req, res, next) => {
  const record = await findFile(req.params.id);
  if (!record || isExpired(record)) return next(new ApiError(404, 'FILE_NOT_FOUND'));
  res.set('Content-Type', 'application/octet-stream');
  res.download(path.join(UPLOAD_DIR, record.storedName), record.originalName);
});

api.get('/changelog', async (_req, res) => {
  res.json(await listLog());
});

api.use((err, _req, res, _next) => {
  if (err instanceof ApiError) return res.status(err.status).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'FILE_TOO_LARGE' });
    return res.status(400).json({ error: 'UPLOAD_REJECTED' });
  }
  console.error(err);
  res.status(500).json({ error: 'INTERNAL_ERROR' });
});

app.use('/api', api);

// Serve the built client in production (npm run build first).
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

async function cleanup() {
  try {
    const removed = await purgeExpired();
    if (removed) {
      console.log(`[cleanup] purged ${removed} expired file(s)`);
      broadcast();
    }
  } catch (err) {
    console.error('[cleanup] failed', err);
  }
}

try {
  await connectDb();
} catch (err) {
  console.error(`[db] could not connect to MongoDB: ${err.message}`);
  process.exit(1);
}
await cleanup();
setInterval(cleanup, CLEANUP_INTERVAL_MS).unref();

app.listen(PORT, () => console.log(`[cybervault] API online at http://localhost:${PORT}`));
