import React, { useState, useEffect, useRef } from "react";
import { buildExactGraph } from "./graph.js";
import { safeURL, download } from "./api.js";
import { UltilitiesPage, Masthead } from "./views.jsx";
function Graph({ data }) {
  const [error, setError] = useState("");
  useEffect(() => {
    let graph,
      alive = true,
      script;
    const render = () => {
      if (!alive) return;
      try {
        graph = buildExactGraph("mynetwork", data);
      } catch (e) {
        setError(e.message);
      }
    };
    if (window.vis) render();
    else {
      script = document.createElement("script");
      script.src =
        "https://unpkg.com/vis-network@9.1.9/standalone/umd/vis-network.min.js";
      script.onload = render;
      script.onerror = () => {
        if (alive)
          setError("The graph library could not load. Check your connection.");
      };
      document.head.append(script);
    }
    return () => {
      alive = false;
      graph?.destroy();
      script?.remove();
    };
  }, [data]);
  return (
    <div className="ai2d-result-card interactive-graph-card">
      <h4>Interactable Scene Graph</h4>
      {error && <p role="alert">{error}</p>}
      <div id="mynetwork" />
    </div>
  );
}
export default function Extractor() {
  const [file, setFile] = useState(null),
    [result, setResult] = useState(null),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    [inputURL, setInputURL] = useState(null),
    [zoom, setZoom] = useState(null),
    modal = useRef(null),
    abort = useRef(null);
  useEffect(() => {
    if (!file) {
      setInputURL(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setInputURL(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    if (zoom) modal.current.showModal();
    else if (modal.current?.open) modal.current.close();
  }, [zoom]);
  async function analyze() {
    if (!file) {
      setStatus("Please select an image first.");
      return;
    }
    setBusy(true);
    setResult(null);
    setStatus("Analyzing image…");
    const controller = new AbortController();
    abort.current = controller;
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("http://localhost:5000/api/analyze", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw Error("Analysis service could not respond.");
      const data = await res.json();
      if (
        !data.json_data ||
        typeof data.json_data !== "object" ||
        Array.isArray(data.json_data)
      )
        throw Error("Invalid analysis result.");
      setResult(data);
      setStatus("Analysis complete!");
    } catch (e) {
      if (e.name !== "AbortError")
        setStatus(`Analysis could not finish: ${e.message}`);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const cards = result
    ? [
        ["Input Image", inputURL],
        ["Relationships", result.images?.relationships],
        ["Text Matching", result.images?.text_matching],
        ["CLIP Results", result.images?.clip_results],
        ["Knowledge Graph", result.images?.knowledge_graph],
      ]
    : [];
  const controls = {
    imageInput: {
      disabled: busy,
      onChange: (e) => {
        setFile(e.target.files[0] || null);
        setResult(null);
      },
    },
    analyzeButton: { disabled: busy, onClick: analyze },
  };
  const slots = {
    fileLabel: "↑ " + (file?.name || "Choose Image"),
    status,
    "image-gallery": (
      <>
        {cards
          .filter(
            ([, url]) => url && (url === inputURL || safeURL(url) !== "#"),
          )
          .map(([title, url]) => (
            <div className="ai2d-result-card" key={title}>
              <h4>{title}</h4>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.preventDefault();
                  setZoom(url);
                }}
              >
                <img src={url} alt={title} />
              </a>
            </div>
          ))}
        {result && (
          <>
            <div className="ai2d-json-card">
              <h4>Final JSON Data</h4>
              <pre>{JSON.stringify(result.json_data, null, 2)}</pre>
              <button
                className="json-download-btn"
                onClick={() =>
                  download(
                    "diagram_analysis.json",
                    JSON.stringify(result.json_data, null, 2),
                  )
                }
              >
                ↓ Download JSON
              </button>
            </div>
            {Array.isArray(result.json_data.blobs) &&
              Array.isArray(result.json_data.relationships) && (
                <Graph data={result.json_data} />
              )}
          </>
        )}
      </>
    ),
  };
  return (
    <div className="tool-wrap">
      <nav className="tool-nav">
        <a href="index.html">← Picture Book</a>
        <a href="utilities.html">All utilities</a>
      </nav>
      <Masthead />
      <p className="backend-note tw:break-words">
        Analysis needs the original backend at localhost:5000/api/analyze.
      </p>
      <UltilitiesPage controls={controls} slots={slots} />
      <dialog
        ref={modal}
        aria-label="Enlarged diagram"
        onCancel={() => setZoom(null)}
        onClick={(e) => {
          if (e.target === modal.current) setZoom(null);
        }}
      >
        <button
          autoFocus
          onClick={() => setZoom(null)}
          aria-label="Close enlarged diagram"
        >
          ×
        </button>
        {zoom && (
          <img
            src={zoom}
            alt="Enlarged analysis result"
            style={{ maxWidth: "85vw", maxHeight: "80vh" }}
          />
        )}
      </dialog>
    </div>
  );
}
