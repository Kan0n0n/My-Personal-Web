export async function request(path, method = "GET", body, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw Object.assign(
      Error(data.error || "The request could not be completed."),
      { status: response.status },
    );
  }
  return data;
}
export function safeURL(value) {
  try {
    const url = new URL(value, location.href);
    if (["http:", "https:"].includes(url.protocol)) return url.href;
  } catch {}
  return "#";
}
export const localDate = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dateLabel = (date) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
export function download(name, data, type = "application/json") {
  const url = URL.createObjectURL(new Blob([data], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function legacyExport() {
  const saved = localStorage.getItem("philine-picturebook-v1");
  if (!saved) throw Error("No old notebook was found on this browser origin.");
  const books = await new Promise((resolve, reject) => {
    const open = indexedDB.open("philine-books", 1);
    open.onupgradeneeded = () =>
      open.result.createObjectStore("books", { keyPath: "id" });
    open.onerror = () => reject(Error("Local book storage is unavailable."));
    open.onsuccess = () => {
      const db = open.result,
        tx = db.transaction("books", "readonly"),
        read = tx.objectStore("books").getAll();
      tx.oncomplete = () => {
        db.close();
        resolve(read.result);
      };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(Error("Could not export old books."));
      };
    };
  });
  download(
    `picturebook-browser-backup-${localDate()}.json`,
    JSON.stringify({ notebook: JSON.parse(saved), books }, null, 2),
  );
}
