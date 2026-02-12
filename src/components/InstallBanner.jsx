import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const updateStandalone = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
      setIsStandalone(Boolean(standalone));
    };

    updateStandalone();

    const media = window.matchMedia("(display-mode: standalone)");
    const onMediaChange = () => updateStandalone();
    if (media.addEventListener) {
      media.addEventListener("change", onMediaChange);
    } else {
      media.addListener(onMediaChange);
    }

    return () => {
      if (media.removeEventListener) {
        media.removeEventListener("change", onMediaChange);
      } else {
        media.removeListener(onMediaChange);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible || isStandalone) return null;

  return (
    <button
      type="button"
      onClick={handleInstall}
      className="fixed right-6 top-6 z-[60] flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-800"
    >
      <Download size={16} />
      Open in app
    </button>
  );
}
