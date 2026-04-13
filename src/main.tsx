import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n"; // Initialize i18n before rendering

// Force cache bust - increment this version to force all clients to clear cache
const CACHE_VERSION = 'v2026-04-13-02';
const CACHE_VERSION_KEY = 'app-cache-version';

(async () => {
  try {
    const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);
    if (storedVersion !== CACHE_VERSION) {
      console.log('[CacheBust] New version detected, clearing all caches...');
      // Clear all Cache Storage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
        console.log('[CacheBust] Cleared', keys.length, 'caches');
      }
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
        console.log('[CacheBust] Unregistered', registrations.length, 'service workers');
      }
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
      // Reload to get fresh assets if there was old cache
      if (storedVersion) {
        window.location.reload();
        // prevent further execution
        throw new Error('reloading');
      }
    }
  } catch (e: any) {
    if (e?.message === 'reloading') throw e;
    console.warn('[CacheBust] Error:', e);
  }
})();

// Hide initial loader once React is ready
const hideLoader = () => {
  if (typeof window !== 'undefined' && (window as any).hideInitialLoader) {
    (window as any).hideInitialLoader();
  }
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Hide loader after React has rendered
requestAnimationFrame(() => {
  requestAnimationFrame(hideLoader);
});