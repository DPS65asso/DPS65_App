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