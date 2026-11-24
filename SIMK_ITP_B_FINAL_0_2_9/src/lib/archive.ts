const DATABASE_NAME = 'simk-itpb-private-archive'
const STORE_NAME = 'original-documents'
const DATABASE_VERSION = 1

type ArchivedDocument = { id: string; name: string; type: string; size: number; createdAt: string; blob: Blob }

function openArchiveDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB tidak tersedia pada browser ini.')); return }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Database arsip lokal gagal dibuka.'))
  })
}

export async function archiveSourceFile(id: string, file: File): Promise<void> {
  const db = await openArchiveDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put({ id, name: file.name, type: file.type, size: file.size, createdAt: new Date().toISOString(), blob: file } satisfies ArchivedDocument)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('File asli gagal diarsipkan.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Pengarsipan file dibatalkan.'))
    })
  } finally { db.close() }
}

export async function downloadArchivedSource(id: string): Promise<boolean> {
  const db = await openArchiveDatabase()
  try {
    const value = await new Promise<ArchivedDocument | undefined>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id)
      request.onsuccess = () => resolve(request.result as ArchivedDocument | undefined)
      request.onerror = () => reject(request.error ?? new Error('File arsip tidak dapat dibaca.'))
    })
    if (!value) return false
    const url = URL.createObjectURL(value.blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = value.name
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    return true
  } finally { db.close() }
}

export async function clearArchivedSources(): Promise<void> {
  const db = await openArchiveDatabase()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).clear()
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error ?? new Error('Arsip lokal gagal dibersihkan.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Penghapusan arsip lokal dibatalkan.'))
    })
  } finally { db.close() }
}
