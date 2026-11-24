import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { waitForServer } from '../scripts/open-browser-when-ready.mjs'

test('pembuka browser menunggu server HTTP benar-benar siap', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('ok')
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  try {
    assert.equal(await waitForServer(`http://127.0.0.1:${address.port}`, 2, 10), true)
  } finally {
    server.close()
    await once(server, 'close')
  }
})

test('pembuka browser berhenti dengan aman jika server tidak merespons', async () => {
  const failingFetch = async () => { throw new Error('connection refused') }
  assert.equal(await waitForServer('http://127.0.0.1:1', 2, 1, failingFetch), false)
})
