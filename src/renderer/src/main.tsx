import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "pdfjs-dist/web/pdf_viewer.css";
import type { OpenedTextbook } from "../../shared/textbook-api";
import "./styles.css";
import { TextbookReader } from "./textbook-reader";

function App() {
  const [textbook, setTextbook] = useState<OpenedTextbook | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openTextbook() {
    setError(null);
    try {
      const openedTextbook = await window.pdfantom.openTextbook();
      if (openedTextbook) setTextbook(openedTextbook);
    } catch {
      setError("The textbook could not be opened.");
    }
  }

  return (
    <main className="app-shell">
      <header className="app-bar">
        <div>
          <p className="eyebrow">PDFantom</p>
          <h1>Textbook reader</h1>
        </div>
        <button type="button" onClick={openTextbook}>
          Open textbook
        </button>
      </header>
      {error ? <p role="alert">{error}</p> : null}
      {textbook ? (
        <TextbookReader textbook={textbook} />
      ) : (
        <section className="empty-state">
          <h2>Open a textbook to begin</h2>
          <p>Reading local PDFs does not require a model provider.</p>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
