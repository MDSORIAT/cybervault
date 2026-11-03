import fs from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { DATA_DIR, UPLOAD_DIR, FILE_TTL_MS, MONGODB_URI, MONGODB_DB } from './config.js';

const client = new MongoClient(MONGODB_URI);
let filesCol;
let logCol;

/** Connects, creates indexes, and seeds the changelog from data/changelog.json on first run. */
export async function connectDb() {
  await client.connect();
  const db = client.db(MONGODB_DB);
  filesCol = db.collection('files');
  logCol = db.collection('changelog');
  await filesCol.createIndex({ id: 1 }, { unique: true });
  await filesCol.createIndex({ uploadedAt: -1 });
  await logCol.createIndex({ id: 1 }, { unique: true });

  if ((await logCol.estimatedDocumentCount()) === 0) {
    const seed = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'changelog.json'), 'utf8').catch(() => '[]'));
    if (seed.length) await logCol.insertMany(seed);
  }
  console.log(`[db] connected to MongoDB "${MONGODB_DB}"`);
}

// Serialises quota check + insert so concurrent uploads can't both pass (single server instance).
let queue = Promise.resolve();
export function withLock(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

const noId = { projection: { _id: 0 } };

export const listFiles = () => filesCol.find({}, noId).toArray();
export const findFile = (id) => filesCol.findOne({ id: String(id) }, noId);
export const insertFile = (entry) => filesCol.insertOne({ ...entry });
export const listLog = () => logCol.find({}, noId).sort({ timestamp: -1, id: -1 }).toArray();

export async function totalStoredBytes() {
  const [row] = await filesCol.aggregate([{ $group: { _id: null, total: { $sum: '$size' } } }]).toArray();
  return row?.total ?? 0;
}

export async function appendLog(entry) {
  const [last] = await logCol.find().sort({ id: -1 }).limit(1).toArray();
  const record = { id: (last?.id ?? 0) + 1, timestamp: new Date().toISOString(), ...entry };
  await logCol.insertOne({ ...record });
  return record;
}

export const totalBytes = (files) => files.reduce((sum, f) => sum + f.size, 0);
export const isExpired = (f, now = Date.now()) => now - Date.parse(f.uploadedAt) >= FILE_TTL_MS;

export async function removeStoredFile(storedName) {
  await fs.rm(path.join(UPLOAD_DIR, storedName), { force: true });
}

/** Deletes expired files plus orphaned blobs on disk. Returns how many records were removed. */
export function purgeExpired() {
  return withLock(async () => {
    const now = Date.now();
    const cutoff = new Date(now - FILE_TTL_MS).toISOString();
    const expired = await filesCol.find({ uploadedAt: { $lte: cutoff } }, noId).toArray();
    for (const f of expired) await removeStoredFile(f.storedName);
    if (expired.length) await filesCol.deleteMany({ id: { $in: expired.map((f) => f.id) } });

    // Orphans: blobs with no record (e.g. a crash mid-upload). Skip very recent ones,
    // which may belong to an upload that is still streaming in.
    const known = new Set((await listFiles()).map((f) => f.storedName));
    for (const name of await fs.readdir(UPLOAD_DIR).catch(() => [])) {
      if (known.has(name)) continue;
      const stat = await fs.stat(path.join(UPLOAD_DIR, name)).catch(() => null);
      if (stat && now - stat.mtimeMs > 60 * 60 * 1000) await removeStoredFile(name);
    }
    return expired.length;
  });
}

export const closeDb = () => client.close();
