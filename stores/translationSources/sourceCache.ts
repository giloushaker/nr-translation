// IndexedDB cache for BSData sources to avoid re-downloading

const DB_NAME = "bsdata-source-cache";
const DB_VERSION = 1;
const STORE_NAME = "sources";

export interface CachedSource {
  compositeKey: string; // "owner/repo"
  owner: string;
  repo: string;
  releaseTag: string; // Tag name or "HEAD"
  data: any; // GameSystemFiles serialized data
  cachedAt: number;
}

async function dbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "compositeKey" });
        store.createIndex("owner-repo", ["owner", "repo"], { unique: false });
      }
    };
  });
}

export async function getCachedSource(owner: string, repo: string): Promise<CachedSource | null> {
  try {
    const db = await dbOpen();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const key = `${owner}/${repo}`;

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to get cached source:", error);
    return null;
  }
}

export async function setCachedSource(
  owner: string,
  repo: string,
  releaseTag: string,
  data: any
): Promise<void> {
  try {
    const db = await dbOpen();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const record: CachedSource = {
      compositeKey: `${owner}/${repo}`,
      owner,
      repo,
      releaseTag,
      data,
      cachedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to cache source:", error);
  }
}

export async function clearCachedSource(owner: string, repo: string): Promise<void> {
  try {
    const db = await dbOpen();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const key = `${owner}/${repo}`;

    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear cached source:", error);
  }
}

export async function clearAllCache(): Promise<void> {
  try {
    const db = await dbOpen();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear all cache:", error);
  }
}
