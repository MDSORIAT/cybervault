import { useEffect, useState } from 'react';
import Header from './components/Header.jsx';
import UploadTerminal from './components/UploadTerminal.jsx';
import VaultFeed from './components/VaultFeed.jsx';
import ChangeLog from './components/ChangeLog.jsx';
import { openStream } from './api.js';

export default function App() {
  const [vault, setVault] = useState({ files: [], usedBytes: 0, quotaBytes: 50 * 1024 * 1024 });
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const source = openStream((snapshot) => {
      setVault(snapshot);
      setOnline(true);
    });
    source.onerror = () => setOnline(false);
    return () => source.close();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10 space-y-6">
      <Header online={online} vault={vault} />
      <UploadTerminal vault={vault} />
      <VaultFeed files={vault.files} />
      <ChangeLog />
      <footer className="text-center text-xs text-neon/40 pb-4">
        // files self-destruct 48h after upload · 50MB shared vault
      </footer>
    </div>
  );
}
