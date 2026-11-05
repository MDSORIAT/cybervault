import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const PORT = Number(process.env.PORT) || 4000;
export const API_KEY = process.env.API_KEY || 'dev-cybervault-key';
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',').map((s) => s.trim()).filter(Boolean);

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
export const MONGODB_DB = process.env.MONGODB_DB || 'cybervault';

export const MB =1024 * 1024;
export const MAX_FILE_BYTES = 50 * MB;
export const MAX_TOTAL_BYTES = 50 * MB;
export const FILE_TTL_MS = 48 * 60 * 60 * 1000;
export const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// On Railway, point this at the mounted volume (e.g. /data/uploads) so files survive redeploys.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(root, 'uploads');
export const DATA_DIR = path.join(root, 'data');
export const CLIENT_DIST = path.join(root, '..', 'client', 'dist');

export const TEXT_EXTENSIONS = new Set([
  '.txt', '.dxf', '.html', '.css', '.js',
  '.py', '.java', '.c', '.cpp', '.h', '.pl', // source code files
]);
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.zip', '.png', '.jpg', '.jpeg', '.dwg', ...TEXT_EXTENSIONS]);
