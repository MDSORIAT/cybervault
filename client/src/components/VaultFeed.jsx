import { useEffect, useState } from 'react';
import { Database, Download, FileText, FileArchive, FileImage, FileCode, FileSpreadsheet, Presentation, DraftingCompass, File } from 'lucide-react';
import { downloadFile, errorCode, formatBytes } from '../api.js';

const ICONS = { pdf: FileText, docx: FileText, txt: FileText, zip: FileArchive, png: FileImage, jpg: FileImage, jpeg: FileImage,
  xlsx: FileSpreadsheet, xls: FileSpreadsheet, pptx: Presentation,
  html: FileCode, css: FileCode, js: FileCode, dwg: DraftingCompass, dxf: DraftingCompass };

function timeLeft(expiresAt, now) {
  const ms = Math.max(0, Date.parse(expiresAt) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function VaultFeed({ files }) {
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState(null);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  async function download(file) {
    setError(null);
    try {
      await downloadFile(file);
    } catch (err) {
      setError(`[ERROR: ${errorCode(err)}] ${file.originalName}`);
    }
  }

  return (
    <section className="panel rounded-md">
      <div className="flex items-center justify-between border-b border-neon/20 px-4 py-2 text-xs text-cyan">
        <span className="flex items-center gap-2"><Database size={14} /> live_vault_feed</span>
        <span className="text-neon/60">{files.length} object{files.length === 1 ? '' : 's'}</span>
      </div>

      {error && <p className="px-4 pt-3 text-xs text-danger">{error}</p>}

      {files.length === 0 ? (
        <p className="p-6 text-center text-sm text-neon/40">// vault empty. no payloads detected.</p>
      ) : (
        <ul className="divide-y divide-neon/10">
          {files.map((f) => {
            const Icon = ICONS[f.originalName.split('.').pop().toLowerCase()] || File;
            const urgent = Date.parse(f.expiresAt) - now < 6 * 3_600_000;
            return (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 hover:bg-neon/5 animate-[fadein_0.4s_ease-out]">
                <Icon size={20} className="shrink-0 text-cyan" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-neon">{f.originalName}</p>
                  <p className="text-xs text-neon/50 truncate">
                    by <span className="text-cyan/80">{f.studentName}</span> · {formatBytes(f.size)} ·{' '}
                    {new Date(f.uploadedAt).toLocaleString([], { hour12: false })}
                  </p>
                </div>
                <span className={`hidden sm:block text-xs tabular-nums ${urgent ? 'text-danger' : 'text-neon/60'}`} title="Time until auto-delete">
                  T-{timeLeft(f.expiresAt, now)}
                </span>
                <button
                  onClick={() => download(f)}
                  aria-label={`Download ${f.originalName}`}
                  className="shrink-0 rounded-sm border border-neon/40 p-1.5 text-neon hover:bg-neon hover:text-void transition"
                >
                  <Download size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
