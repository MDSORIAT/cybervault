// Appends an entry to the project tracking log.
// Usage: npm run log -- <type> "<message>" [author]
//   type: feature | fix | security | deploy | docs | chore
import { connectDb, appendLog, closeDb } from '../src/store.js';

const [type, message, author = process.env.USER || process.env.USERNAME || 'unknown'] = process.argv.slice(2);
if (!type || !message) {
  console.error('Usage: npm run log -- <type> "<message>" [author]');
  process.exit(1);
}
await connectDb();
const entry = await appendLog({ author, type, message });
console.log(`[log] #${entry.id} ${entry.timestamp} ${type}: ${message}`);
await closeDb();
