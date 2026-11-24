import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export async function waitForServer(url = 'http://127.0.0.1:5173', attempts = 50, delayMs = 500, fetchImpl = fetch) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, { method: 'GET', signal: AbortSignal.timeout(1500) })
      if (response.ok) return true
    } catch {
      // Vite may still be starting; retry until the bounded timeout is reached.
    }
    if (attempt + 1 < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return false
}

async function main() {
  const url = 'http://127.0.0.1:5173'
  const ready = await waitForServer('http://127.0.0.1:5173')
  if (!ready) {
    console.log('Browser tidak dibuka otomatis karena server belum merespons. Jika terminal menunjukkan Vite siap, buka http://127.0.0.1:5173 secara manual.')
    return
  }

  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    browser.unref()
    console.log(`Server merespons. Membuka ${url}`)
  } else {
    console.log(`Server merespons. Buka ${url} pada browser.`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Pembuka browser otomatis gagal: ${error.message}`)
    console.log('Jika server Vite sudah siap, buka http://127.0.0.1:5173 secara manual.')
  })
}
