import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'

const publicDir = path.resolve('public')
const specimens = JSON.parse(await readFile(path.join(publicDir, 'whales/manifest.json'), 'utf8'))

test('specimens have unique ids, attribution and existing local images', async () => {
  assert.ok(Array.isArray(specimens) && specimens.length > 0)
  const ids = new Set()
  for (const specimen of specimens) {
    assert.match(specimen.id, /^[a-z0-9-]+$/)
    assert.ok(!ids.has(specimen.id), `Duplicate specimen: ${specimen.id}`)
    ids.add(specimen.id)
    for (const field of ['name', 'source', 'license', 'version']) {
      assert.ok(typeof specimen[field] === 'string' && specimen[field].trim(), `${specimen.id}: missing ${field}`)
    }
    assert.equal(new URL(specimen.source).protocol, 'https:')
    assert.match(specimen.file, /^\/whales\/[a-z0-9-]+\.(png|svg)$/)
    await access(path.join(publicDir, specimen.file.slice(1)))
  }
})
