import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// --- PERSISTANCE DU STOCKAGE PWA (Point 5) ---
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persisted) => {
    if (persisted) {
      console.log("🛡️ Durable PWA Storage persistence granted.");
    } else {
      console.warn("⚠️ Durable Storage persistence denied by browser.");
    }
  });
}

// --- DÉVERROUILLAGE AUDIO POUR ALARMES (iOS / Android PWA) ---
const unlockAudioEngine = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
  } catch (e) {
    // Ignore silent unlock error
  }
  window.removeEventListener('touchstart', unlockAudioEngine);
  window.removeEventListener('click', unlockAudioEngine);
};
window.addEventListener('touchstart', unlockAudioEngine, { passive: true, once: true });
window.addEventListener('click', unlockAudioEngine, { passive: true, once: true });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);