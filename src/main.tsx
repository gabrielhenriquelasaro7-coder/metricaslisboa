import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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