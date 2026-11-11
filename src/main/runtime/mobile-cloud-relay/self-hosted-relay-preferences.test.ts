import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getActiveSelfHostedRelayConfig,
  initializeSelfHostedRelayConfig,
  saveSelfHostedRelaySettings
} from './self-hosted-relay-preferences'

let directory: string

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'orca-relay-preferences-'))
  vi.stubEnv('ORCA_SELF_HOSTED_RELAY_URL', 'https://env-relay.example.com')
  vi.stubEnv('ORCA_SELF_HOSTED_RELAY_TOKEN_FILE', join(directory, 'env-token.txt'))
})

afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(directory, { recursive: true, force: true })
})

it('keeps the running Relay while saving a new selection, then reads the saved choice after restart', async () => {
  await initializeSelfHostedRelayConfig(directory)
  expect(getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://env-relay.example.com'
  )
  expect(
    await saveSelfHostedRelaySettings(directory, {
      mode: 'self-hosted',
      origin: 'https://saved-relay.example.com',
      tokenFile: join(directory, 'saved-token.txt')
    })
  ).toEqual({
    selfHosted: true,
    origin: 'https://saved-relay.example.com',
    credentialName: 'saved-token.txt',
    restartRequired: true
  })
  expect(getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://env-relay.example.com'
  )

  vi.resetModules()
  const restarted = await import('./self-hosted-relay-preferences')
  await restarted.initializeSelfHostedRelayConfig(directory)
  expect(restarted.getActiveSelfHostedRelayConfig(directory)?.relayDirectorUrl).toBe(
    'https://saved-relay.example.com'
  )
  expect((await restarted.getSelfHostedRelaySettings(directory)).restartRequired).toBe(false)

  expect(
    (await restarted.saveSelfHostedRelaySettings(directory, { mode: 'official' })).restartRequired
  ).toBe(true)
  vi.resetModules()
  const reset = await import('./self-hosted-relay-preferences')
  await expect(reset.initializeSelfHostedRelayConfig(directory)).resolves.toBeUndefined()
})

it('treats a corrupted saved preference as an unavailable Relay instead of falling back', async () => {
  mkdirSync(join(directory, 'mobile-relay'))
  writeFileSync(join(directory, 'mobile-relay', 'preference.json'), '{', 'utf8')

  await expect(initializeSelfHostedRelayConfig(directory)).resolves.toBeNull()
})
