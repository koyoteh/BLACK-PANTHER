import test from 'node:test'
import assert from 'node:assert/strict'
import { commands } from '../commands/Admin.js'

const updateCommand = commands.find(command => command.name === 'update')
const testSha = '0123456789abcdef0123456789abcdef01234567'

function response(body, ok = true, status = 200) {
  return { ok, status, json: async () => body }
}

test('`.update` requests a Heroku build pinned to a validated latest commit SHA', async () => {
  assert.ok(updateCommand)
  assert.equal(updateCommand.ownerOnly, true)
  const previousFetch = globalThis.fetch
  const savedEnv = Object.fromEntries(['HEROKU_API_KEY', 'HEROKU_APP_NAME', 'UPDATE_REPOSITORY'].map(key => [key, process.env[key]]))
  const calls = []
  process.env.HEROKU_API_KEY = 'test-token'
  process.env.HEROKU_APP_NAME = 'test-app'
  process.env.UPDATE_REPOSITORY = 'cleanplata/BLACK-PANTHER'
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options })
    if (String(url).includes('/commits/main')) {
      return response({ sha: testSha, commit: { message: 'test pinned update' } })
    }
    if (String(url).includes('/git/trees/')) {
      return response({ tree: [
        { path: 'package.json' },
        { path: 'Guru Tech/index.js' },
        { path: 'Guru Tech/config.js' },
        { path: 'Guru/commands/Admin.js' }
      ] })
    }
    if (String(url).endsWith('/builds')) return response({ id: 'build-test', status: 'pending' })
    throw new Error(`Unexpected fetch URL: ${url}`)
  }

  const sent = []
  try {
    await updateCommand.execute({
      sock: { sendMessage: async (...args) => { sent.push(args); return {} } },
      from: '254700000001@s.whatsapp.net',
      msg: { key: { id: 'update-test' } },
      isOwner: true,
      config: {}
    })

    const buildCall = calls.find(call => call.url.endsWith('/builds'))
    assert.ok(buildCall)
    const payload = JSON.parse(buildCall.options.body)
    assert.equal(payload.source_blob.version, testSha)
    assert.equal(payload.source_blob.url, `https://github.com/cleanplata/BLACK-PANTHER/archive/${testSha}.tar.gz`)
    assert.ok(sent.at(-1)[1].text.includes(testSha.slice(0, 7)))
  } finally {
    globalThis.fetch = previousFetch
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('`.update` refuses non-owner execution before making network requests', async () => {
  const previousFetch = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Network should not be called') }
  const sent = []
  try {
    await updateCommand.execute({
      sock: { sendMessage: async (...args) => { sent.push(args); return {} } },
      from: '254700000001@s.whatsapp.net',
      msg: { key: { id: 'update-owner-test' } },
      isOwner: false,
      config: {}
    })
    assert.ok(sent[0][1].text.includes('bot owner'))
  } finally {
    globalThis.fetch = previousFetch
  }
})
