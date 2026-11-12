import React from "react";
import { Capacitor } from "@capacitor/core";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Le service worker reste actif sur le site web, mais pas dans l'APK Capacitor :
// le cache PWA ne doit pas servir une ancienne version du bundle natif.
if (!Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
