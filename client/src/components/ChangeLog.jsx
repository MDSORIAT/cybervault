import { useEffect, useState } from 'react';
import { ChevronDown, GitCommitHorizontal } from 'lucide-react';
import { api, errorCode } from '../api.js';

const TYPE_COLORS = {
  feature: 'text-neon',
  fix: 'text-yellow-300',
  security: 'text-danger',
  deploy: 'text-cyan',
  docs: 'text-purple-300',
};

export default function ChangeLog() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || entries) return;
    api.get('/changelog').then(({ data }) => setEntries(data), (err) => setError(errorCode(err)));
  }, [open, entries]);

  return (
    <section className="panel rounded-md">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2 text-xs text-cyan hover:bg-neon/5"
      >
        <span className="flex items-center gap-2"><GitCommitHorizontal size={14} /> project_tracking.log</span>
        <ChevronDown size={16} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-neon/20 bg-black/60 p-4 text-xs max-h-80 overflow-y-auto space-y-1.5">
          {error && <p className="text-danger">[ERROR: {error}]</p>}
          {!entries && !error && <p className="text-neon/50 cursor">loading</p>}
          {entries?.map((e) => (
            <p key={e.id} className="break-words">
              <span className="text-neon/40">[{new Date(e.timestamp).toLocaleString([], { hour12: false })}]</span>{' '}
              <span className={`uppercase ${TYPE_COLORS[e.type] || 'text-neon/70'}`}>{e.type}</span>{' '}
              <span className="text-neon/80">{e.message}</span>{' '}
              <span className="text-cyan/60">— {e.author}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
