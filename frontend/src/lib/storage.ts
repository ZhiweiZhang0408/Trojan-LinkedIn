import type { BoardState } from "../types";
const STORE = "state";
let pending: Promise<IDBDatabase> | undefined;
function db() {
  return (pending ??= new Promise((resolve, reject) => {
    const r = indexedDB.open("trojan-board-local-preview", 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(
        new Error(
          "Browser storage is unavailable. Enable site storage to save this preview.",
        ),
      );
  }));
}
export async function loadState(): Promise<BoardState | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get("board-v1");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveState(state: BoardState): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, "board-v1");
    tx.oncomplete = () => resolve();
    tx.onerror = () =>
      reject(new Error("Changes could not be saved in this browser."));
  });
}
