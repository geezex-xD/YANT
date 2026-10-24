import { DEFAULTS } from "./data.js";

const KEY = "material-homepage:settings:v1";

function merge(target, src) {
  for (const k of Object.keys(src || {})) {
    const v = src[k];
    if (v && typeof v === "object" && !Array.isArray(v) && target[k] && typeof target[k] === "object") {
      merge(target[k], v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

export function loadSettings() {
  const base = structuredClone(DEFAULTS);
  try {
    return merge(base, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {
    return base;
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn("Could not save settings", err);
  }
}

// Uploaded files (background image, avatar) live in IndexedDB as Blobs so GIFs keep their
// original bytes (and therefore their animation) and large images don't hit localStorage limits.
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("material-homepage", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("files", mode);
    const req = fn(tx.objectStore("files"));
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const putFile = (key, blob) => run("readwrite", (s) => s.put(blob, key));
export const getFile = (key) => run("readonly", (s) => s.get(key));
export const deleteFile = (key) => run("readwrite", (s) => s.delete(key));
