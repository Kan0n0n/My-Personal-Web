import React, { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./theme.css";
import { observeScrollReveal } from "./scroll-reveal.js";
function ScrollReveal() {
  useEffect(() => observeScrollReveal(document.getElementById("root")), []);
  return null;
}
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
    <ScrollReveal />
  </StrictMode>,
);
