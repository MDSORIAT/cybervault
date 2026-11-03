import { useRef, useState } from 'react';
import { Terminal, UploadCloud, FileUp, X } from 'lucide-react';
import { api, errorCode, formatBytes, MAX_FILE_BYTES, ALLOWED_EXTENSIONS } from '../api.js';

const NAME_PATTERN = /^[\p{L}\p{N} .'-]{2,60}$/u;

function validate(name, file, vault) {
  if (!NAME_PATTERN.test(name.trim())) return 'INVALID_STUDENT_NAME';
  if (!file) return 'NO_FILE_SELECTED';
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) return 'FILE_TYPE_REJECTED';
  if (file.size > MAX_FILE_BYTES) return 'FILE_TOO_LARGE';
  if (vault.usedBytes + file.size > vault.quotaBytes) return 'STORAGE_QUOTA_EXCEEDED';
  return null;
}

export default function UploadTerminal({ vault }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null);
  const [lines, setLines] = useState([{ kind: 'info', text: 'Awaiting payload. Allowed: ' + ALLOWED_EXTENSIONS.join(' ') }]);
  const inputRef = useRef(null);

  const log = (kind, text) => setLines((prev) => [...prev.slice(-5), { kind, text }]);

  function pick(f) {
    if (!f) return;
    setFile(f);
    log('info', `> payload staged: ${f.name} (${formatBytes(f.size)})`);
  }

  function clearFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate(name, file, vault);
    if (problem) return log('error', `[ERROR: ${problem}]`);

    const form = new FormData();
    form.append('studentName', name.trim());
    form.append('file', file);
    setProgress(0);
    log('info', `> transmitting ${file.name}...`);
    try {
      await api.post('/upload', form, {
        onUploadProgress: (p) => p.total && setProgress(Math.round((p.loaded / p.total) * 100)),
      });
      log('ok', `[OK] ${file.name} secured in vault. Self-destruct in 48h.`);
      clearFile();
    } catch (err) {
      log('error', `[ERROR: ${errorCode(err)}]`);
    } finally {
      setProgress(null);
    }
  }

  const busy = progress !== null;
  const color = { info: 'text-neon/70', ok: 'text-neon glow', error: 'text-danger' };

  return (
    <section className="panel rounded-md">
      <div className="flex items-center gap-2 border-b border-neon/20 px-4 py-2 text-xs text-cyan">
        <Terminal size={14} /> upload_terminal.sh
      </div>
      <form onSubmit={submit} className="p-4 space-y-4">
        <label className="block">
          <span className="text-xs text-neon/70">$ STUDENT_NAME=</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoComplete="off"
            placeholder="enter your name"
            className="mt-1 w-full rounded-sm border border-neon/30 bg-void px-3 py-2 text-neon placeholder:text-neon/30 outline-none focus:border-cyan focus:shadow-[0_0_12px_rgb(0_240_255/0.3)]"
          />
        </label>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
          className={`cursor-pointer rounded-sm border-2 border-dashed px-4 py-8 text-center transition ${
            dragging ? 'border-cyan bg-cyan/5' : 'border-neon/30 hover:border-neon/60'
          }`}
        >
          <input ref={inputRef} type="file" hidden accept={ALLOWED_EXTENSIONS.join(',')} onChange={(e) => pick(e.target.files[0])} />
          {file ? (
            <div className="flex items-center justify-center gap-2 text-cyan">
              <FileUp size={18} className="shrink-0" />
              <span className="truncate max-w-[55vw]">{file.name}</span>
              <span className="text-neon/60 shrink-0">({formatBytes(file.size)})</span>
              <button
                type="button"
                aria-label="Clear file"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
                className="text-danger hover:opacity-70"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="text-neon/60">
              <UploadCloud className="mx-auto mb-2 text-neon" size={28} />
              DROP FILE HERE or click to browse <span className="text-neon/40">// max 50MB</span>
            </div>
          )}
        </div>

        {busy && (
          <div className="h-1.5 w-full bg-neon/10 rounded-sm overflow-hidden">
            <div className="h-full bg-cyan transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          disabled={busy}
          className="w-full rounded-sm border border-neon bg-neon/10 py-2 font-semibold text-neon hover:bg-neon hover:text-void disabled:opacity-40 disabled:cursor-wait transition"
        >
          {busy ? `UPLOADING ${progress}%` : '>> EXECUTE UPLOAD'}
        </button>

        <div className="rounded-sm bg-black/60 p-3 text-xs space-y-1 min-h-16 break-words" aria-live="polite">
          {lines.map((l, i) => (
            <p key={i} className={color[l.kind]}>{l.text}</p>
          ))}
          <p className="text-neon/50 cursor" />
        </div>
      </form>
    </section>
  );
}
