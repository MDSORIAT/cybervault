import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Shows an install button (Chrome/Edge/Android) or Add-to-Home-Screen steps (iOS Safari). */
export default function InstallButton() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || (!prompt && !isIos())) return null;

  async function install() {
    if (!prompt) return setShowIosHelp(true);
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return (
    <div className="relative">
      <button
        onClick={install}
        className="flex items-center gap-1.5 rounded-sm border border-cyan/60 bg-cyan/10 px-2.5 py-1 text-xs font-semibold text-cyan hover:bg-cyan hover:text-void transition"
      >
        <Download size={14} /> INSTALL APP
      </button>
      {showIosHelp && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-sm border border-cyan/40 bg-void p-3 text-left text-xs text-neon/80 shadow-[0_0_20px_rgb(0_240_255/0.2)]">
          <button onClick={() => setShowIosHelp(false)} aria-label="Close" className="absolute right-2 top-2 text-neon/50 hover:text-neon">
            <X size={14} />
          </button>
          <p className="mb-1 text-cyan">Install on iPhone / iPad:</p>
          <p>1. Tap <Share size={12} className="inline" /> <b>Share</b> in Safari</p>
          <p>2. Choose <b>Add to Home Screen</b></p>
          <p>3. Tap <b>Add</b></p>
        </div>
      )}
    </div>
  );
}
