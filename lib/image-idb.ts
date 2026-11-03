/**
 * 打卡图片原图存储（IndexedDB）：
 * localStorage 只保留缩略图，原图按记录 id 存入 IndexedDB，避免 5MB 配额被图片撑爆。
 * 浏览器不支持 IndexedDB 时所有写操作返回 false，调用方降级为直接保存 Base64。
 */

const DB_NAME = "glucofit-images";
const STORE_NAME = "images";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB != null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("当前浏览器不支持 IndexedDB"));
  }
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
      request.onblocked = () => reject(new Error("IndexedDB 被其他页面占用"));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

export async function putFullImage(id: string, dataUrl: string): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(dataUrl, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("图片写入失败"));
      tx.onabort = () => reject(tx.error ?? new Error("图片写入被中止"));
    });
    return true;
  } catch {
    return false;
  }
}

export async function getFullImage(id: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as string | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("图片读取失败"));
    });
  } catch {
    return null;
  }
}

export async function deleteFullImage(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("图片删除失败"));
    });
  } catch {
    // 删除失败不阻塞 UI
  }
}
