import type { StateStorage } from 'zustand/middleware'

const DB_NAME = 'tizora-pdf-editor'
const STORE_NAME = 'session'
const DB_VERSION = 1

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'))
    }
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function idbGet(key: string): Promise<string | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(key)
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB get failed'))
        }
        request.onsuccess = () => {
          resolve(
            typeof request.result === 'string' ? request.result : null,
          )
        }
        tx.oncomplete = () => {
          db.close()
        }
      }),
  )
}

function idbSet(key: string, value: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.put(value, key)
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB put failed'))
        }
        request.onsuccess = () => {
          resolve()
        }
        tx.oncomplete = () => {
          db.close()
        }
      }),
  )
}

function idbRemove(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.delete(key)
        request.onerror = () => {
          reject(request.error ?? new Error('IndexedDB delete failed'))
        }
        request.onsuccess = () => {
          resolve()
        }
        tx.oncomplete = () => {
          db.close()
        }
      }),
  )
}

export function createIdbStorage(): StateStorage {
  return {
    getItem: (name) => idbGet(name),
    setItem: (name, value) => idbSet(name, value),
    removeItem: (name) => idbRemove(name),
  }
}

export async function clearIdbStorageKey(name: string): Promise<void> {
  await idbRemove(name)
}
