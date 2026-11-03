import { useEffect, useState } from 'react';
import { ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { formatBytes } from '../api.js';
import InstallButton from './InstallButton.jsx';

export default function Header({ online, vault }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const pct = Math.min(100, (vault.usedBytes / vault.quotaBytes) * 100);
  const barColor = pct > 90 ? 'bg-danger' : pct > 70 ? 'bg-yellow-400' : 'bg-neon';

  return (
    <header className="panel rounded-md p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-cyan/70">root@cybervault:~$ ./boot --secure</p>
          <h1 className="glitch glow mt-1 text-3xl sm:text-4xl font-extrabold text-neon tracking-tight" data-text="CYBERVAULT">
            CYBERVAULT
          </h1>
          <p className="mt-1 text-sm text-neon/60">Student File Sharing // ephemeral, fast, locked down</p>
        </div>
        <div className="text-right text-xs space-y-1">
          <p className="text-cyan glow text-lg tabular-nums">{now.toLocaleTimeString([], { hour12: false })}</p>
          <p className="text-neon/60">{now.toISOString().slice(0, 10)}</p>
          <p className={`flex items-center justify-end gap-1 ${online ? 'text-neon' : 'text-danger'}`}>
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'LINK: ONLINE' : 'LINK: OFFLINE'}
          </p>
          <p className="flex items-center justify-end gap-1 text-neon/70">
            <ShieldCheck size={14} /> SHIELDS: ACTIVE
          </p>
          <div className="flex justify-end pt-1">
            <InstallButton />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex justify-between text-xs text-neon/70 mb-1">
          <span>VAULT STORAGE</span>
          <span className="tabular-nums">
            {formatBytes(vault.usedBytes)} / {formatBytes(vault.quotaBytes)} ({pct.toFixed(1)}%)
          </span>
        </div>
        <div className="h-2 w-full rounded-sm bg-neon/10 overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </header>
  );
}
