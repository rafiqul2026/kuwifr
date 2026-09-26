// client/src/utils/pwaInstall.js
// "Download the App" support. KUWIFR ships as an installable Progressive Web
// App: Chrome/Edge/Samsung Internet fire `beforeinstallprompt` once the page
// has a valid manifest (site.webmanifest, PNG icons) and a registered service
// worker (public/sw.js). That event can fire before React mounts, so it is
// captured here at module load (imported from main.jsx) and replayed to any
// component through useInstallApp(). iOS Safari has no install API at all —
// there the button shows "Share → Add to Home Screen" instructions instead.
import { useEffect, useState } from "react";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true);

let installed = isStandalone();

export const isIOS = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPadOS 13+ reports itself as "Macintosh" — detect via touch support.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep the browser's mini-infobar away; our button triggers it
    deferredPrompt = e;
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });

  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* non-fatal: the site works fine without the service worker */
      });
    });
  }
}

/**
 * Trigger the native install prompt if the browser offered one.
 * Resolves to "accepted" | "dismissed" | "unavailable".
 */
export const promptInstall = async () => {
  if (!deferredPrompt) return "unavailable";
  const evt = deferredPrompt;
  deferredPrompt = null; // an event can only be prompted once
  notify();
  evt.prompt();
  const { outcome } = await evt.userChoice;
  return outcome;
};

export const useInstallApp = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return {
    canPrompt: !!deferredPrompt,
    isInstalled: installed,
    isIOS: isIOS(),
    promptInstall
  };
};
