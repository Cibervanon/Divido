import { useEffect, useState } from "react";
import { Button, Modal } from "./ui";

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    if (typeof window === "undefined") return;

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Mostrar después de 2 visitas
      const visits = Number(localStorage.getItem("pwa_visits") || "0") + 1;
      localStorage.setItem("pwa_visits", String(visits));
      if (visits >= 2) setShow(true);
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, [dismissed]);

  const install = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      track("pwa_installed");
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  const dismiss = () => {
    setShow(false);
    setDismissed(true);
  };

  if (!show || !deferredPrompt) return null;

  return (
    <Modal
      open
      onClose={dismiss}
      title="Instalar Divido"
      footer={
        <div className="w-full flex justify-end gap-2">
          <Button variant="ghost" onClick={dismiss}>
            Ahora no
          </Button>
          <Button onClick={install}>
            Instalar
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-300 mb-4">
        Instala Divido en tu dispositivo para acceso rápido, modo offline y notificaciones push.
      </p>
      <ul className="space-y-2 text-sm text-slate-400">
        <li className="flex items-center gap-2">✓ Funciona sin conexión</li>
        <li className="flex items-center gap-2">✓ Acceso rápido desde pantalla de inicio</li>
        <li className="flex items-center gap-2">✓ Notificaciones push</li>
      </ul>
    </Modal>
  );
}

import { track } from "../lib/analytics";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}