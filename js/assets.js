// ============================================================
// assets.js — local file store for logos and brand guides
// ============================================================
//
// Files live in IndexedDB, keyed by client slug. State holds only the
// metadata — name, type, size — never the bytes.
//
// That separation is the whole point. A logo as a data URL in state would
// ride the URL fragment, and a 200KB PNG becomes a ~270KB link that no
// browser will open. It would also blow localStorage's 5MB ceiling and
// take the rest of the kickoff with it.
//
// The consequence is honest and worth stating in the UI: an uploaded file
// stays on the machine that uploaded it. The share link carries the fact
// that a logo exists and what it's called, not the logo. Anything that has
// to travel gets downloaded back out and put somewhere real.

const DB_NAME = "ss-kickoff-assets";
const STORE = "files";
const MAX_BYTES = 10 * 1024 * 1024;

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) { reject(new Error("no IndexedDB")); return; }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB failed to open"));
  });
  return dbPromise;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let out;
    try { out = fn(store); } catch (e) { reject(e); return; }
    t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("aborted"));
  }));
}

function key(slug, name) { return String(slug || "template") + ":" + name; }

/**
 * Names this store has been asked for under a different name before.
 *
 * The read-out's card rendered "extract" in b44 and b45, so its bytes went
 * in under that name, while the metadata the card reads moved to
 * "extractFile" in b46. Reads fall back so a session captured on either
 * build can still hand its file back; without it the card shows an
 * attached file and Download says it isn't on this machine, which is both
 * wrong and unfixable from the screen.
 *
 * Deletable once no session predating b46 is still in use.
 */
const RENAMED_FROM = { extractFile: "extract" };

export function isSupported() { return !!window.indexedDB; }
export const MAX_MB = MAX_BYTES / 1024 / 1024;

/** Human size, for the metadata line the readout shows. */
export function humanSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
  return (n / 1024 / 1024).toFixed(1) + " MB";
}

/**
 * Store a file and return the metadata to put in state.
 * Rejects rather than truncating — a half-saved logo is worse than none.
 */
export async function put(slug, name, file) {
  if (!file) throw new Error("no file");
  if (file.size > MAX_BYTES) {
    throw new Error(`That file is ${humanSize(file.size)}. The limit is ${MAX_MB}MB.`);
  }
  const buf = await file.arrayBuffer();
  // Stamped once: the preview cache keys on `at`, so the copy in state and
  // the copy in the store have to be the same number.
  const meta = { name: file.name, type: file.type, size: file.size, at: Date.now() };
  await tx("readwrite", (store) => store.put({ ...meta, buf }, key(slug, name)));
  return meta;
}

export async function get(slug, name) {
  const read = async (n) => {
    try { return await tx("readonly", (store) => store.get(key(slug, n))); }
    catch (e) { return null; }
  };
  const hit = await read(name);
  if (hit) return hit;
  const was = RENAMED_FROM[name];
  return was ? await read(was) : null;
}

export async function remove(slug, name) {
  const drop = async (n) => {
    try { await tx("readwrite", (store) => store.delete(key(slug, n))); } catch (e) { /* ignore */ }
  };
  await drop(name);
  // Remove has to reach the old name too, or a file captured on an earlier
  // build survives its own deletion and comes back the next time the card
  // looks for it.
  if (RENAMED_FROM[name]) await drop(RENAMED_FROM[name]);
}

/** An object URL for previewing, plus a revoke handle. */
export async function objectUrl(slug, name) {
  const rec = await get(slug, name);
  if (!rec || !rec.buf) return null;
  const blob = new Blob([rec.buf], { type: rec.type || "application/octet-stream" });
  return { url: URL.createObjectURL(blob), rec };
}

/** Hand the file back so it can be filed somewhere that isn't this laptop. */
export async function download(slug, name) {
  const hit = await objectUrl(slug, name);
  if (!hit) return false;
  const a = document.createElement("a");
  a.href = hit.url;
  a.download = hit.rec.name || name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(hit.url), 2000);
  return true;
}

export function isImage(type) { return /^image\//.test(String(type || "")); }
