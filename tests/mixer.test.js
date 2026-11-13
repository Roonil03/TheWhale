import test from 'node:test'
import assert from 'node:assert/strict'
import { initialMix, shareUrl } from '../src/mixer.js'

const items = [{ id: 'apple' }, { id: 'google' }, { id: 'twitter' }, { id: 'openmoji' }]

test('initial mix uses defaults for invalid selections and clamps softness', () => {
  assert.deepEqual(initialMix(items, '?spout=google&head=unknown&seam=150'), {
    parts: { spout: 'google', head: 'google', body: 'twitter', tail: 'openmoji' }, softness: 100,
  })
  assert.equal(initialMix(items, '?seam=-5').softness, 0)
  assert.equal(initialMix(items, '?seam=invalid').softness, 20)
})

test('share links restore the mix and preserve unrelated URL parameters', () => {
  const parts = { spout: 'apple', head: 'twitter', body: 'google', tail: 'openmoji' }
  const url = new URL(shareUrl('https://example.com/TheWhale/?ref=friend#lab', parts, 42))
  assert.equal(url.searchParams.get('ref'), 'friend')
  assert.equal(url.hash, '#lab')
  assert.deepEqual(initialMix(items, url.search), { parts, softness: 42 })
})
